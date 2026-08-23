import { Router } from 'express';
import { projectApiKeyAuth } from '../middleware/auth.js';
import { success } from '../utils/response.js';
import { getBoardConfig } from '../services/boardConfig.js';

export const widgetConfigRouter = Router();

widgetConfigRouter.get('/config', projectApiKeyAuth, async (req, res, next) => {
  try {
    const config = await getBoardConfig(req.project!);
    res.set('Cache-Control', 'public, max-age=60');
    success(res, config);
  } catch (err) {
    next(err);
  }
});
