// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { useAppStore } from '@/store/app-store';
import { useSetupStore } from '@/store/setup-store';
import { Info, Key, ExternalLink, CheckCircle2, XCircle, RefreshCw, Plug, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { syncCredentialsToServer } from '@/hooks/use-settings-migration';
import { toast } from 'sonner';

export function ZaiSettingsTab() {
  const { apiKeys, setApiKeys, phaseModels, setPhaseModels, setEnhancementModel, setValidationModel, mcpServers, addMCPServer, updateMCPServer } = useAppStore();
  const { zaiStatus, checkZaiStatus } = useSetupStore();
  const [apiKey, setApiKey] = useState(apiKeys?.zai || '');
  const [model, setModel] = useState(phaseModels?.enhancementModel?.model || 'glm-4.7');
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Auto-check status on mount if API key exists
  useEffect(() => {
    if (apiKeys?.zai && !zaiStatus) {
      checkZaiStatus(apiKeys.zai);
    }
  }, [apiKeys?.zai]);

  // Initialize model when phaseModels is loaded
  useEffect(() => {
    if (phaseModels?.enhancementModel?.model && !model) {
      setModel(phaseModels.enhancementModel.model);
    }
  }, [phaseModels?.enhancementModel?.model]);

  const handleSaveApiKey = async () => {
    if (apiKey.trim()) {
      setIsSaving(true);
      setApiKeys({ zai: apiKey.trim() });
      // Sync to server for persistence
      await syncCredentialsToServer({ zai: apiKey.trim() });
      // Check connection after saving
      setTimeout(async () => {
        await checkZaiStatus(apiKey.trim());
        setIsSaving(false);
      }, 100);
    }
  };

  const handleRefresh = async () => {
    const keyToTest = apiKey.trim() || apiKeys?.zai;
    if (!keyToTest) return;
    setIsTesting(true);
    await checkZaiStatus(keyToTest);
    setIsTesting(false);
  };

  const handleTestConnection = async () => {
    const keyToTest = apiKey.trim() || apiKeys?.zai;
    if (!keyToTest) return;
    setIsTesting(true);
    await checkZaiStatus(keyToTest);
    setIsTesting(false);
  };

  const handleModelChange = (value: string) => {
    setModel(value);
    // Update phase models to use Z.ai model
    setPhaseModels({
      enhancementModel: { model: value as any, thinkingLevel: 'none' },
      fileDescriptionModel: { model: value as any, thinkingLevel: 'none' },
      imageDescriptionModel: { model: value as any, thinkingLevel: 'none' },
      validationModel: { model: value as any, thinkingLevel: 'none' },
      specGenerationModel: { model: value as any, thinkingLevel: 'none' },
      featureGenerationModel: { model: value as any, thinkingLevel: 'none' },
      backlogPlanningModel: { model: value as any, thinkingLevel: 'none' },
      projectAnalysisModel: { model: value as any, thinkingLevel: 'none' },
      suggestionsModel: { model: value as any, thinkingLevel: 'none' },
      memoryExtractionModel: { model: value as any, thinkingLevel: 'none' },
    });
    // Update enhancement model to use Z.ai model
    setEnhancementModel(value as any);
    // Update validation model to use Z.ai model
    setValidationModel(value as any);
  };

  // Check if Z.ai MCP server is already configured
  const existingZaiMcp = mcpServers.find(s => s.name === 'zai-mcp-server' || s.command === 'npx' && s.args?.includes('@z_ai/mcp-server'));
  
  // Configure Z.ai MCP server for vision and other capabilities
  const handleConfigureMcpServer = () => {
    const currentApiKey = apiKey.trim() || apiKeys?.zai;
    if (!currentApiKey) {
      toast.error('Please save your Z.ai API key first');
      return;
    }

    if (existingZaiMcp) {
      // Update existing server with current API key
      updateMCPServer(existingZaiMcp.id, {
        env: {
          Z_AI_API_KEY: currentApiKey,
          Z_AI_MODE: 'ZAI',
        },
        enabled: true,
      });
      toast.success('Z.ai MCP server updated with current API key');
    } else {
      // Add new MCP server
      addMCPServer({
        name: 'zai-mcp-server',
        description: 'Z.ai vision, search, reader, and code tools for GLM models',
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@z_ai/mcp-server'],
        env: {
          Z_AI_API_KEY: currentApiKey,
          Z_AI_MODE: 'ZAI',
        },
        enabled: true,
      });
      toast.success('Z.ai MCP server configured! Go to Settings > MCP Servers to manage.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Z.ai Provider Card - Similar to Claude style */}
      <div
        className={cn(
          'rounded-2xl overflow-hidden',
          'border border-border/50',
          'bg-gradient-to-br from-card/90 via-card/70 to-card/80 backdrop-blur-xl',
          'shadow-sm shadow-black/5'
        )}
      >
        <div className="p-6 border-b border-border/50 bg-gradient-to-r from-transparent via-accent/5 to-transparent">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 flex items-center justify-center border border-cyan-500/20">
                <Key className="w-5 h-5 text-cyan-500" />
              </div>
              <h2 className="text-lg font-semibold text-foreground tracking-tight">
                Z.ai GLM Provider
              </h2>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isTesting}
              title="Refresh Z.ai connection status"
              className={cn(
                'h-9 w-9 rounded-lg',
                'hover:bg-accent/50 hover:scale-105',
                'transition-all duration-200'
              )}
            >
              <RefreshCw className={cn('w-4 h-4', isTesting && 'animate-spin')} />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground/80 ml-12">
            Z.ai GLM models for AI interactions using the Coding Plan API.
          </p>
        </div>

        <div className="p-6 space-y-4">
          {/* API Key Input */}
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Enter your Z.ai API key to enable GLM model support.
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your Z.ai API key"
                className="flex-1 px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <Button
                onClick={handleSaveApiKey}
                disabled={isSaving}
                className="px-4"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>

          {/* Authentication Status Card */}
          {zaiStatus?.connected ? (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center border border-emerald-500/20 shrink-0">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-emerald-400">Authenticated</p>
                <div className="text-xs text-emerald-400/70 mt-1.5">
                  <p>Method: <span className="font-mono">API Key</span></p>
                  <p>Endpoint: <span className="font-mono">Coding Plan API</span></p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="mt-3 h-8 text-xs"
                >
                  {isTesting ? 'Testing...' : 'Test Connection'}
                </Button>
              </div>
            </div>
          ) : zaiStatus?.error ? (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center border border-red-500/20 shrink-0">
                <XCircle className="w-5 h-5 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-red-400">Connection Failed</p>
                <p className="text-xs text-red-400/70 mt-1 break-words">
                  {zaiStatus.error}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="mt-3 h-8 text-xs"
                >
                  {isTesting ? 'Testing...' : 'Retry Connection'}
                </Button>
              </div>
            </div>
          ) : apiKeys?.zai ? (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center border border-amber-500/20 shrink-0">
                <XCircle className="w-5 h-5 text-amber-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-400">Not Verified</p>
                <p className="text-xs text-amber-400/70 mt-1">
                  API key saved. Click below to verify connection.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestConnection}
                  disabled={isTesting}
                  className="mt-3 h-8 text-xs"
                >
                  {isTesting ? 'Testing...' : 'Test Connection'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/30 border border-border/50">
              <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center border border-border/50 shrink-0">
                <Key className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">No API Key</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Enter your Z.ai API key above to get started.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Model Selection */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Info className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Model Selection</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Select the GLM model to use for AI interactions.
        </p>
        <select
          value={model}
          onChange={(e) => handleModelChange(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="glm-4.7">GLM 4.7 (Latest)</option>
          <option value="glm-4">GLM 4.0</option>
          <option value="glm-3-turbo">GLM 3 Turbo</option>
        </select>
      </div>

      {/* MCP Server Configuration */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Plug className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Vision & Tools (MCP Server)</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          GLM 4.7 requires an MCP server for vision (image analysis), web search, and other advanced tools.
          This uses the <code className="text-xs bg-muted px-1 py-0.5 rounded">@z_ai/mcp-server</code> package.
        </p>
        
        {existingZaiMcp ? (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-emerald-400">MCP Server Configured</p>
              <p className="text-xs text-emerald-400/70 mt-0.5">
                {existingZaiMcp.enabled ? 'Enabled' : 'Disabled'} • Tools: vision, search, reader, code
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleConfigureMcpServer}
              className="h-8 text-xs"
            >
              Update
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <Eye className="w-5 h-5 text-amber-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-400">MCP Server Not Configured</p>
              <p className="text-xs text-amber-400/70 mt-0.5">
                Required for image analysis, web search, and advanced tools
              </p>
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={handleConfigureMcpServer}
              disabled={!apiKeys?.zai && !apiKey.trim()}
              className="h-8 text-xs bg-cyan-600 hover:bg-cyan-700"
            >
              Configure
            </Button>
          </div>
        )}
        
        <p className="text-xs text-muted-foreground/70">
          <strong>Note:</strong> Requires Node.js v22+ installed. The MCP server runs locally via npx.
        </p>
      </div>

      {/* Documentation Link */}
      <div className="pt-4 border-t">
        <a
          href="https://docs.z.ai/devpack/tool/roo"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
          <span>View Z.ai Documentation</span>
        </a>
      </div>
    </div>
  );
}
