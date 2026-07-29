export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Nexus Feedback API',
    version: '1.0.0',
    description: '用户反馈收集平台 API',
  },
  servers: [{ url: '/api/v1' }],
  components: {
    securitySchemes: {
      ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
      BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          code: { type: 'integer', example: 40001 },
          message: { type: 'string', example: '参数错误' },
        },
      },
      Feedback: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          content: { type: 'string' },
          category: { type: 'string' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          status: { type: 'string', enum: ['open', 'in_progress', 'resolved', 'closed'] },
          source: { type: 'string' },
          vote_count: { type: 'integer' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  paths: {
    '/feedback': {
      post: {
        summary: '提交反馈',
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'content', 'category'],
                properties: {
                  title: { type: 'string', maxLength: 200 },
                  content: { type: 'string', maxLength: 5000 },
                  category: { type: 'string' },
                  priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
                  contact: { type: 'string', format: 'email' },
                  source: { type: 'string', enum: ['api', 'widget', 'submit-page'] },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: '创建成功' },
          '401': { description: '未授权' },
          '429': { description: '请求过于频繁' },
        },
      },
    },
    '/public/{projectSlug}/feedback': {
      post: {
        summary: '通过公开看板提交反馈',
        parameters: [{ name: 'projectSlug', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'content', 'category'],
                properties: {
                  title: { type: 'string' },
                  content: { type: 'string' },
                  category: { type: 'string' },
                  priority: { type: 'string' },
                  contact: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: '创建成功' },
          '400': { description: '参数错误' },
        },
      },
    },
    '/health': {
      get: {
        summary: '健康检查',
        responses: { '200': { description: '服务正常' } },
      },
    },
  },
};
