/**
 * POST /stop endpoint - Stop generation
 */

import type { Request, Response } from 'express';
import { getSpecRegenerationStatus, setRunningState, getErrorMessage } from '../common.js';

export function createStopHandler() {
  return async (_req: Request, res: Response): Promise<void> => {
    try {
      const { currentAbortController } = getSpecRegenerationStatus();
      if (currentAbortController) {
        currentAbortController.abort();
      }
      setRunningState(false, null);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: getErrorMessage(error) });
    }
  };
}
