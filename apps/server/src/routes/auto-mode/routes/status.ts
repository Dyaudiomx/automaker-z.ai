/**
 * POST /status endpoint - Get auto mode status
 */

import type { Request, Response } from 'express';
import type { AutoModeService } from '../../../services/auto-mode-service.js';
import { getErrorMessage, logError } from '../common.js';

export function createStatusHandler(autoModeService: AutoModeService) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const status = autoModeService.getStatus();
      res.json({
        success: true,
        ...status,
      });
    } catch (error) {
      logError(error, 'Get status failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}
