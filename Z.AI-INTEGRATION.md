# Automaker Z.ai Integration

This fork of Automaker includes full integration with Z.ai's GLM models, enabling agentic AI-powered development workflows using Z.ai's GLM 4.7 and other models.

## What's New in This Release

### Z.ai GLM Provider

A complete GLM provider implementation that supports:

- **GLM 4.7** - Latest model with advanced reasoning and tool calling
- **GLM 4 Plus** - High capability model  
- **GLM 4 Flash** - Fast, efficient model for quick tasks
- **GLM 4 Long** - Extended context window (1M tokens)
- **GLM 4 Air** - Lightweight, cost-effective model

### Dual API Endpoint Support

The provider supports **two Z.ai API endpoints**:

1. **Coding Plan API** (`https://api.z.ai/api/coding/paas/v4`)
   - For users with Z.ai Coding Plan subscription
   - Set your API key as `ZAI_API_KEY` in settings

2. **Standard Chat API** (`https://chat.z.ai/api/chat`)
   - For users with standard Z.ai subscription
   - Set your API key as `ZAI_CHAT_API_KEY` in settings

The provider automatically detects which key is configured and uses the appropriate endpoint.

### Agentic Tool Execution

GLM agents can execute tools locally including:

| Tool | Description |
|------|-------------|
| Read | Read file contents |
| Write | Write content to files |
| Edit | Find and replace in files |
| Bash | Execute shell commands |
| Glob | Find files by pattern |
| Grep | Search for patterns in files |
| List | List directory contents |

### MCP Server Support

GLM agents integrate with Model Context Protocol (MCP) servers, allowing:

- Web browsing capabilities
- Custom tool integrations
- Any MCP-compatible service

MCP servers are configured through Automaker settings and use **your API keys** - no hardcoded credentials.

### Safety Features

- **Dangerous command blocking**: Prevents agents from running destructive commands
- **Background server blocking**: Prevents port conflicts from background processes
- **Retry logic**: Automatic retry with exponential backoff for network failures
- **Message trimming**: Prevents context overflow in long conversations

## Setup Instructions

### 1. Clone and Install

```bash
git clone https://github.com/YOUR_USERNAME/automaker-Z.ai.git
cd automaker-Z.ai
npm install
```

### 2. Configure Environment

Copy the example environment file:

```bash
cp apps/server/.env.example apps/server/.env
```

Edit `apps/server/.env` and add your API keys:

```bash
# For Z.ai Coding Plan subscription
ZAI_API_KEY=your-coding-plan-api-key

# OR for standard Z.ai subscription
ZAI_CHAT_API_KEY=your-standard-api-key

# Optional: Other provider keys
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

### 3. Run the Application

```bash
# Development mode
npm run dev

# Production build
npm run build
npm start
```

### 4. Configure in UI

1. Open Automaker
2. Go to **Settings > Providers > Z.ai**
3. Enter your API key
4. Select your preferred GLM model
5. Set Z.ai as your active profile

## Files Changed

### New Files

| File | Description |
|------|-------------|
| `apps/server/src/providers/glm-provider.ts` | Z.ai GLM provider implementation |
| `apps/server/src/providers/glm-tool-executor.ts` | Local tool execution for GLM agents |
| `apps/server/src/providers/glm-mcp-client.ts` | MCP server integration for GLM |

### Modified Files

| File | Changes |
|------|---------|
| `libs/types/src/provider-utils.ts` | Added `isGlmModel()` function and Z.ai provider detection |
| `libs/types/src/settings.ts` | Added `zai` and `zaiChat` API key types |
| `apps/server/.env.example` | Added Z.ai API key placeholders |
| `apps/ui/src/components/views/agent-view.tsx` | GLM model selection support |
| `apps/server/src/routes/app-spec/generate-spec.ts` | GLM support for spec generation |
| `apps/server/src/routes/app-spec/generate-features-from-spec.ts` | GLM support for feature generation |

## Security Notes

- **No hardcoded API keys**: All API keys are stored in user settings or environment variables
- **.env files are gitignored**: Your credentials are never committed
- **MCP servers use your keys**: Configure MCP servers through settings, they use your API keys

## API Key Sources

1. **Settings UI**: Enter keys in Settings > Providers
2. **Environment Variables**: Set in `.env` file or shell
3. **Settings File**: Stored encrypted in user data directory

## Troubleshooting

### "Z.ai API key not configured"

Add your API key in Settings > Providers > Z.ai, or set `ZAI_API_KEY` environment variable.

### "fetch failed" errors

- Check your internet connection
- Verify your API key is valid
- The provider will retry automatically up to 3 times

### Agent stops responding

- Check server logs for errors
- Message history is automatically trimmed to prevent context overflow
- Maximum 50 turns per agent session

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npm run build` to verify no TypeScript errors
5. Submit a pull request

## License

Same license as the original Automaker project.
