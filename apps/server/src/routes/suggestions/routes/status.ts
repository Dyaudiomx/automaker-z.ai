/**
 * GET /status endpoint - Get status
 */

import type { Request, Response } from 'express';
import { getSuggestionsStatus, getErrorMessage, logError } from '../common.js';

export function createStatusHandler() {
  return async (_req: Request, res: Response): Promise<void> => {
    try {
      const { isRunning } = getSuggestionsStatus();
      res.json({ success: true, isRunning });
    } catch (error) {
      logError(error, 'Get status failed');
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}
