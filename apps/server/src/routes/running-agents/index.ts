/**
 * Running Agents routes - HTTP API for tracking active agent executions
 */

import { Router } from 'express';
import type { AutoModeService } from '../../services/auto-mode-service.js';
import { createIndexHandler } from './routes/index.js';

export function createRunningAgentsRoutes(autoModeService: AutoModeService): Router {
  const router = Router();

  router.get('/', createIndexHandler(autoModeService));

  return router;
}
