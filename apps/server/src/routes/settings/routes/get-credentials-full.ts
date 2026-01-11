/**
 * GET /api/settings/credentials/full - Get full API keys for client hydration
 *
 * Returns actual API keys for populating the client store on startup.
 * This endpoint is only accessible from the local app (not exposed externally).
 *
 * Response: `{ "success": true, "apiKeys": { anthropic, google, openai, zai } }`
 */

import type { Request, Response } from 'express';
import type { SettingsService } from '../../../services/settings-service.js';
import { getErrorMessage, logError } from '../common.js';

/**
 * Create handler factory for GET /api/settings/credentials/full
 *
 * @param settingsService - Instance of SettingsService for file I/O
 * @returns Express request handler
 */
export function createGetCredentialsFullHandler(settingsService: SettingsService) {
  return async (_req: Request, res: Response): Promise<void> => {
    try {
      const credentials = await settingsService.getCredentials();

      res.json({
        success: true,
        apiKeys: credentials.apiKeys,
      });
    } catch (error) {
      logError(error, 'Get full credentials failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}
