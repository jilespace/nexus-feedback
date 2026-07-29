import { Router } from 'express';
import { projectApiKeyAuth } from '../middleware/auth.js';
import { validateCreateFeedback, createFeedback } from '../services/feedback.js';
import { success } from '../utils/response.js';

export const feedbackRouter = Router();

feedbackRouter.get('/access', projectApiKeyAuth, async (req, res) => {
  success(res, {
    project: {
      id: req.project!.id,
      name: req.project!.name,
      slug: req.project!.slug,
    },
  });
});

feedbackRouter.post('/', projectApiKeyAuth, async (req, res, next) => {
  try {
    const body = { ...req.body, project_id: req.projectId };
    const input = await validateCreateFeedback(body);
    const source = (req.body.source as string) || 'api';
    const result = await createFeedback(input, req.projectId!, source);
    success(res, result, 201);
  } catch (err) {
    next(err);
  }
});
