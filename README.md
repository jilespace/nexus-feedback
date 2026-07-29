# Nexus Feedback

面向开发者的用户反馈管理 SaaS 平台。帮助产品团队收集、组织、优先排序用户反馈，通过公开看板和更新日志保持用户参与感。

![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)
![React](https://img.shields.io/badge/React-18-61dafb?logo=react)
![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=node.js)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169e1?logo=postgresql)
![License](https://img.shields.io/badge/License-MIT-green)

## 在线演示

🌐 **官网：** [https://nexus-feedback.github.io](https://nexus-feedback.github.io)

## 核心功能

### 📋 反馈管理
- **多渠道收集** — Widget 嵌入、公开提交页、API 直接调用
- **智能分类** — 支持自定义分类（bug/feature/performance/ui/other），按项目独立配置
- **用户投票** — 邮箱标识，按热度排序，无需注册
- **反馈合并** — 合并重复反馈，投票自动合并去重
- **附件上传** — 支持图片和 PDF，拖拽上传，支持本地/S3/七牛云存储

### 👥 团队协作
- **多租户系统** — 组织 → 项目 → 成员（Owner/Admin/Member 三角色）
- **反馈指派** — 将反馈分配给团队成员处理
- **内部备注** — 仅管理员可见的反馈备注
- **标签系统** — 自由标签分类 + 批量操作
- **审计日志** — 完整记录所有操作历史

### 📊 数据分析
- **实时统计** — 反馈总数、状态分布、来源分布、投票趋势
- **响应指标** — 平均首次响应时间、周趋势、月度趋势
- **数据导出** — CSV 格式导出（含标签、指派信息）

### 🔌 集成与扩展
- **Webhook 集成** — 支持 feedback.created / status_changed / assigned / merged / comment.created 事件，HMAC-SHA256 签名验证
- **SSO 单点登录** — JWT 配置，无缝对接企业认证
- **自定义状态** — 每个项目可配置独立的状态工作流
- **邮件通知** — 状态变更通知投票者、密码重置、周报摘要

### 🌐 公开体验
- **公开反馈看板** — 用户可浏览、搜索、投票、评论反馈
- **路线图** — Kanban 视图（计划中 / 进行中 / 已完成）
- **更新日志（Changelog）** — 发布产品更新，关联已解决反馈

### 🛡️ 安全与性能
- **API 限流** — 防止接口滥用
- **多租户隔离** — 数据严格分离
- **审计日志** — 完整操作记录
- **暗色模式** — 管理后台支持明暗主题切换
- **国际化** — 中英文切换
- **键盘快捷键** — `/` 搜索、J/K 导航、`?` 帮助

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Node.js + Express + TypeScript + Prisma |
| 数据库 | PostgreSQL (支持 trigram 全文搜索) |
| 前端 | React 18 + TypeScript + Tailwind CSS + Vite |
| 动画 | GSAP (ScrollTrigger, batch) |
| 数据获取 | TanStack Query |
| 邮件 | Resend |
| 文件存储 | 本地 / S3 兼容 / 七牛云 |
| 测试 | Vitest + Supertest |
| 包管理 | pnpm workspace (monorepo) |

## 项目结构

```
nexus-feedback/
├── packages/
│   ├── server/        # API 服务 (Express + Prisma, port 3000)
│   ├── admin/         # 管理后台 + 官网 (React, port 8080)
│   ├── board/         # 公开反馈看板 (React, port 8082)
│   ├── widget/        # 可嵌入反馈 Widget (IIFE/ESM)
│   └── submit-page/   # 公开反馈提交页 (React, port 8081)
├── docs/              # 设计文档和计划
└── prisma/
    └── migrations/    # 数据库迁移文件
```

## 快速开始

### 环境要求

- Node.js >= 18
- pnpm >= 9
- PostgreSQL >= 14

### 安装和启动

```bash
# 克隆项目
git clone https://github.com/nexus-feedback/nexus-feedback.git
cd nexus-feedback

# 安装依赖
pnpm install

# 配置环境变量
cp packages/server/.env.example packages/server/.env
# 编辑 .env 填入数据库连接和其他配置

# 启动 PostgreSQL (Docker)
pnpm db:start

# 初始化数据库
pnpm db:migrate
pnpm db:seed

# 启动所有服务
pnpm dev
```

### 单独启动

```bash
pnpm dev:server   # API 服务        → http://localhost:3000
pnpm dev:admin    # 管理后台 + 官网 → http://localhost:8080
pnpm dev:board    # 公开看板        → http://localhost:8082/{项目slug}
pnpm dev:submit   # 公开提交页      → http://localhost:8081/?key={API_KEY}
```

### 默认登录凭据

| 项目 | 值 |
|---|---|
| 管理员邮箱 | `admin@nexus.dev` |
| 密码 | `admin123` |
| 项目 slug | `demo-project` |
| 项目 API Key | `nf_demo_project_key_789` |
| 公开看板地址 | `http://localhost:8082/demo-project` |
| 提交页地址 | `http://localhost:8081/?key=nf_demo_project_key_789` |

## 开发者接入指南

### 接入方式一：Widget 嵌入（推荐）

在你的网站中嵌入反馈按钮，用户点击后弹出反馈表单。

```html
<script src="https://your-domain.com/nexus-feedback-widget.iife.js"></script>
<script>
  NexusFeedbackWidget.mount(document.createElement('div'), {
    apiKey: 'your-project-api-key',
    apiUrl: 'https://your-domain.com/api/v1',
    primaryColor: '#6366f1',
  });
</script>
```

### 接入方式二：公开提交页

直接链接到独立的反馈提交页面：

```
https://your-domain.com/submit/?key=your-project-api-key
```

### 接入方式三：API 直接调用

#### 提交反馈

```bash
curl -X POST https://your-domain.com/api/v1/feedback \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-project-api-key" \
  -d '{
    "title": "Bug 报告",
    "content": "详细描述问题",
    "category": "bug",
    "priority": "high",
    "contact": "user@example.com"
  }'
```

#### 请求参数

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `title` | string | 是 | 反馈标题 |
| `content` | string | 是 | 详细描述 |
| `category` | string | 是 | 项目自定义分类名称 |
| `priority` | string | 否 | `low` / `medium`(默认) / `high` / `critical` |
| `contact` | string | 否 | 联系方式 |
| `source` | string | 否 | 来源标识（默认 `api`） |
| `attachment_ids` | string[] | 否 | 附件 ID 数组 |

#### 上传附件

```bash
curl -X POST https://your-domain.com/api/v1/upload \
  -H "X-API-Key: your-project-api-key" \
  -F "file=@screenshot.png"
```

#### 用户投票

```bash
curl -X POST https://your-domain.com/api/v1/public/{slug}/feedback/{id}/vote \
  -H "Content-Type: application/json" \
  -d '{ "email": "voter@example.com" }'
```

### 接入方式四：公开看板

```
https://your-domain.com/{project-slug}
```

## 环境变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `DATABASE_URL` | 是 | PostgreSQL 连接串 |
| `JWT_SECRET` | 是 | JWT 签名密钥（建议 32 位以上） |
| `PORT` | 否 | API 端口（默认 3000） |
| `CORS_ALLOWED_ORIGINS` | 否 | 允许的跨域来源 |
| `MAX_FILE_SIZE` | 否 | 最大文件大小（默认 10MB） |
| `STORAGE_TYPE` | 否 | `local`(默认) / `s3` / `oss` / `qiniu` |
| `S3_BUCKET` | 否 | S3 存储桶 |
| `S3_REGION` | 否 | S3 区域 |
| `S3_ENDPOINT` | 否 | S3 端点（MinIO/OSS） |
| `S3_ACCESS_KEY` | 否 | S3 Access Key |
| `S3_SECRET_KEY` | 否 | S3 Secret Key |
| `RESEND_API_KEY` | 否 | Resend 邮件 API Key |
| `RESEND_FROM_EMAIL` | 否 | 发件人邮箱 |
| `BASE_URL` | 否 | 前端地址（密码重置链接） |

> 邮件和存储也可在管理后台「系统配置」中设置，无需改环境变量。

## 生产部署（单域名模式）

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    client_max_body_size 20m;
}
location /admin/ {
    alias /path/to/packages/admin/dist/;
    try_files $uri $uri/ /admin/index.html;
}
location /submit/ {
    alias /path/to/packages/submit-page/dist/;
    try_files $uri $uri/ /submit/index.html;
}
location / {
    root /path/to/packages/board/dist;
    try_files $uri $uri/ /index.html;
}
```

> 注意：admin 和 submit-page 构建前需设置 `vite.config.ts` 的 `base` 为 `/admin/` 和 `/submit/`。

## Webhook 集成

在管理后台「项目接入」→ 项目 → Webhooks 中配置。

| 事件 | 触发时机 |
|---|---|
| `feedback.created` | 新反馈提交 |
| `feedback.status_changed` | 状态变更 |
| `feedback.assigned` | 反馈被指派 |
| `feedback.merged` | 反馈被合并 |
| `comment.created` | 新评论 |

请求头包含 `X-Webhook-Signature`（HMAC-SHA256）用于验证来源。

## 开发命令

```bash
pnpm lint        # ESLint 检查
pnpm typecheck   # TypeScript 类型检查
pnpm test        # 运行测试
pnpm build       # 构建所有包
pnpm db:start    # 启动 PostgreSQL (Docker)
pnpm db:migrate  # 应用数据库迁移
pnpm db:seed     # 填充测试数据
```

## License

MIT
