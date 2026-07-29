import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { openapiSpec } from '../openapi.js';

export const swaggerRouter = Router();
swaggerRouter.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Nexus Feedback API',
}));
swaggerRouter.get('/openapi.json', (_req, res) => {
  res.json(openapiSpec);
});
