/**
 * Z.ai GLM Provider - Supports GLM 4.7 and other Z.ai models
 *
 * Uses OpenAI-compatible API for GLM models.
 * Supports two API endpoints:
 *   1. Coding Plan API: https://api.z.ai/api/coding/paas/v4/chat/completions
 *   2. Standard Chat API: https://chat.z.ai/api/chat/completions
 * 
 * Users can configure which endpoint to use via settings.
 * API keys are stored securely in settings, never hardcoded.
 */

import { BaseProvider } from './base-provider.js';
import type {
  ExecuteOptions,
  ProviderMessage,
  InstallationStatus,
  ModelDefinition,
  ConversationMessage,
} from './types.js';
import { SettingsService } from '../services/settings-service.js';
import { getDataDirectory } from '@automaker/platform';
import { createLogger } from '@automaker/utils';
import path from 'path';
import { executeTool, type ToolCall } from './glm-tool-executor.js';
import { getGlmMcpClient } from './glm-mcp-client.js';

const logger = createLogger('GlmProvider');

/**
 * Z.ai API endpoints
 * Users can configure which endpoint to use based on their subscription type
 */
const ZAI_ENDPOINTS = {
  // Coding Plan API - for users with Coding Plan subscription
  codingPlan: 'https://api.z.ai/api/coding/paas/v4',
  // Standard Chat API - for users with standard Z.ai subscription
  chat: 'https://chat.z.ai/api/chat',
};

// Default to Coding Plan API
const ZAI_API_BASE = ZAI_ENDPOINTS.codingPlan;

/**
 * Available Z.ai GLM models
 */
const ZAI_MODELS: ModelDefinition[] = [
  {
    id: 'glm-4.7',
    name: 'GLM 4.7',
    modelString: 'glm-4.7',
    provider: 'zai',
    description: 'Latest Z.ai GLM model with advanced reasoning and tool calling capabilities',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    supportsVision: true,
    supportsTools: true,
    tier: 'premium',
    default: true,
    hasReasoning: true,
  },
  {
    id: 'glm-4-plus',
    name: 'GLM 4 Plus',
    modelString: 'glm-4-plus',
    provider: 'zai',
    description: 'High-performance GLM model for complex tasks',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    supportsVision: true,
    supportsTools: true,
    tier: 'standard',
    hasReasoning: true,
  },
  {
    id: 'glm-4-flash',
    name: 'GLM 4 Flash',
    modelString: 'glm-4-flash',
    provider: 'zai',
    description: 'Fast GLM model for quick responses',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    supportsVision: true,
    supportsTools: true,
    tier: 'basic',
    hasReasoning: false,
  },
];

/**
 * Z.ai GLM Provider
 *
 * Implements provider interface for Z.ai GLM models using OpenAI-compatible API.
 */
export class GlmProvider extends BaseProvider {
  private dataDir: string;

  constructor() {
    super();
    const configured = getDataDirectory() ?? process.env.DATA_DIR;
    this.dataDir = configured ? path.resolve(configured) : path.resolve('.');
  }

  /**
   * Get provider name
   */
  getName(): string {
    return 'zai';
  }

  /**
   * Get available models
   */
  getAvailableModels(): ModelDefinition[] {
    return ZAI_MODELS;
  }

  /**
   * Detect installation status
   * For Z.ai, we check if API key is configured
   */
  async detectInstallation(): Promise<InstallationStatus> {
    try {
      const settingsService = new SettingsService(this.dataDir);
      const settings = await settingsService.getCredentials();
      
      const hasApiKey = Boolean(settings.apiKeys.zai && settings.apiKeys.zai.length > 0);
      
      return {
        installed: true,
        method: 'sdk',
        hasApiKey,
        authenticated: hasApiKey,
      };
    } catch (error) {
      return {
        installed: true,
        method: 'sdk',
        hasApiKey: false,
        authenticated: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if provider supports a specific feature
   */
  supportsFeature(feature: 'vision' | 'tools' | 'streaming' | 'thinking'): boolean {
    switch (feature) {
      case 'vision':
        return true;
      case 'tools':
        return true;
      case 'streaming':
        return true;
      case 'thinking':
        return true;
      default:
        return false;
    }
  }

  /**
   * Execute a query with streaming support and agentic tool execution loop
   */
  async *executeQuery(options: ExecuteOptions): AsyncGenerator<ProviderMessage> {
    const {
      prompt,
      model,
      systemPrompt,
      conversationHistory = [],
      allowedTools,
      abortController,
      cwd,
      maxTurns = 50,
      mcpServers,
    } = options;

    const workingDir = cwd || process.cwd();

    // Initialize MCP client if MCP servers are configured
    if (mcpServers && Object.keys(mcpServers).length > 0) {
      const mcpClient = getGlmMcpClient();
      await mcpClient.initialize(mcpServers as Record<string, { type?: string; url?: string; command?: string; args?: string[]; env?: Record<string, string> }>);
      logger.info(`[GLM-AGENT] MCP client initialized with ${Object.keys(mcpServers).length} server(s)`);
    }

    // Get API key and endpoint configuration
    try {
      const settingsService = new SettingsService(this.dataDir);
      const settings = await settingsService.getCredentials();
      const globalSettings = await settingsService.getGlobalSettings();

      // Support both Coding Plan API key and standard Chat API key
      // Priority: Coding Plan key > Chat API key
      const apiKey = settings.apiKeys.zai || settings.apiKeys.zaiChat;
      if (!apiKey) {
        yield {
          type: 'error',
          error: 'Z.ai API key not configured. Please add your API key in Settings > Providers > Z.ai',
        };
        return;
      }

      // Determine which endpoint to use based on which key is configured
      // If zai key is set, use Coding Plan endpoint; if only zaiChat is set, use Chat endpoint
      const useEndpoint = settings.apiKeys.zai ? ZAI_ENDPOINTS.codingPlan : ZAI_ENDPOINTS.chat;
      logger.info(`[GLM-AGENT] Using endpoint: ${useEndpoint}`);

      // Build initial messages array
      const messages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: object }>; tool_calls?: unknown[]; tool_call_id?: string }> = [];

      // Add system prompt if provided
      if (systemPrompt) {
        const systemPromptText = typeof systemPrompt === 'string' ? systemPrompt : this.getSystemPromptText(systemPrompt);
        messages.push({ role: 'system', content: systemPromptText });
      }

      // Add conversation history
      for (const msg of conversationHistory) {
        messages.push(this.convertToOpenAIMessage(msg));
      }

      // Add current prompt
      if (typeof prompt === 'string') {
        messages.push({ role: 'user', content: prompt });
      } else if (Array.isArray(prompt)) {
        const content = prompt.map((block) => {
          if (block.type === 'text' && block.text) {
            return { type: 'text', text: block.text };
          } else if (block.type === 'image' && block.source) {
            return { type: 'image_url', image_url: block.source };
          }
          return { type: 'text', text: '' };
        });
        messages.push({ role: 'user', content });
      }

      // Build tools schema
      const tools = allowedTools && allowedTools.length > 0 
        ? this.buildToolsSchema(allowedTools) 
        : undefined;

      let totalContent = '';
      let turnCount = 0;

      // Agentic loop - continue until no more tool calls or max turns reached
      while (turnCount < maxTurns) {
        turnCount++;
        logger.info(`[GLM-AGENT] Turn ${turnCount}/${maxTurns}`);

        if (abortController?.signal.aborted) {
          yield { type: 'error', error: 'Request aborted' };
          return;
        }

        // Make API request with retry logic
        const requestBody: Record<string, unknown> = {
          model: model || 'glm-4.7',
          messages,
          stream: true,
          temperature: 0.7,
          max_tokens: 32768,
        };

        if (tools) {
          requestBody.tools = tools;
          requestBody.tool_choice = 'auto';
        }

        // Trim message history if too long (keep system + last 40 messages)
        if (messages.length > 42) {
          const systemMsg = messages[0];
          const recentMsgs = messages.slice(-40);
          messages.length = 0;
          messages.push(systemMsg, ...recentMsgs);
          logger.info(`[GLM-AGENT] Trimmed message history to ${messages.length} messages`);
        }

        // Retry logic for transient network failures
        const MAX_RETRIES = 3;
        const FETCH_TIMEOUT = 120000; // 2 minute timeout per request
        let response: Response | null = null;
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          try {
            // Create timeout controller
            const timeoutController = new AbortController();
            const timeoutId = setTimeout(() => timeoutController.abort(), FETCH_TIMEOUT);
            
            // Combine with user's abort controller if provided
            const combinedSignal = abortController?.signal;
            if (combinedSignal) {
              combinedSignal.addEventListener('abort', () => timeoutController.abort());
            }

            response = await fetch(`${useEndpoint}/completions`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
              },
              body: JSON.stringify(requestBody),
              signal: timeoutController.signal,
            });
            clearTimeout(timeoutId);
            break; // Success, exit retry loop
          } catch (fetchError) {
            lastError = fetchError as Error;
            const isTimeout = lastError.name === 'AbortError';
            logger.warn(`[GLM-AGENT] Fetch attempt ${attempt}/${MAX_RETRIES} failed: ${isTimeout ? 'Request timeout' : lastError.message}`);
            
            if (attempt < MAX_RETRIES) {
              // Exponential backoff: 2s, 4s, 8s
              const delay = Math.pow(2, attempt) * 1000;
              logger.info(`[GLM-AGENT] Retrying in ${delay}ms...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }

        if (!response) {
          yield { type: 'error', error: `Z.ai API connection failed after ${MAX_RETRIES} attempts: ${lastError?.message || 'Unknown error'}` };
          return;
        }

        if (!response.ok) {
          const errorText = await response.text();
          yield { type: 'error', error: `Z.ai API error (${response.status}): ${errorText}` };
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          yield { type: 'error', error: 'Failed to read response stream' };
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let turnContent = '';
        const turnToolCalls: Array<{ id: string; name: string; arguments: string }> = [];

        // Stream this turn's response
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          if (abortController?.signal.aborted) {
            yield { type: 'error', error: 'Request aborted' };
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta;
                if (!delta) continue;

                // Handle content
                if (delta.content) {
                  turnContent += delta.content;
                  totalContent += delta.content;
                  yield {
                    type: 'assistant',
                    message: {
                      role: 'assistant',
                      content: [{ type: 'text', text: delta.content }],
                    },
                  };
                }

                // Handle tool calls - accumulate arguments
                if (delta.tool_calls) {
                  for (const tc of delta.tool_calls) {
                    const idx = tc.index ?? 0;
                    if (!turnToolCalls[idx]) {
                      turnToolCalls[idx] = { id: tc.id || `call_${idx}`, name: '', arguments: '' };
                    }
                    if (tc.id) turnToolCalls[idx].id = tc.id;
                    if (tc.function?.name) turnToolCalls[idx].name = tc.function.name;
                    if (tc.function?.arguments) turnToolCalls[idx].arguments += tc.function.arguments;
                  }
                }
              } catch {
                continue;
              }
            }
          }
        }

        // Filter valid tool calls
        const validToolCalls = turnToolCalls.filter(tc => tc.id && tc.name);

        // If no tool calls, we're done
        if (validToolCalls.length === 0) {
          logger.info(`[GLM-AGENT] No tool calls, ending loop after ${turnCount} turns`);
          break;
        }

        // Add assistant message with tool calls to history
        messages.push({
          role: 'assistant',
          content: turnContent || '',
          tool_calls: validToolCalls.map(tc => ({
            id: tc.id,
            type: 'function',
            function: { name: tc.name, arguments: tc.arguments },
          })),
        });

        // Execute each tool call and add results
        for (const tc of validToolCalls) {
          logger.info(`[GLM-AGENT] Executing tool: ${tc.name}`);
          
          // Yield tool_use event for UI
          let parsedInput: Record<string, unknown> = {};
          try {
            parsedInput = JSON.parse(tc.arguments);
          } catch {
            parsedInput = { raw: tc.arguments };
          }

          yield {
            type: 'assistant',
            message: {
              role: 'assistant',
              content: [{
                type: 'tool_use',
                tool_use_id: tc.id,
                name: tc.name,
                input: parsedInput,
              }],
            },
          };

          // Execute the tool
          const toolCall: ToolCall = {
            id: tc.id,
            name: tc.name,
            input: parsedInput,
          };

          const result = await executeTool(toolCall, workingDir);
          const resultText = result.success 
            ? result.output 
            : `Error: ${result.error}`;

          logger.info(`[GLM-AGENT] Tool ${tc.name} result: ${resultText.substring(0, 200)}...`);

          // Add tool result to messages
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: resultText,
          });

          // Don't yield tool results to UI - they create noise
          // The model will incorporate results into its response naturally
        }
      }

      if (turnCount >= maxTurns) {
        logger.warn(`[GLM-AGENT] Reached max turns (${maxTurns})`);
      }

      // Final result message
      yield {
        type: 'result',
        result: totalContent,
      };

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        yield { type: 'error', error: 'Request aborted' };
      } else {
        logger.error('[GLM-AGENT] Error:', error);
        yield { type: 'error', error: error instanceof Error ? error.message : 'Unknown error occurred' };
      }
    }
  }

  /**
   * Convert conversation message to OpenAI format
   */
  private convertToOpenAIMessage(msg: ConversationMessage): {
    role: string;
    content: string | Array<{ type: string; text?: string; image_url?: object }>;
  } {
    if (typeof msg.content === 'string') {
      return {
        role: msg.role,
        content: msg.content,
      };
    }

    // Handle array content (images, etc.)
    const content = msg.content.map((block) => {
      if (block.type === 'text' && block.text) {
        return { type: 'text', text: block.text };
      } else if (block.type === 'image' && block.source) {
        return { type: 'image_url', image_url: block.source };
      }
      return { type: 'text', text: '' };
    });

    return {
      role: msg.role,
      content,
    };
  }

  /**
   * Get system prompt text from preset
   */
  private getSystemPromptText(systemPrompt: string | { type: 'preset'; preset: string; append?: string }): string {
    if (typeof systemPrompt === 'string') {
      return systemPrompt;
    }

    // Handle preset system prompts
    const { preset, append } = systemPrompt;

    const presets: Record<string, string> = {
      claude_code: `You are an expert software developer with deep knowledge of multiple programming languages, frameworks, and best practices.

Your role is to help users with coding tasks, including:
- Writing, reviewing, and refactoring code
- Debugging and fixing issues
- Architecting software solutions
- Explaining technical concepts
- Following project-specific conventions and patterns

When writing code:
1. Follow existing code style and conventions
2. Write clean, maintainable, and well-documented code
3. Consider performance, security, and scalability
4. Add appropriate error handling
5. Use meaningful variable and function names

When debugging:
1. Analyze problem systematically
2. Identify root cause
3. Propose and implement a fix
4. Verify solution works
5. Explain what went wrong and how to prevent similar issues

Be thorough but concise. Focus on delivering working solutions.`,
    };

    let text = presets[preset] || '';
    if (append) {
      text += '\n\n' + append;
    }

    return text;
  }

  /**
   * Build tools schema for OpenAI API
   * Includes both built-in tools and MCP tools
   */
  private buildToolsSchema(allowedTools: string[]): Array<{ type: string; function: { name: string; description: string; parameters: Record<string, unknown> } }> {
    const tools: Array<{ type: string; function: { name: string; description: string; parameters: Record<string, unknown> } }> = [];

    // Add built-in tools
    for (const toolName of allowedTools) {
      tools.push({
        type: 'function',
        function: {
          name: toolName,
          description: this.getBuiltInToolDescription(toolName),
          parameters: this.getBuiltInToolParameters(toolName),
        },
      });
    }

    // Add MCP tools
    const mcpClient = getGlmMcpClient();
    const mcpTools = mcpClient.getAllTools();
    for (const mcpTool of mcpTools) {
      // Skip if already in allowedTools (shouldn't happen but safety check)
      if (allowedTools.includes(mcpTool.name)) continue;
      
      tools.push({
        type: 'function',
        function: {
          name: mcpTool.name,
          description: mcpTool.description || `MCP Tool: ${mcpTool.name}`,
          parameters: mcpTool.inputSchema || { type: 'object', properties: {} },
        },
      });
    }

    return tools;
  }

  /**
   * Get description for built-in tools
   */
  private getBuiltInToolDescription(toolName: string): string {
    const descriptions: Record<string, string> = {
      Read: 'Read the contents of a file at the specified path',
      Write: 'Write content to a file at the specified path',
      Edit: 'Edit a file by replacing old_string with new_string',
      Bash: 'Execute a bash command in the shell',
      Glob: 'Find files matching a glob pattern',
      Grep: 'Search for a pattern in files',
      List: 'List files and directories at the specified path',
    };
    return descriptions[toolName] || `Tool: ${toolName}`;
  }

  /**
   * Get parameters schema for built-in tools
   */
  private getBuiltInToolParameters(toolName: string): Record<string, unknown> {
    const schemas: Record<string, Record<string, unknown>> = {
      Read: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file to read' },
        },
        required: ['path'],
      },
      Write: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file to write' },
          content: { type: 'string', description: 'Content to write to the file' },
        },
        required: ['path', 'content'],
      },
      Edit: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file to edit' },
          old_string: { type: 'string', description: 'String to replace' },
          new_string: { type: 'string', description: 'Replacement string' },
        },
        required: ['path', 'old_string', 'new_string'],
      },
      Bash: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Bash command to execute' },
        },
        required: ['command'],
      },
      Glob: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Glob pattern to match files' },
        },
        required: ['pattern'],
      },
      Grep: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Search pattern' },
          path: { type: 'string', description: 'Path to search in' },
        },
        required: ['pattern'],
      },
      List: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Directory path to list' },
        },
        required: ['path'],
      },
    };
    return schemas[toolName] || { type: 'object', properties: {} };
  }
}
