# Nexus Feedback 开发文档

## 0. 文档定位

本文档描述 Nexus Feedback 的目标架构和模块设计。当前仓库可能仍处于文档
阶段；实际实现状态以 `docs/PROJECT_STATUS.md` 为准。

更细的契约以 `docs/` 下的专题文档为准：

- API 契约：`docs/API.md`
- 认证与安全：`docs/AUTH_AND_SECURITY.md`
- 数据与业务规则：`docs/DATA_RULES.md`
- 本地运行：`docs/RUNBOOK.md`
- 测试验收：`docs/TESTING.md`
- 部署运维：`docs/DEPLOYMENT.md`
- Widget 接入：`docs/WIDGET.md`
- UI 规范：`docs/UI_GUIDELINES.md`

如果本文档与专题文档冲突，优先采用专题文档，并同步修正文档冲突。

## 1. 项目概述

Nexus Feedback 是一套面向开发者的用户建议反馈系统，提供标准化的 HTTP API 接口，支持桌面应用、Web 应用、后台服务等多种客户端接入。反馈数据统一存储、统一管理。

### 1.1 核心特性

- **多端接入**：桌面应用（Electron/WPF 等）、Web 应用（JS SDK）、后台服务，均通过 HTTP API 提交反馈
- **标准反馈模型**：标题 + 正文 + 分类标签 + 优先级 + 联系方式
- **可嵌入 Widget**：React 组件形式的反馈提交按钮，第三方 Web 应用可直接嵌入
- **公开提交页**：独立 URL 的反馈提交页面，用户通过链接直接访问
- **管理后台**：反馈列表、筛选、状态管理、回复、数据统计
- **API Key 认证**：每个接入应用分配唯一 Key，Header 中携带
- **云存储**：附件（截图等）上传至 S3/OSS，预留本地存储适配接口

### 1.2 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 后端框架 | Node.js + Express | RESTful API 服务 |
| 数据库 | PostgreSQL | 反馈数据持久化 |
| 前端框架 | React 18 + TypeScript | 管理后台 + Widget + 公开页 |
| 样式方案 | Tailwind CSS | 原子化 CSS |
| 构建工具 | Vite | 前端构建 |
| ORM | Prisma | 数据库操作 |
| 文件存储 | AWS S3 / 阿里云 OSS | 附件存储，适配器模式 |
| 部署 | Docker Compose | 容器化部署 |

---

## 2. 系统架构

```
┌───────────────────────────────────────────────────────────┐
│                      调用方 / 接入层                        │
├───────────┬───────────┬───────────┬───────────┬───────────┤
│  桌面应用  │  Web 应用  │ 后台服务  │   Widget  │ 公开页面  │
│ (Electron) │ (JS SDK)  │ (HTTP)    │ (嵌入)    │ (独立)    │
└─────┬─────┴─────┬─────┴─────┬─────┴─────┬─────┴─────┬─────┘
      │           │           │           │           │
      └───────────┴───────────┴─────┬─────┴───────────┘
                                    │
                          ┌─────────▼─────────┐
                          │    API Server      │
                          │  (Node/Express)    │
                          │  ┌───────────────┐ │
                          │  │ Auth Middleware│ │
                          │  │ (API Key)      │ │
                          │  ├───────────────┤ │
                          │  │ Feedback CRUD │ │
                          │  ├───────────────┤ │
                          │  │ File Upload   │ │
                          │  └───────┬───────┘ │
                          └──────────┼─────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
           ┌────────▼────────┐ ┌────▼─────┐ ┌───────▼──────┐
           │   PostgreSQL    │ │  S3/OSS  │ │  React Admin │
           │   (反馈数据)     │ │ (附件)   │ │  (管理后台)   │
           └─────────────────┘ └──────────┘ └──────────────┘
```

---

## 3. 目录结构

```
nexus-feedback/
├── packages/
│   ├── server/                    # 后端 API 服务
│   │   ├── src/
│   │   │   ├── index.ts           # 入口文件
│   │   │   ├── app.ts             # Express 应用配置
│   │   │   ├── config/            # 配置管理
│   │   │   │   └── index.ts
│   │   │   ├── middleware/        # 中间件
│   │   │   │   ├── auth.ts        # API Key 验证
│   │   │   │   ├── error.ts       # 错误处理
│   │   │   │   └── rateLimit.ts   # 限流
│   │   │   ├── routes/            # 路由
│   │   │   │   ├── feedback.ts    # 反馈 CRUD
│   │   │   │   ├── upload.ts      # 文件上传
│   │   │   │   └── admin.ts       # 管理端接口
│   │   │   ├── services/          # 业务逻辑
│   │   │   │   ├── feedback.ts
│   │   │   │   ├── storage.ts     # 云存储适配器
│   │   │   │   └── notification.ts
│   │   │   ├── db/
│   │   │   │   └── schema.prisma  # Prisma Schema
│   │   │   └── utils/             # 工具函数
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── admin/                     # React 管理后台
│   │   ├── src/
│   │   │   ├── main.tsx
│   │   │   ├── App.tsx
│   │   │   ├── pages/
│   │   │   │   ├── Dashboard.tsx      # 统计看板
│   │   │   │   ├── FeedbackList.tsx   # 反馈列表
│   │   │   │   ├── FeedbackDetail.tsx # 反馈详情
│   │   │   │   └── Login.tsx          # 登录页
│   │   │   ├── components/
│   │   │   │   ├── Layout.tsx
│   │   │   │   ├── FeedbackCard.tsx
│   │   │   │   ├── StatusBadge.tsx
│   │   │   │   └── FilterBar.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useFeedback.ts
│   │   │   │   └── useAuth.ts
│   │   │   ├── api/
│   │   │   │   └── client.ts
│   │   │   └── types/
│   │   │       └── index.ts
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   └── tailwind.config.js
│   │
│   ├── widget/                    # 可嵌入的反馈 Widget
│   │   ├── src/
│   │   │   ├── index.tsx          # Widget 入口
│   │   │   ├── FeedbackWidget.tsx
│   │   │   ├── FeedbackForm.tsx
│   │   │   └── styles.css
│   │   ├── package.json
│   │   └── vite.config.ts         # 打包为 IIFE/ESM
│   │
│   └── submit-page/               # 公开反馈提交页
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   └── components/
│       │       └── SubmitForm.tsx
│       ├── package.json
│       └── vite.config.ts
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 4. API 接口设计

本节是 API 概览。正式字段规则、认证方式、错误码、分页结构和完整响应示例
见 `docs/API.md`。

### 4.1 基础规范

- Base URL: `/api/v1`
- Content-Type: `application/json`
- 外部提交认证方式：请求头 `X-API-Key: <your-api-key>`
- 管理端认证方式：请求头 `Authorization: Bearer <admin-jwt>`
- 响应格式：

```json
// 成功
{ "code": 0, "data": {...}, "message": "ok" }

// 失败
{ "code": 40001, "data": null, "message": "error description" }
```

### 4.2 错误码

| code | 含义 |
|------|------|
| 0 | 成功 |
| 40001 | 参数校验失败 |
| 40100 | API Key 缺失 |
| 40101 | API Key 无效 |
| 40300 | 权限不足 |
| 40400 | 资源不存在 |
| 42900 | 请求过于频繁 |
| 50000 | 服务器内部错误 |

### 4.3 接口列表

#### 4.3.1 提交反馈

```
POST /api/v1/feedback
```

请求体：
```json
{
  "title": "首页加载速度过慢",
  "content": "打开首页需要等待约5秒，建议优化",
  "category": "performance",
  "priority": "medium",
  "contact": "user@example.com",
  "app_version": "1.2.3",
  "attachment_ids": ["file-uuid-1", "file-uuid-2"]
}
```

响应：
```json
{
  "code": 0,
  "data": {
    "id": "fb-abc123",
    "title": "首页加载速度过慢",
    "status": "open",
    "created_at": "2026-05-23T10:30:00Z"
  }
}
```

#### 4.3.2 上传附件

```
POST /api/v1/upload
Content-Type: multipart/form-data
```

参数：`file`（文件字段）

响应：
```json
{
  "code": 0,
  "data": {
    "id": "file-uuid-1",
    "url": "https://oss.example.com/uploads/abc.png",
    "filename": "screenshot.png",
    "size": 245760,
    "mime_type": "image/png"
  }
}
```

#### 4.3.3 获取反馈列表（管理端）

```
GET /api/v1/admin/feedback?status=open&category=bug&page=1&page_size=20
```

#### 4.3.4 获取反馈详情

```
GET /api/v1/admin/feedback/:id
```

#### 4.3.5 更新反馈状态

```
PATCH /api/v1/admin/feedback/:id/status
```

请求体：
```json
{
  "status": "in_progress"
}
```

#### 4.3.6 回复反馈

```
POST /api/v1/admin/feedback/:id/replies
```

请求体：
```json
{
  "content": "感谢反馈，我们已确认此问题，将在下个版本修复。"
}
```

#### 4.3.7 统计数据

```
GET /api/v1/admin/stats
```

响应：
```json
{
  "code": 0,
  "data": {
    "total": 256,
    "open": 42,
    "in_progress": 15,
    "resolved": 180,
    "closed": 19,
    "by_category": { "bug": 80, "feature": 60, "performance": 30 },
    "by_week": [
      { "week": "2026-W20", "count": 12 },
      { "week": "2026-W21", "count": 18 }
    ]
  }
}
```

---

## 5. 数据库设计

### 5.1 Prisma Schema

```prisma
model Project {
  id              String     @id @default(cuid())
  name            String
  slug            String
  api_key_hash    String     @unique
  api_key_prefix  String     @default("")
  allowed_origins String[]
  org_id          String
  created_at      DateTime   @default(now())
  feedbacks Feedback[]
  attachments Attachment[]
}

model Feedback {
  id           String     @id @default(cuid())
  title        String
  content      String
  category     String     // bug, feature, performance, ui, other
  priority     String     @default("medium") // low, medium, high, critical
  status       String     @default("open")   // open, in_progress, resolved, closed
  contact      String?
  app_version  String?
  project_id   String
  project      Project @relation(fields: [project_id], references: [id])
  attachments  Attachment[]
  replies      Reply[]
  created_at   DateTime   @default(now())
  updated_at   DateTime   @updatedAt
}

model Attachment {
  id          String   @id @default(cuid())
  feedback_id String?
  feedback    Feedback? @relation(fields: [feedback_id], references: [id])
  project_id  String
  project     Project @relation(fields: [project_id], references: [id])
  filename    String
  url         String
  size        Int
  mime_type   String
  created_at  DateTime @default(now())
}

model Reply {
  id          String   @id @default(cuid())
  feedback_id String
  feedback    Feedback @relation(fields: [feedback_id], references: [id])
  content     String
  created_at  DateTime @default(now())
}

model Admin {
  id           String   @id @default(cuid())
  username     String   @unique
  password_hash String
  created_at   DateTime @default(now())
}
```

### 5.2 状态流转

```
open ──→ in_progress ──→ resolved
  │                         │
  └──────→ closed ←─────────┘
```

---

## 6. 存储适配器设计

```typescript
// packages/server/src/services/storage.ts

interface StorageAdapter {
  upload(file: Buffer, filename: string, mimeType: string): Promise<UploadResult>;
  getUrl(key: string): string;
  delete(key: string): Promise<void>;
}

interface UploadResult {
  key: string;
  url: string;
}

// S3 实现
class S3StorageAdapter implements StorageAdapter { ... }

// 阿里云 OSS 实现
class OSSStorageAdapter implements StorageAdapter { ... }

// 本地存储（开发/小规模使用）
class LocalStorageAdapter implements StorageAdapter { ... }
```

通过环境变量 `STORAGE_TYPE=s3|oss|local` 切换。

---

## 7. Widget 接入方式

本节是接入概览。完整 props、IIFE 接入、状态要求和宿主页安全要求见
`docs/WIDGET.md`。

### 7.1 安装

```bash
npm install @nexus-feedback/widget
```

### 7.2 使用

```tsx
import { FeedbackWidget } from '@nexus-feedback/widget';

function App() {
  return (
    <div>
      <FeedbackWidget
        apiKey="your-api-key"
        apiUrl="https://feedback.yourdomain.com/api/v1"
        position="bottom-right"
        theme={{
          primaryColor: '#4f46e5',
          buttonLabel: '反馈建议'
        }}
      />
    </div>
  );
}
```

Widget 渲染一个浮动按钮，点击后弹出提交表单，包含标题、正文、分类、优先级、联系方式、截图上传。

### 7.3 打包目标

- IIFE（CDN 直接引入）
- ESM（现代打包工具）
- CJS（Node/SSR 环境可引用）

### 7.4 本地 Demo 宿主页

`packages/widget/demo/` 是仓库内的 Widget 演示宿主页（模拟第三方产品页面），
用于本地联调与冒烟测试：

```bash
# 1. 先构建 widget，生成 dist/nexus-feedback-widget.iife.js
pnpm --filter @nexus-feedback/widget build

# 2. 启动 demo 服务器（默认 8099，可用 --port=8099 覆盖）
node packages/widget/demo/server.mjs
```

打开 <http://localhost:8099/demo/> 即可看到宿主页与右下角的 Widget。demo 服务器是零依赖的
Node http 静态服务器：只暴露 `demo/` 与 `dist/` 两个目录，并把 `/api/*` 代理到
`http://localhost:3000`（可用 `API_ORIGIN` 环境变量覆盖），因此页面与 API 同源、无需 CORS 配置。
`pnpm smoke` 的 Widget 检查会优先复用这个 demo（dist 缺失时会提示先构建并标记 SKIP），
并在测试结束后关闭它启动的临时服务器。

---

## 8. 部署

### 8.1 Docker Compose

```yaml
version: "3.8"
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: nexus_feedback
      POSTGRES_USER: nexus
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  server:
    build: ./packages/server
    environment:
      DATABASE_URL: postgresql://nexus:${DB_PASSWORD}@db:5432/nexus_feedback
      STORAGE_TYPE: ${STORAGE_TYPE}
      S3_BUCKET: ${S3_BUCKET}
      AWS_REGION: ${AWS_REGION}
      AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID}
      AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY}
    ports:
      - "3000:3000"
    depends_on:
      - db

  admin:
    build: ./packages/admin
    ports:
      - "8080:80"

  submit-page:
    build: ./packages/submit-page
    ports:
      - "8081:80"
```

### 8.2 环境变量

```bash
# 数据库
DATABASE_URL=postgresql://user:password@localhost:5432/nexus_feedback

# 存储
STORAGE_TYPE=s3
S3_BUCKET=nexus-feedback
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx

# 服务器
PORT=3000
NODE_ENV=production

# 上传限制
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/png,image/jpeg,image/gif,image/webp
```

---

## 9. 安全设计

认证边界、API Key 哈希存储、JWT、CORS、上传和敏感日志规则见
`docs/AUTH_AND_SECURITY.md`。

| 层面 | 措施 |
|------|------|
| 传输安全 | 生产环境强制 HTTPS |
| 认证 | API Key（程序接入）/ JWT（管理后台登录） |
| 注入防护 | 参数化查询（Prisma 内置）、输入校验（zod） |
| 文件上传 | 类型白名单、大小限制、病毒扫描（可选扩展） |
| 限流 | API Key 维度限流，默认 100 req/min |
| CORS | 白名单域名配置 |
| SQL 注入 | Prisma ORM 参数化查询，无需额外处理 |

---

## 10. 里程碑计划

| 阶段 | 内容 | 预估 |
|------|------|------|
| M1 | 项目脚手架 + Prisma Schema + 基础 CRUD API | 第 1 周 |
| M2 | 文件上传 + 云存储适配器 + API Key 认证 | 第 2 周 |
| M3 | 管理后台核心页面（列表/详情/状态管理/统计） | 第 3 周 |
| M4 | Widget 组件 + 公开提交页 + Docker 部署 | 第 4 周 |
| M5 | 测试完善 + 文档 + 发布 | 第 5 周 |

---

## 11. 端到端冒烟测试（`pnpm smoke`）

`scripts/smoke.mjs` 是一个零新增依赖的端到端冒烟脚本：用 Node 24 内置 `WebSocket`
直连 Chrome DevTools Protocol，覆盖公开端、管理后台与 API 的关键路径，作为迭代回归门禁。
实现按职责拆分在 `scripts/smoke/`（`config` / `util` / `report` / `cli` / `chrome` /
`lifecycle` + `checks/*`）；`scripts/smoke.mjs` 仅保留入口编排（CLI、阶段顺序、退出码）。

### 前置条件

- 本地服务已启动：API `3000`、admin `8080`、submit `8081`、board `8082`
  （`pnpm dev` 或分别 `pnpm dev:server / dev:admin / dev:submit / dev:board`）。
- 演示数据（`demo` 组织 / `demo-project`）已 seed。
- Chrome 已在 `9222` 开启远程调试（脚本在探测不到时会自动启动 headless Chrome）。
- Widget demo：脚本优先使用仓库内 `packages/widget/demo/` 宿主页。若尚无构建产物
  （`packages/widget/dist/nexus-feedback-widget.iife.js`），该项会提示先运行
  `pnpm --filter @nexus-feedback/widget build` 并标记 `SKIP`（脚本不会自动构建）。
  验证时脚本会在 `8099` 启动/复用 demo 服务器，跑完后关闭由它启动的服务器。

### 使用

```bash
pnpm smoke
# 覆盖服务地址（按需）
node scripts/smoke.mjs \
  --base-admin=http://localhost:8080 \
  --base-board=http://localhost:8082 \
  --base-submit=http://localhost:8081 \
  --base-api=http://localhost:3000 \
  --chrome-port=9222
```

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--base-admin` | `http://localhost:8080` | 管理后台地址 |
| `--base-board` | `http://localhost:8082` | 公开看板地址 |
| `--base-submit` | `http://localhost:8081` | 公开提交页地址 |
| `--base-api` | `http://localhost:3000` | API 地址 |
| `--chrome-port` | `9222` | Chrome CDP 端口；不可用时自动启动 headless Chrome |
| `--help` | — | 显示帮助 |

### 覆盖范围

- **API**：`GET /api/v1/health` 返回 200；未认证访问 `/api/v1/admin/feedback` 返回 401。
- **公开端**：board 首页 / 路线图 / 更新日志 / 反馈详情（由首页首条 href 推导）、
  submit 页表单可见、仓库内 widget demo（Shadow DOM + 面板）。
  断言 HTTP 200、`document.title` 与 `link[rel=canonical]` 存在、`main` 有内容、无 console error / 异常。
- **后台**：`POST /api/v1/org/login` 取得 token 并注入 `localStorage`
  （`admin_token` / `org_member` / `org_info`），然后遍历仪表盘、反馈、更新日志、项目接入、
  成员、标签、审计日志、组织设置、系统配置，以及项目子页（设置 / Widget / 状态 / 分类 /
  Webhooks / 通知偏好），断言 `main` 渲染且有内容、无 console error / 异常；
  另验证命令面板 ⌘K 打开与 Esc 关闭、通知铃铛存在且能打开面板。
- **写操作链路（自动清理）**：
  1. 公开提交页真实提交一条标题为 `[SMOKE] 提交链路 {timestamp}` 的反馈，经后台 API 检索确认存在后软删除；
  2. 通过公开 API 创建一条反馈触发通知 → `unread-count > 0` → `read-all` → `unread-count == 0`，
     随后软删除测试反馈；
  3. 命令面板 ⌘K 输入「通知」并回车，断言 URL 跳转到 `/notifications`。
  写操作产生的测试反馈即使中途失败也会尽力清理，通知会被标记为已读。
- **API 响应契约**：`health` / `org/notifications`（带 token）/ `admin/feedback` 统一信封
  `{ code: number, data, message: string }` 且 `code === 0`；未认证 `org/notifications` 为 401 且 `code !== 0`。
- **CSV 导入链路**：`admin/feedback/import` 混合 dry-run（`valid=1`、`invalid_rows[0].index` 正确、不写库）
  → 单条 dry-run + commit（`imported=1`）→ 按标题检索 → 软删除；`audit-logs?action=feedback.import`
  可查到记录（过滤不支持时跳过该子断言）。
- **更新日志关联反馈**：`/org/changelog` 列表 `feedbacks` 数组契约 → POST 关联 → 列表确认 →
  DELETE 取消关联 → 列表确认移除；finally 兜底取消，避免残留关联。
- **通知免打扰**：保存并修改 DND 为全天窗口 → 公开 API 创建反馈 → `unread-count` 保持不变 →
  非法时间（25:00）返回 400 且不写库；finally 恢复原 DND 并软删除测试反馈/通知。
- **公开看板订阅**：临时邮箱 POST `public/:slug/subscribe`（weekly_digest）→ 幂等重复订阅 →
  管理端偏好确认 `weekly_digest=true` → 退订 → DELETE 偏好并断言无残留（finally 兜底清理）。
- **通知按项目静音**：保存原 `mutedProjects`/`dnd` → PUT 静音 demo 项目 → 公开创建反馈 →
  `unread-count` 保持不变且无该标题通知 → 恢复原设置 → 非法负载（非数组）返回 400；
  finally 恢复设置并软删除测试反馈/通知。
- **无障碍基础**：后台 dashboard / feedback / notifications 与公开端 board 首页 / submit 页断言
  `html lang` 合法、`h1` 唯一、可见交互元素均有可访问名称（排除 `aria-hidden` 与 `tabindex=-1`）、
  `img` 均有 `alt`。
- **移动端 390×844**：`dashboard` / `feedback` / `notifications` 三页断言
  `scrollWidth <= innerWidth`（无横向溢出）、无 console error、`main` 内容存在。
- **i18n 切换**：后台切到 en 后断言 `html lang=en`、侧边栏 Overview/Feedback、命令面板
  Quick actions/Pages；再切回 zh 断言 `概览` 恢复，全程无 console error。
- **移动端交互（390×844）**：汉堡抽屉开 / 遮罩关、通知铃铛开 / Esc 关、⌘K 输入「通知」
  回车跳转 `/notifications` 且无横向溢出；结束后恢复 1440 视口与中文界面。
- 截图全部保存到 `.tools/shots/smoke/`。

### 输出与退出码

终端输出中文汇总表（`PASS` / `FAIL` / `SKIP` + 耗时 + 说明），存在任意 `FAIL` 时退出码为 `1`，
可直接接入 CI 或提交前检查。Chrome 9222 已有实例时脚本不会关闭它；由脚本自行启动的
headless Chrome 会在结束时优雅关闭并清理临时 profile。

## 12. 前端性能采集（`pnpm perf` / `pnpm perf:prod`）

零依赖性能采样脚本（Node 24 内置 WebSocket + Chrome CDP，不引入 Lighthouse），用于观察公开端与
后台首屏的 FCP / LCP / CLS 及资源体积，做页面间横向比较和迭代回归。支持两种口径：

| 命令 | 模式 | 测量对象 |
|---|---|---|
| `pnpm perf` | `--mode=dev`（默认） | 本地 Vite dev server（未压缩模块、按需编译） |
| `pnpm perf:prod` | `--mode=preview` | `vite build` 产物 + Node 静态服务（文本 gzip）+ `/api` 代理 |

两种口径的绝对值不可直接比较，各自用于页面对比与回归趋势；dev 口径偏高属预期。

### 前置条件

- `dev` 口径：本地 dev server 已启动 admin `8080`、submit `8081`、board `8082`、API `3000`；
- `preview` 口径：先 `pnpm build` 生成 `packages/{admin,board,submit-page}/dist`（缺失时脚本会明确
  报错提示先 build，不会自动构建）；API 服务仍需运行，`/api` 请求由本地静态服务代理；
- Chrome 已在 `9222` 运行，或允许脚本自动启动 headless Chrome（脚本结束时自动关闭并清理临时 profile）；
- 无 Chrome 路径时可用 `CHROME_PATH` 指定可执行文件；
- 需要 `demo-project` 演示数据与组织账号 `admin@nexus.dev / admin123`（脚本自动登录注入登录态）。

### 使用

```bash
# dev 口径：6 个页面 × 2 个视口 × 每组合 3 次采样
pnpm perf

# preview 生产口径：先构建，再采样构建产物；结束自动关闭静态服务
pnpm build
pnpm perf:prod

# 增加采样次数 / 覆盖地址 / 指定 Chrome 端口
node scripts/perf.mjs --runs=5 --settle=2000
node scripts/perf.mjs --mode=preview --base-api=http://localhost:3000 --chrome-port=9222
```

| 参数 | 默认值 | 说明 |
|---|---|---|
| `--mode` | `dev` | 采样口径：`dev`（Vite dev server）/ `preview`（构建产物 + 静态代理） |
| `--base-admin` | `http://localhost:8080` | 管理后台地址（Landing / 登录 / 仪表盘）；preview 模式下作为静态服务起始端口 |
| `--base-board` | `http://localhost:8082` | 公开看板地址（首页 / 详情）；preview 模式下作为静态服务起始端口 |
| `--base-submit` | `http://localhost:8081` | 公开提交页地址（自动带 demo API Key）；preview 模式下作为静态服务起始端口 |
| `--base-api` | `http://localhost:3000` | API 地址（取反馈 ID、登录接口）；preview 模式的 `/api` 代理目标 |
| `--chrome-port` | `9222` | Chrome CDP 端口；不可用时自动启动 headless Chrome |
| `--runs` | `3` | 每页每视口采样次数（取中位数） |
| `--settle` | `1500` | `load` 事件后额外等待毫秒数，用于收敛 LCP/CLS |
| `--help` | — | 显示帮助 |

### preview（生产口径）说明

- 静态服务由脚本用 Node `http` 自行实现（零依赖）：admin / board / submit 各自托管对应 `dist`，
  按扩展名返回 MIME；文本资源按请求头 `Accept-Encoding: gzip` 实时 gzip（进程内缓存）；前端路由
  （如 `/dashboard`、`/demo-project/...`）回退到对应 `index.html`。
- `/api/*` 反代到 `--base-api`（默认 `http://localhost:3000`），因此 admin/board/submit 的接口请求
  与同源 dev 代理保持一致。
- 端口：从各 base URL 的端口开始尝试（默认 admin `8080` / submit `8081` / board `8082`），被占用时
  **自动 +1 重试**（最多 30 次）；实际端口打印在终端并写入报告 `environment.previewServers`。
  dev server 正在运行时，通常 admin/board/submit 会依次落到 `8083+`。
- 采样结束（包括异常中断的 `finally`）自动关闭全部静态服务，不残留端口或进程；Chrome 复用 9222 时
  不关闭已有实例，由脚本自行启动的 headless 会被关闭并清理临时 profile。
- 报告 `environment.mode = "preview"`，并附 `modeNote` 与静态服务端口列表，便于与 dev 报告区分。

### 采集范围

- 页面：看板首页 `/demo-project`、看板详情（由公开 API 取首条反馈 ID）、提交页
  `/?key=…`、Landing `/`、登录页（未登录访问 `/dashboard`）、登录后 `/dashboard`
  （通过 `localStorage` 注入 demo token）。
- 视口：桌面 `1440×900`、移动 `390×844`（移动端 `deviceScaleFactor=2`）。
- 指标：FCP、LCP、CLS、DOMContentLoaded、Load、TTFB，`performance.getEntriesByType('resource')`
  的资源数与总传输大小；同时记录最大资源与 LCP 元素作为问题线索。
- 采样隔离：每个「页面 × 视口」使用独立浏览器上下文（存储互不污染），每次采样禁用缓存
  （`Network.setCacheDisabled`），`load` 后等待 `--settle` 毫秒再取值，多次取中位数。

### 阈值与输出

- 阈值：FCP ≤ `1.8s`、LCP ≤ `2.5s`、CLS ≤ `0.1`，超出标记 `FAIL` 并写入「问题线索」
  （含最大资源、LCP 元素与 CLS 位移来源），阈值 FAIL 只做提示、不改变退出码。
- 结果写入 `.tools/perf/report-{timestamp}.json`（含每次原始采样）与 `.md`（中文表格 + 资源明细），
  `.tools/` 已 gitignore；终端同时打印汇总表与报告路径。
- 注意：dev 与 preview 两种口径的绝对值不可直接比较；dev 偏高属预期，preview 更接近线上静态部署，
  但仍是本机 loopback 数据（未做 CPU/网络节流），适合页面对比与改动前后回归，而非线上性能基线。
- 退出码：`0` = 报告生成成功（即使存在阈值 FAIL）；`1` = 环境错误（服务不可达、dist 缺失、Chrome 启动失败等）。

## 13. 无障碍审计（`pnpm a11y` / `pnpm a11y:check`）

零依赖无障碍（a11y）审计脚本（Node 24 内置 WebSocket + Chrome CDP，不引入 axe/Lighthouse），
对关键页面做 DOM 级近似审计，输出中文表格与 JSON/Markdown 报告，用于发现并回归无障碍问题；
`pnpm a11y:check` 为阈值门禁模式，可接入 CI / 提交前检查。

### 前置条件

- 本地 dev server 已启动：admin `8080`、board `8082`、submit `8081`、API `3000`；
- Chrome 已在 `9222` 运行，或允许脚本自动启动 headless Chrome（结束时自动关闭并清理临时 profile）；
- 需要 `demo-project` 演示数据与账号 `admin@nexus.dev / admin123`（脚本自动登录并注入登录态）。

### 使用

```bash
# 全量审计（7 个页面）——默认只报告，不影响退出码
pnpm a11y

# 质量门禁：存在严重或中等问题则退出码 1（用于 CI / 提交前检查；当前基线 0 严重 / 0 中等）
pnpm a11y:check

# 只审计部分页面（迭代修复时更快）
node scripts/a11y.mjs --only=submit
node scripts/a11y.mjs --only=board-home,board-detail

# 自定义门禁阈值：允许最多 2 个中等（默认 a11y:check 不允许任何中等）
node scripts/a11y.mjs --fail-on=medium --max-medium=2
node scripts/a11y.mjs --fail-on=medium --only=admin-feedback

# 覆盖服务地址 / Chrome 端口
node scripts/a11y.mjs --base-admin=http://localhost:8080 --chrome-port=9222
```

| 参数 | 默认值 | 说明 |
|---|---|---|
| `--base-admin` / `--base-board` / `--base-submit` / `--base-api` | 本地默认端口 | 页面与 API 地址 |
| `--chrome-port` | `9222` | Chrome CDP 端口；不可用时自动启动 headless Chrome |
| `--only` | 空（全部） | 只审计指定页面，逗号分隔：`submit,board-home,board-detail,admin-login,admin-dashboard,admin-feedback,admin-notifications` |
| `--fail-on` | `none` | 门禁阈值：`none`（只报告）/ `serious`（存在严重即失败）/ `medium`（存在严重或中等超限即失败） |
| `--max-medium` | `0` | 仅 `--fail-on=medium` 生效：允许的中等问题总数上限 |
| `--help` | — | 显示帮助 |

### 覆盖页面

- `submit`：提交页（带 demo API Key，实际渲染表单）
- `board-home` / `board-detail`：公开看板首页与反馈详情（详情 ID 由公开 API 动态获取）
- `admin-login`：未登录访问 `/dashboard` 时渲染的登录页
- `admin-dashboard` / `admin-feedback` / `admin-notifications`：注入 demo token 后的登录态页面
- 视口：桌面 `1440×900`；每个页面独立浏览器上下文（存储互不污染）。

### 检查项（DOM 级近似）

- **文档/标题**：`<html lang>`、`<title>`、h1 唯一性、标题层级不跳级、重复 id。
- **可访问名称**：`a[href]` / `button` / `input` / `select` / `textarea` / `[role=…]` 等交互元素
  是否有文本、`aria-label`、`aria-labelledby` 或关联 label；`role="img"` SVG 是否有名称。
- **表单**：控件是否有 label / aria-label、`aria-describedby` 引用是否存在、是否只有 title。
- **图片**：`<img>` 是否缺少 `alt`。
- **ARIA**：role/aria-* 属性名与取值合法性、`aria-*` 引用 id 是否存在、`aria-hidden` 容器内
  是否包含可聚焦元素、常见 role（checkbox/switch/radio/dialog）的必填属性。
- **焦点**：正 `tabindex` 滥用；通过真实 `Tab` 键遍历（CDP `Input.dispatchKeyEvent`）记录焦点顺序，
  与 DOM 预期顺序比对；对比聚焦前后 computed `outline` / `box-shadow` 判断焦点指示是否可见。
- **颜色对比度**：遍历可见文本，按 computed `color` 与祖先背景色（含半透明叠加）近似计算对比度，
  WCAG AA：正文 ≥ `4.5:1`、大字（≥24px 或 ≥18.66px 加粗）≥ `3:1`；渐变/背景图无法可靠还原时
  跳过并计数（避免误报）。

### 输出与判定

- 严重程度：`serious`（严重）/ `moderate`（中等）/ `minor`（轻微）；页面判定：有严重 → FAIL、
  仅有中等 → WARN、否则 PASS。
- 结果写入 `.tools/a11y/report-{timestamp}.json`（完整明细，含选择器/片段/比率）与 `.md`
  （中文表格 + 问题明细），`.tools/` 已 gitignore；终端同时打印汇总表与报告路径。
- 报告只做诊断，**不修复业务代码**；默认 `--fail-on=none` 不影响退出码，启用门禁后按阈值返回 0/1。
- 注意：这是 DOM 级近似审计，不是完整 WCAG 合规工具；键盘顺序/对比度为启发式结果，
  需结合人工复核。

### 质量门禁（`--fail-on` / `pnpm a11y:check`）

- 阈值语义：
  - `--fail-on=none`（默认）：只输出报告，退出码始终 0；
  - `--fail-on=serious`：总「严重」数 > 0 或任一页面采集失败 → 退出码 1，否则 0（`pnpm a11y:check` 等价于此）；
  - `--fail-on=medium`：在 serious 规则之外，「中等」总数 > `--max-medium`（默认 0）→ 退出码 1。
- 审计结束（报告生成后）终端打印 `门禁：PASS/FAIL`、参数、总量计数、各页计数、超阈值页面与退出码；
  JSON 报告新增 `gate` 字段：`{ enabled, failOn, maxMedium, status, exitCode, totals, perPage, reasons, failedPages }`，
  Markdown 报告新增「门禁」小节（参数/结果/各页计数）。
- 页面采集失败视为门禁失败（数据不完整时不放行）；环境初始化失败仍返回 1。
- 当前基线（2026-11，7 页）：**严重 0 / 中等 1 / 轻微 0**；`pnpm a11y:check` → PASS（exit 0），
  唯一中等项在 feedback（登录态）页的 1 处对比度问题（动态数据相关，详见报告 `.tools/a11y/`）。
- 常用命令：

```bash
pnpm a11y:check                                   # CI 门禁：严重 0 才通过
node scripts/a11y.mjs --fail-on=medium --max-medium=2 --only=admin-feedback
node scripts/a11y.mjs --only=admin-login          # 单独看某页，不影响退出码
```
