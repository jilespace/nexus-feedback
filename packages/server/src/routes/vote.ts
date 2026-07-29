import { Router } from 'express';
import { projectApiKeyAuth } from '../middleware/auth.js';
import { addVote, removeVote, hasVoted } from '../services/vote.js';
import { prisma } from '../db/client.js';
import { success } from '../utils/response.js';

export const voteRouter = Router();

voteRouter.post('/:id/vote', projectApiKeyAuth, async (req, res, next) => {
  try {
    const result = await addVote(req.params.id as string, req.body.email, req.projectId);
    success(res, result, 201);
  } catch (err) {
    next(err);
  }
});

voteRouter.delete('/:id/vote', projectApiKeyAuth, async (req, res, next) => {
  try {
    const result = await removeVote(req.params.id as string, req.body.email, req.projectId);
    success(res, result);
  } catch (err) {
    next(err);
  }
});

voteRouter.get('/:id/vote', projectApiKeyAuth, async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const email = req.query.email as string;
    const voted = await hasVoted(id, email, req.projectId);
    const feedback = await prisma.feedback.findFirst({
      where: { id, project_id: req.projectId },
      select: { vote_count: true },
    });
    success(res, { voted, vote_count: feedback?.vote_count ?? 0 });
  } catch (err) {
    next(err);
  }
});
