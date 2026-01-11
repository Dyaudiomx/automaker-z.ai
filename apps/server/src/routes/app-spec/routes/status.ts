/**
 * GET /status endpoint - Get generation status
 */

import type { Request, Response } from 'express';
import { getSpecRegenerationStatus, getErrorMessage } from '../common.js';

export function createStatusHandler() {
  return async (_req: Request, res: Response): Promise<void> => {
    try {
      const { isRunning } = getSpecRegenerationStatus();
      res.json({ success: true, isRunning });
    } catch (error) {
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}
