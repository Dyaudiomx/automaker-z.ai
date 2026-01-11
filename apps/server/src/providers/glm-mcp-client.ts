/**
 * MCP Client for GLM Provider
 * 
 * Handles connecting to MCP servers and executing MCP tools for GLM agents.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { MCPServerConfig } from '@automaker/types';
import { createLogger } from '@automaker/utils';

const logger = createLogger('GlmMcpClient');
const CONNECTION_TIMEOUT = 30000; // 30 seconds
const CALL_TIMEOUT = 60000; // 60 seconds for tool calls

interface MCPConnection {
  client: Client;
  transport: StdioClientTransport | SSEClientTransport | StreamableHTTPClientTransport;
  tools: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }>;
}

/**
 * MCP Client Manager for GLM
 * Manages connections to MCP servers and tool execution
 */
export class GlmMcpClient {
  private connections: Map<string, MCPConnection> = new Map();
  private connecting: Map<string, Promise<MCPConnection | null>> = new Map();

  /**
   * Initialize connections to all configured MCP servers
   */
  async initialize(mcpServers: Record<string, { type?: string; url?: string; command?: string; args?: string[]; env?: Record<string, string> }>): Promise<void> {
    const serverNames = Object.keys(mcpServers);
    if (serverNames.length === 0) {
      logger.info('[GLM-MCP] No MCP servers configured');
      return;
    }

    logger.info(`[GLM-MCP] Initializing ${serverNames.length} MCP server(s): ${serverNames.join(', ')}`);

    // Connect to all servers in parallel
    await Promise.all(
      serverNames.map(async (name) => {
        const config = mcpServers[name];
        await this.connect(name, config as MCPServerConfig);
      })
    );
  }

  /**
   * Connect to a single MCP server
   */
  private async connect(name: string, config: MCPServerConfig): Promise<MCPConnection | null> {
    // Check if already connecting
    const existingPromise = this.connecting.get(name);
    if (existingPromise) {
      return existingPromise;
    }

    // Check if already connected
    if (this.connections.has(name)) {
      return this.connections.get(name)!;
    }

    const connectPromise = this.doConnect(name, config);
    this.connecting.set(name, connectPromise);

    try {
      const result = await connectPromise;
      return result;
    } finally {
      this.connecting.delete(name);
    }
  }

  private async doConnect(name: string, config: MCPServerConfig): Promise<MCPConnection | null> {
    try {
      logger.info(`[GLM-MCP] Connecting to MCP server: ${name}`);

      const client = new Client({
        name: 'automaker-glm-agent',
        version: '1.0.0',
      });

      const transport = await this.createTransport(config);

      // Connect with timeout
      await Promise.race([
        client.connect(transport),
        this.timeout(CONNECTION_TIMEOUT, `Connection to ${name} timed out`),
      ]);

      // List available tools
      const toolsResult = await Promise.race([
        client.listTools(),
        this.timeout<{ tools: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }> }>(
          CONNECTION_TIMEOUT,
          `Listing tools from ${name} timed out`
        ),
      ]);

      const tools = toolsResult.tools || [];
      logger.info(`[GLM-MCP] Connected to ${name}, found ${tools.length} tools: ${tools.map(t => t.name).join(', ')}`);

      const connection: MCPConnection = { client, transport, tools };
      this.connections.set(name, connection);
      return connection;
    } catch (error) {
      logger.error(`[GLM-MCP] Failed to connect to ${name}:`, error);
      return null;
    }
  }

  /**
   * Create transport based on server type
   */
  private async createTransport(
    config: MCPServerConfig
  ): Promise<StdioClientTransport | SSEClientTransport | StreamableHTTPClientTransport> {
    if (config.type === 'sse') {
      if (!config.url) {
        throw new Error('SSE server requires URL');
      }
      return new SSEClientTransport(new URL(config.url));
    }

    if (config.type === 'http') {
      if (!config.url) {
        throw new Error('HTTP server requires URL');
      }
      return new StreamableHTTPClientTransport(new URL(config.url));
    }

    // Default: stdio transport
    if (!config.command) {
      throw new Error('Stdio server requires command');
    }

    return new StdioClientTransport({
      command: config.command,
      args: config.args || [],
      env: { ...process.env, ...config.env } as Record<string, string>,
    });
  }

  /**
   * Get all available MCP tools across all connected servers
   */
  getAllTools(): Array<{ serverName: string; name: string; description?: string; inputSchema?: Record<string, unknown> }> {
    const allTools: Array<{ serverName: string; name: string; description?: string; inputSchema?: Record<string, unknown> }> = [];

    for (const [serverName, connection] of this.connections) {
      for (const tool of connection.tools) {
        allTools.push({
          serverName,
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        });
      }
    }

    return allTools;
  }

  /**
   * Check if a tool name is an MCP tool
   */
  isMcpTool(toolName: string): boolean {
    for (const connection of this.connections.values()) {
      if (connection.tools.some(t => t.name === toolName)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Find which server has a tool
   */
  findServerForTool(toolName: string): string | null {
    for (const [serverName, connection] of this.connections) {
      if (connection.tools.some(t => t.name === toolName)) {
        return serverName;
      }
    }
    return null;
  }

  /**
   * Call an MCP tool
   */
  async callTool(toolName: string, args: Record<string, unknown>): Promise<{ success: boolean; output: string; error?: string }> {
    const serverName = this.findServerForTool(toolName);
    if (!serverName) {
      return { success: false, output: '', error: `Tool "${toolName}" not found in any MCP server` };
    }

    const connection = this.connections.get(serverName);
    if (!connection) {
      return { success: false, output: '', error: `MCP server "${serverName}" not connected` };
    }

    try {
      logger.info(`[GLM-MCP] Calling tool ${toolName} on server ${serverName}`);

      const result = await Promise.race([
        connection.client.callTool({ name: toolName, arguments: args }),
        this.timeout<{ content?: Array<{ type: string; text?: string }> }>(CALL_TIMEOUT, `Tool call ${toolName} timed out`),
      ]);

      // Extract text content from result
      const content = (result.content || []) as Array<{ type: string; text?: string }>;
      const textParts = content
        .filter((c: { type: string; text?: string }): c is { type: string; text: string } => c.type === 'text' && typeof c.text === 'string')
        .map((c: { type: string; text: string }) => c.text);

      const output = textParts.join('\n');
      logger.info(`[GLM-MCP] Tool ${toolName} returned ${output.length} chars`);

      return { success: true, output };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[GLM-MCP] Tool ${toolName} failed:`, error);
      return { success: false, output: '', error: errorMessage };
    }
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    for (const [name, connection] of this.connections) {
      try {
        await connection.client.close();
        logger.info(`[GLM-MCP] Closed connection to ${name}`);
      } catch (error) {
        logger.error(`[GLM-MCP] Error closing connection to ${name}:`, error);
      }
    }
    this.connections.clear();
  }

  private timeout<T>(ms: number, message: string): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    });
  }
}

// Singleton instance
let mcpClientInstance: GlmMcpClient | null = null;

export function getGlmMcpClient(): GlmMcpClient {
  if (!mcpClientInstance) {
    mcpClientInstance = new GlmMcpClient();
  }
  return mcpClientInstance;
}
