# Changelog - Z.ai Integration

## Version 1.0.0 - Z.ai GLM Integration

### Added

#### Z.ai GLM Provider (`apps/server/src/providers/glm-provider.ts`)
- Complete Z.ai GLM provider implementation using OpenAI-compatible API
- Support for GLM 4.7, GLM 4 Plus, GLM 4 Flash, GLM 4 Long, and GLM 4 Air models
- Dual endpoint support:
  - Coding Plan API: `https://api.z.ai/api/coding/paas/v4`
  - Standard Chat API: `https://chat.z.ai/api/chat`
- Automatic endpoint selection based on configured API key
- Streaming response support with delta parsing
- Vision/image input support
- Tool calling support for agentic workflows

#### GLM Tool Executor (`apps/server/src/providers/glm-tool-executor.ts`)
- Local tool execution for GLM agents
- Supported tools:
  - `Read` - Read file contents
  - `Write` - Write content to files
  - `Edit` - Find and replace in files
  - `Bash` - Execute shell commands (with safety checks)
  - `Glob` - Find files by pattern
  - `Grep` - Search for patterns in files
  - `List` - List directory contents
- Safety features:
  - Blocks dangerous kill commands (`lsof | kill`, `kill -9`, `pkill`)
  - Blocks background server processes (`npm run dev &`)
  - Prevents agents from killing Automaker server

#### GLM MCP Client (`apps/server/src/providers/glm-mcp-client.ts`)
- MCP (Model Context Protocol) server integration for GLM
- Connects to user-configured MCP servers
- Routes MCP tool calls from GLM to appropriate servers
- Supports stdio, SSE, and HTTP transport types
- 30-second connection timeout, 60-second call timeout

#### Provider Utilities (`libs/types/src/provider-utils.ts`)
- Added `isGlmModel()` function to detect GLM models
- Added `zai` to `PROVIDER_PREFIXES` constant
- Updated `getModelProvider()` to route GLM models to Z.ai provider

#### Settings Types (`libs/types/src/settings.ts`)
- Added `zai` API key field for Coding Plan subscription
- Added `zaiChat` API key field for standard subscription

#### Environment Configuration (`apps/server/.env.example`)
- Added `ZAI_API_KEY` placeholder for Coding Plan API
- Added `ZAI_CHAT_API_KEY` placeholder for Standard Chat API
- Added documentation comments explaining both endpoints

### Modified

#### Agent View (`apps/ui/src/components/views/agent-view.tsx`)
- Updated to default to GLM 4.7 when Z.ai profile is active
- Added useEffect to update model selection on profile change

#### Spec Generation (`apps/server/src/routes/app-spec/generate-spec.ts`)
- Added GLM model detection and routing
- Uses GLM provider when Z.ai profile is active

#### Feature Generation (`apps/server/src/routes/app-spec/generate-features-from-spec.ts`)
- Added GLM model detection and routing
- Uses GLM provider when Z.ai profile is active

### Stability Improvements

#### Retry Logic
- Added automatic retry with exponential backoff (2s, 4s, 8s)
- Maximum 3 retry attempts for transient network failures
- 2-minute fetch timeout per request

#### Message History Trimming
- Automatically trims conversation history when it exceeds 42 messages
- Keeps system prompt + last 40 messages
- Prevents context overflow and API timeouts

#### Error Handling
- Graceful handling of API connection failures
- Clear error messages for missing API keys
- Proper abort signal handling

### Security

- No hardcoded API keys in codebase
- All API keys stored in user settings or environment variables
- `.env` files excluded from git via `.gitignore`
- MCP servers use user-configured credentials

### Known Limitations

- Maximum 50 turns per agent session
- Some tools may have reduced functionality compared to Claude provider
- Extended thinking not yet supported for GLM models

---

## How to Upgrade

1. Pull the latest changes
2. Run `npm install` to update dependencies
3. Add your Z.ai API key in Settings > Providers > Z.ai
4. Set Z.ai as your active profile
5. Start using GLM models in Agent Runner and feature implementation

## API Key Configuration

### Option 1: Coding Plan Subscription
Set `ZAI_API_KEY` in environment or settings.
Uses endpoint: `https://api.z.ai/api/coding/paas/v4`

### Option 2: Standard Subscription
Set `ZAI_CHAT_API_KEY` in environment or settings.
Uses endpoint: `https://chat.z.ai/api/chat`

The provider automatically detects which key is configured and uses the appropriate endpoint.
