/**
 * GLM Tool Executor
 * 
 * Executes tools locally for GLM provider to enable agentic behavior.
 * This provides basic tool implementations that allow GLM to read files,
 * execute commands, and interact with the filesystem.
 * Also supports MCP tools when MCP servers are configured.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '@automaker/utils';
import { getGlmMcpClient } from './glm-mcp-client.js';

const logger = createLogger('GlmToolExecutor');

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * Execute a tool and return the result
 * Supports both built-in tools and MCP tools
 */
export async function executeTool(
  toolCall: ToolCall,
  cwd: string
): Promise<ToolResult> {
  const { name, input } = toolCall;
  
  logger.info(`[GLM-TOOL] Executing tool: ${name}`, input);

  // Check if this is an MCP tool first
  const mcpClient = getGlmMcpClient();
  if (mcpClient.isMcpTool(name)) {
    logger.info(`[GLM-TOOL] Routing to MCP tool: ${name}`);
    return await mcpClient.callTool(name, input);
  }

  try {
    switch (name.toLowerCase()) {
      case 'read':
        return await executeRead(input, cwd);
      case 'write':
        return await executeWrite(input, cwd);
      case 'edit':
        return await executeEdit(input, cwd);
      case 'bash':
        return await executeBash(input, cwd);
      case 'glob':
        return await executeGlob(input, cwd);
      case 'grep':
        return await executeGrep(input, cwd);
      case 'list':
      case 'ls':
        return await executeList(input, cwd);
      default:
        // Check MCP tools again for the error message
        const mcpTools = mcpClient.getAllTools();
        const mcpToolNames = mcpTools.map(t => t.name).join(', ');
        return {
          success: false,
          output: '',
          error: `Unknown tool: ${name}. Built-in tools: Read, Write, Edit, Bash, Glob, Grep, List. MCP tools: ${mcpToolNames || 'none configured'}`,
        };
    }
  } catch (error) {
    logger.error(`[GLM-TOOL] Error executing ${name}:`, error);
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Read file contents
 */
async function executeRead(
  input: Record<string, unknown>,
  cwd: string
): Promise<ToolResult> {
  const filePath = (input.file_path || input.path || input.file) as string;
  if (!filePath) {
    return { success: false, output: '', error: 'file_path is required' };
  }

  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
  
  try {
    const content = fs.readFileSync(fullPath, 'utf-8');
    return { success: true, output: content };
  } catch (error) {
    return {
      success: false,
      output: '',
      error: `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Write file contents
 */
async function executeWrite(
  input: Record<string, unknown>,
  cwd: string
): Promise<ToolResult> {
  const filePath = (input.file_path || input.path || input.file) as string;
  const content = (input.content || input.text || input.data) as string;
  
  if (!filePath) {
    return { success: false, output: '', error: 'file_path is required' };
  }
  if (content === undefined) {
    return { success: false, output: '', error: 'content is required' };
  }

  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
  
  try {
    // Ensure directory exists
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(fullPath, content, 'utf-8');
    return { success: true, output: `Successfully wrote to ${filePath}` };
  } catch (error) {
    return {
      success: false,
      output: '',
      error: `Failed to write file: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Edit file with find/replace
 */
async function executeEdit(
  input: Record<string, unknown>,
  cwd: string
): Promise<ToolResult> {
  const filePath = (input.file_path || input.path || input.file) as string;
  const oldStr = (input.old_string || input.old || input.find) as string;
  const newStr = (input.new_string || input.new || input.replace) as string;
  
  if (!filePath) {
    return { success: false, output: '', error: 'file_path is required' };
  }
  if (oldStr === undefined) {
    return { success: false, output: '', error: 'old_string is required' };
  }
  if (newStr === undefined) {
    return { success: false, output: '', error: 'new_string is required' };
  }

  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
  
  try {
    let content = fs.readFileSync(fullPath, 'utf-8');
    
    if (!content.includes(oldStr)) {
      return {
        success: false,
        output: '',
        error: `Could not find the specified text in the file. Make sure old_string matches exactly.`,
      };
    }
    
    content = content.replace(oldStr, newStr);
    fs.writeFileSync(fullPath, content, 'utf-8');
    return { success: true, output: `Successfully edited ${filePath}` };
  } catch (error) {
    return {
      success: false,
      output: '',
      error: `Failed to edit file: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Check if command could kill the Automaker server or cause system issues
 */
function isDangerousCommand(command: string): { dangerous: boolean; reason?: string } {
  const lowerCmd = command.toLowerCase();
  
  // Block ANY lsof piped to kill/xargs (could kill Automaker or Electron processes)
  if (lowerCmd.includes('lsof') && (lowerCmd.includes('kill') || lowerCmd.includes('xargs'))) {
    return { dangerous: true, reason: 'Cannot use lsof to kill processes - may affect Automaker server' };
  }
  
  // Block kill -9 commands (too aggressive)
  if (lowerCmd.includes('kill -9') || lowerCmd.includes('kill -KILL')) {
    return { dangerous: true, reason: 'Cannot use kill -9 - use gentler termination methods' };
  }
  
  // Block pkill/killall without specific process names (too broad)
  if ((lowerCmd.includes('pkill') || lowerCmd.includes('killall')) && 
      !lowerCmd.includes('next') && !lowerCmd.includes('node')) {
    // Allow killing specific dev processes like 'next dev' or 'node'
    if (lowerCmd.includes('pkill -f') || lowerCmd.includes('killall')) {
      return { dangerous: true, reason: 'Cannot use broad kill commands - be more specific' };
    }
  }
  
  // Block rm -rf on root or home directories
  if (lowerCmd.includes('rm -rf /') && !lowerCmd.includes('rm -rf /.')) {
    return { dangerous: true, reason: 'Cannot remove root directory' };
  }
  
  // Block background server processes (& at end) - they cause port conflicts
  if (lowerCmd.includes('npm run dev') && lowerCmd.includes('&')) {
    return { dangerous: true, reason: 'Cannot start background dev servers - use Automaker dev server feature instead' };
  }
  
  // Block npm start/dev in background
  if ((lowerCmd.includes('npm start') || lowerCmd.includes('npm run start')) && lowerCmd.includes('&')) {
    return { dangerous: true, reason: 'Cannot start background servers - use Automaker dev server feature instead' };
  }
  
  return { dangerous: false };
}

/**
 * Execute bash command
 */
async function executeBash(
  input: Record<string, unknown>,
  cwd: string
): Promise<ToolResult> {
  const command = (input.command || input.cmd) as string;
  
  if (!command) {
    return { success: false, output: '', error: 'command is required' };
  }

  // Check for dangerous commands
  const dangerCheck = isDangerousCommand(command);
  if (dangerCheck.dangerous) {
    return { 
      success: false, 
      output: '', 
      error: dangerCheck.reason || 'Command blocked for safety' 
    };
  }

  // Add homebrew paths to ensure commands like npm, node are found
  const env = {
    ...process.env,
    PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || ''}`,
  };

  try {
    const output = execSync(command, {
      cwd,
      env,
      encoding: 'utf-8',
      timeout: 30000, // 30 second timeout (reduced to avoid long waits)
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      shell: '/bin/zsh', // Use zsh for better PATH handling
    });
    return { success: true, output: output.trim() };
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string; message?: string; killed?: boolean };
    const stdout = execError.stdout || '';
    const stderr = execError.stderr || '';
    
    // Handle timeout
    if (execError.killed) {
      return {
        success: false,
        output: stdout,
        error: 'Command timed out after 30 seconds',
      };
    }
    
    return {
      success: false,
      output: stdout,
      error: stderr || execError.message || 'Command failed',
    };
  }
}

/**
 * Find files using glob pattern
 */
async function executeGlob(
  input: Record<string, unknown>,
  cwd: string
): Promise<ToolResult> {
  const pattern = (input.pattern || input.glob) as string;
  
  if (!pattern) {
    return { success: false, output: '', error: 'pattern is required' };
  }

  try {
    // Use find command to simulate glob
    const output = execSync(`find . -name "${pattern}" -type f 2>/dev/null | head -100`, {
      cwd,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    });
    return { success: true, output: output.trim() || 'No files found' };
  } catch (error) {
    return {
      success: false,
      output: '',
      error: `Glob failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Search in files using grep
 */
async function executeGrep(
  input: Record<string, unknown>,
  cwd: string
): Promise<ToolResult> {
  const pattern = (input.pattern || input.query || input.search) as string;
  const searchPath = (input.path || input.directory || '.') as string;
  
  if (!pattern) {
    return { success: false, output: '', error: 'pattern is required' };
  }

  try {
    const fullPath = path.isAbsolute(searchPath) ? searchPath : path.join(cwd, searchPath);
    const output = execSync(`grep -r -n "${pattern}" "${fullPath}" 2>/dev/null || true`, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    });
    return { success: true, output: output.trim() || 'No matches found' };
  } catch (error) {
    return {
      success: false,
      output: '',
      error: `Grep failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * List directory contents
 */
async function executeList(
  input: Record<string, unknown>,
  cwd: string
): Promise<ToolResult> {
  const dirPath = (input.path || input.directory || '.') as string;
  
  const fullPath = path.isAbsolute(dirPath) ? dirPath : path.join(cwd, dirPath);
  
  try {
    const entries = fs.readdirSync(fullPath, { withFileTypes: true });
    const output = entries
      .map((entry) => {
        const prefix = entry.isDirectory() ? '[DIR]' : '[FILE]';
        return `${prefix} ${entry.name}`;
      })
      .join('\n');
    return { success: true, output };
  } catch (error) {
    return {
      success: false,
      output: '',
      error: `Failed to list directory: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
