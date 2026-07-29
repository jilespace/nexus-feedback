# Nexus Feedback 开发规范

## 1. 总则

本规范适用于 Nexus Feedback 项目的全部代码。目标是保证代码风格一致、可维护、可协作。

---

## 2. 命名规范

### 2.1 文件与目录

| 类型 | 规范 | 示例 |
|------|------|------|
| 目录 | kebab-case | `feedback-list/`, `upload-service/` |
| React 组件文件 | PascalCase | `FeedbackCard.tsx`, `StatusBadge.tsx` |
| 工具/服务文件 | camelCase | `formatDate.ts`, `apiClient.ts` |
| 类型文件 | camelCase | `feedback.ts`, `common.ts` |
| 配置文件 | kebab-case 或标准名 | `vite.config.ts`, `tailwind.config.js` |
| 测试文件 | 同源文件 + `.test` / `.spec` | `FeedbackCard.test.tsx` |

### 2.2 变量与函数

| 类型 | 规范 | 示例 |
|------|------|------|
| 变量 | camelCase | `feedbackList`, `isLoading` |
| 常量 | UPPER_SNAKE_CASE | `MAX_FILE_SIZE`, `API_BASE_URL` |
| 函数 | camelCase + 动词开头 | `fetchFeedback()`, `handleSubmit()` |
| React 组件 | PascalCase | `FeedbackWidget` |
| React Hook | camelCase + `use` 前缀 | `useFeedback()`, `useAuth()` |
| 类型/接口 | PascalCase | `FeedbackItem`, `UploadResult` |
| 枚举成员 | UPPER_SNAKE_CASE | `FeedbackStatus.OPEN` |

### 2.3 数据库

| 类型 | 规范 | 示例 |
|------|------|------|
| 表名 | snake_case 单数 | `feedback`, `attachment` |
| 列名 | snake_case | `created_at`, `app_version` |
| 关联外键 | `{table}_id` | `feedback_id`, `project_id` |
| Prisma Model | PascalCase | `Feedback`, `Project` |

### 2.4 API

| 类型 | 规范 | 示例 |
|------|------|------|
| 路径 | kebab-case；集合接口通常用复数，`docs/API.md` 已定稿路径优先 | `/api/v1/feedback`, `/api/v1/admin/feedback/:id/replies` |
| 查询参数 | snake_case | `?page_size=20&app_version=1.0` |
| JSON 字段 | snake_case | `"app_version"`, `"created_at"` |

---

## 3. TypeScript 规范

### 3.1 严格模式

所有 `tsconfig.json` 必须启用：

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

### 3.2 类型优先于 Interface

```typescript
// ✅ 推荐
type FeedbackStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

type FeedbackItem = {
  id: string;
  title: string;
  status: FeedbackStatus;
  createdAt: string;
};

// ✅ 仅在需要声明合并（augmentation）时使用 interface
interface Window {
  __NEXUS_CONFIG__: NexusConfig;
}
```

### 3.3 禁止 any

```typescript
// ❌
function parse(data: any): any { ... }

// ✅
function parse(data: unknown): FeedbackItem { ... }

// ✅ 仅在第三方库类型缺失时使用 // @ts-expect-error 并附说明
```

### 3.4 导出规范

- 优先使用命名导出（named export）
- 仅在组件懒加载等必要场景使用默认导出

```typescript
// ✅
export const FeedbackCard = (props: FeedbackCardProps) => { ... };
export type { FeedbackCardProps };

// ❌ 避免默认导出（除非 React.lazy 需要）
export default FeedbackCard;
```

---

## 4. React 规范

### 4.0 UI 设计原则

Nexus Feedback 的 UI 必须现代化、美观、优雅，不能做成过度极简的空白界面。
后台是高频操作工具，应保持清晰的信息层级和足够的信息密度；公开提交页和
Widget 应显得可信、精致、完整。具体设计方向以 `docs/UI_GUIDELINES.md` 为准。

### 4.1 组件结构

```tsx
// 1. 导入（第三方库 → 别名导入 → 相对路径）
import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FeedbackCard } from '@/components/FeedbackCard';
import type { FeedbackItem } from '@/types';

// 2. 类型定义
type FeedbackListProps = {
  status?: FeedbackStatus;
  onItemClick?: (id: string) => void;
};

// 3. 组件定义
export const FeedbackList = ({ status, onItemClick }: FeedbackListProps) => {
  // 4. Hooks
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({...});

  // 5. 事件处理
  const handleClick = useCallback((id: string) => {
    onItemClick?.(id);
  }, [onItemClick]);

  // 6. 渲染
  if (isLoading) return <Loading />;

  return (
    <div className="space-y-4">
      {data?.items.map((item) => (
        <FeedbackCard key={item.id} feedback={item} onClick={handleClick} />
      ))}
    </div>
  );
};
```

### 4.2 Hooks 使用规则

- 自定义 Hook 必须以 `use` 开头
- Hook 内部不得有条件调用
- 数据获取统一使用 TanStack Query（React Query）
- 状态管理使用 React Context 或 Zustand（避免 Redux 过度工程）

### 4.3 Tailwind CSS

```tsx
// ✅ 标准写法
<div className="flex items-center gap-4 rounded-lg border p-4 shadow-sm">

// ✅ 条件样式
<div className={`px-3 py-1 text-sm rounded-full ${statusColorMap[status]}`}>

// ✅ 复杂条件用 clsx
<div className={clsx('px-3 py-1 text-sm rounded-full', {
  'bg-green-100 text-green-700': status === 'resolved',
  'bg-red-100 text-red-700': status === 'open',
})}>

// ❌ 避免内联 style（除非动态计算值）
<div style={{ color: 'red' }}>
```

---

## 5. Node.js / Express 规范

### 5.1 路由分层

```typescript
// routes/feedback.ts —— 只处理 HTTP 层
// services/feedback.ts —— 只处理业务逻辑
// db/schema.prisma —— 数据模型

// ✅ 路由中不做业务逻辑
router.post('/', authMiddleware, async (req, res) => {
  const result = await feedbackService.create(req.body, req.apiKey);
  res.json({ code: 0, data: result });
});
```

### 5.2 错误处理

```typescript
// 自定义错误类
class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: number,
    message: string,
  ) {
    super(message);
  }
}

class ValidationError extends AppError {
  constructor(message: string) {
    super(400, 40001, message);
  }
}

// 统一错误中间件（中间件链最后）
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      code: err.code,
      data: null,
      message: err.message,
    });
  }

  console.error('Unhandled error:', err);
  res.status(500).json({
    code: 50000,
    data: null,
    message: 'Internal server error',
  });
});
```

### 5.3 输入校验

```typescript
import { z } from 'zod';

const createFeedbackSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(5000),
  category: z.enum(['bug', 'feature', 'performance', 'ui', 'other']),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  contact: z.string().email().optional(),
  app_version: z.string().max(50).optional(),
  attachment_ids: z.array(z.string().uuid()).max(5).optional(),
});
```

---

## 6. Git 规范

### 6.1 分支策略

```
main          —— 生产就绪代码，禁止直接提交
  └── develop —— 开发主线，功能分支合入目标
       └── feature/xxx  —— 功能开发分支
       └── fix/xxx      —— 缺陷修复分支
       └── chore/xxx    —— 工程化调整分支
```

### 6.2 Commit Message

遵循 Conventional Commits：

```
<type>(<scope>): <subject>

type:
  feat     —— 新功能
  fix      —— 修复
  docs     —— 文档
  style    —— 格式（不影响代码逻辑）
  refactor —— 重构
  perf     —— 性能优化
  test     —— 测试
  chore    —— 构建/工具

示例：
  feat(server): add feedback submission API
  fix(admin): fix filter reset after page reload
  docs: add API documentation
  chore(deps): upgrade prisma to v5
```

### 6.3 Pull Request 规范

- 一个 PR 只做一件事
- PR 标题与 commit message 规范一致
- 描述包含：做了什么、为什么、测试方式
- 合并前必须通过 CI（lint + type check + test）

---

## 7. 代码质量工具

### 7.1 ESLint

```javascript
// eslint.config.js
import tseslint from 'typescript-eslint';

export default tseslint.config(
  tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      'no-console': ['warn', { allow: ['error'] }],
    },
  },
);
```

### 7.2 Prettier

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

### 7.3 预提交检查

使用 Husky + lint-staged：

```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md,yaml}": ["prettier --write"]
  }
}
```

---

## 8. 测试规范

### 8.1 测试要求

| 层级 | 工具 | 覆盖要求 |
|------|------|----------|
| 单元测试 | Vitest | Service 层全覆盖 |
| API 测试 | Supertest | 所有路由至少 1 个 Happy Path |
| 组件测试 | Vitest + Testing Library | 核心交互逻辑全覆盖 |
| E2E | Playwright | 核心流程（提交→查看→回复） |

### 8.2 测试文件组织

```
packages/server/src/services/feedback.ts
packages/server/src/services/__tests__/feedback.test.ts

packages/admin/src/components/FeedbackCard.tsx
packages/admin/src/components/__tests__/FeedbackCard.test.tsx
```

### 8.3 命名约定

```typescript
describe('FeedbackService', () => {
  describe('create', () => {
    it('should create feedback with valid input', async () => {});
    it('should throw ValidationError when title is empty', async () => {});
    it('should reject when API key is invalid', async () => {});
  });
});
```

---

## 9. 环境与配置管理

### 9.1 配置优先级

```
环境变量 > .env.local > .env > 代码默认值
```

### 9.2 配置验证

```typescript
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().default(3000),
  STORAGE_TYPE: z.enum(['s3', 'oss', 'local']).default('local'),
  MAX_FILE_SIZE: z.coerce.number().default(10 * 1024 * 1024),
});

export const env = envSchema.parse(process.env);
```

---

## 10. 日志规范

```typescript
// 使用结构化日志
const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => {
    console.log(JSON.stringify({ level: 'info', msg, ...meta, ts: new Date().toISOString() }));
  },
  warn: (msg: string, meta?: Record<string, unknown>) => {
    console.warn(JSON.stringify({ level: 'warn', msg, ...meta, ts: new Date().toISOString() }));
  },
  error: (msg: string, meta?: Record<string, unknown>) => {
    console.error(JSON.stringify({ level: 'error', msg, ...meta, ts: new Date().toISOString() }));
  },
};

// 使用示例
logger.info('Feedback created', { feedbackId: 'fb-abc', appId: 'app-xyz' });
logger.error('Storage upload failed', { filename: 'test.png', error: err.message });
```

禁止记录：密码、API Key、用户联系方式等敏感信息。

---

## 11. 包管理

- 使用 pnpm Workspace 管理 Monorepo
- `pnpm-workspace.yaml` 定义所有 workspace 包
- 共享依赖（React、TypeScript、ESLint 等）提取到根目录 `package.json`
- 版本锁定：提交 `pnpm-lock.yaml`

---

## 12. 文档要求

| 文档 | 位置 | 要求 |
|------|------|------|
| 开发文档 | `DEVELOPMENT.md` | 架构、API、数据库、部署 |
| 开发规范 | `STANDARDS.md`（本文档） | 代码风格、流程规范 |
| 项目状态 | `docs/PROJECT_STATUS.md` | 当前阶段、目标结构、第一阶段验收 |
| 运行手册 | `docs/RUNBOOK.md` | 本地命令、端口、健康检查 |
| API 文档 | `docs/API.md` | 所有接口及请求/响应示例 |
| 认证安全 | `docs/AUTH_AND_SECURITY.md` | API Key、JWT、CORS、上传、日志安全 |
| 数据规则 | `docs/DATA_RULES.md` | 枚举、状态流转、附件、回复、删除策略 |
| 测试验收 | `docs/TESTING.md` | 测试命令、验收用例、UI 验收 |
| 部署运维 | `docs/DEPLOYMENT.md` | 环境变量、迁移、健康检查、发布清单 |
| Widget 文档 | `docs/WIDGET.md` | Widget 接入指南和 API 参数 |
| UI 规范 | `docs/UI_GUIDELINES.md` | 现代化视觉、交互、响应式、可访问性 |
| README | 根目录 | 项目简介、快速开始、架构图 |

当实现改变接口、认证、环境变量、业务规则、UI 方向或测试命令时，必须在同一
次变更中更新对应文档。

---

## 13. 安全清单

- [ ] 所有用户输入使用 zod 校验
- [ ] API Key 使用 crypto.randomUUID() 生成，数据库存储 SHA-256 哈希
- [ ] 文件上传校验 MIME 类型（非仅依赖文件扩展名）
- [ ] 管理后台 JWT Token 设置合理过期时间（建议 24h）
- [ ] `helmet` 中间件设置安全 HTTP 头
- [ ] 生产环境关闭 CORS `*`，使用白名单
- [ ] `.env` 文件加入 `.gitignore`
- [ ] Prisma 查询不使用原始 SQL（raw query）拼接用户输入
