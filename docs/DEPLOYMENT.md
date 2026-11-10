# 部署与运维

## 目标部署形态

默认部署使用 Docker Compose，包含：

- `server`：Node.js API。
- `admin`：管理后台静态资源服务。
- `submit-page`：公开提交页静态资源服务。
- `db`：PostgreSQL 16。

对象存储可按 `STORAGE_TYPE` 选择 `local`、`s3` 或 `oss`。

> 仓库当前只提交了 `docker-compose.yml`（PostgreSQL dev 服务）与 nginx 片段；
> 线上若采用「Node 进程 + nginx 静态文件」形态，请直接参考下文「升级已部署环境」。
> 若使用自定义 Docker 镜像部署，升级时重新构建 `server` 与静态资源镜像即可，
> 迁移步骤相同（在 server 容器内执行）。

## 环境变量

| 变量 | 必填 | 默认值 | 说明 |
|---|---:|---|---|
| `DATABASE_URL` | 是 | 无 | PostgreSQL 连接串 |
| `PORT` | 否 | `3000` | API 服务端口 |
| `NODE_ENV` | 否 | `development` | 生产环境使用 `production` |
| `STORAGE_TYPE` | 否 | `local` | `local`、`s3`、`oss` |
| `LOCAL_UPLOAD_DIR` | 否 | `./uploads` | 本地上传目录 |
| `MAX_FILE_SIZE` | 否 | `10485760` | 上传大小限制，单位 byte |
| `ALLOWED_FILE_TYPES` | 否 | 图片/pdf 集合 | 逗号分隔 MIME 类型 |
| `JWT_SECRET` | 是 | 无 | 非本地环境必须设置强随机值 |
| `CORS_ALLOWED_ORIGINS` | 是 | 无 | 生产环境允许来源 |
| `S3_BUCKET` | S3 时必填 | 无 | S3 bucket |
| `AWS_REGION` | S3 时必填 | 无 | S3 region |
| `AWS_ACCESS_KEY_ID` | S3 时必填 | 无 | 密钥 |
| `AWS_SECRET_ACCESS_KEY` | S3 时必填 | 无 | 密钥 |
| `OSS_BUCKET` | OSS 时必填 | 无 | OSS bucket |
| `OSS_REGION` | OSS 时必填 | 无 | OSS region |
| `OSS_ACCESS_KEY_ID` | OSS 时必填 | 无 | 密钥 |
| `OSS_ACCESS_KEY_SECRET` | OSS 时必填 | 无 | 密钥 |
| `RESEND_API_KEY` | 否 | 无 | 配置后发送订阅确认/通知邮件；未配置时邮件静默跳过 |
| `EMAIL_FROM` | 否 | 无 | 发件人地址（Resend 已验证域名） |

## 迁移策略

- Prisma schema 变更必须生成 migration。
- 部署新版本前先运行 migration。
- migration 失败时停止部署。
- 破坏性 migration 必须在 PR 描述中单独说明。

## 健康检查

就绪检查调用：

```http
GET /api/v1/health
```

该接口至少检查：

- API 进程存活。
- 数据库连接可用。
- 存储适配器已配置，或本地开发明确禁用。

## 反向代理要求

- 生产环境强制 HTTPS。
- 保留 `Authorization` 和 `X-API-Key` 请求头。
- 请求体大小上限必须大于上传大小限制。
- 如果存在 request id 请求头，需要继续透传。

## 备份与恢复

- PostgreSQL 至少每日备份。
- 对象存储需要开启备份或 bucket versioning。
- 没有演练过恢复流程的备份，不能视为可靠备份。

## 升级已部署环境（版本发布）

适用于「Git 拉取 + Node 进程 + nginx 静态文件」的部署形态；Docker 部署只需把
第 2/5/6 步替换为镜像构建与容器重启，迁移仍在 server 容器内执行。

### 0. 发布前准备

```bash
# 在服务器上（示例目录 /srv/nexus-feedback）
cd /srv/nexus-feedback
git pull origin main
```

> 发布前先在数据库侧做一次备份（生产建议每日自动备份，发布前额外手动备份一次）：
>
> ```bash
> pg_dump "$DATABASE_URL" > backup-$(date +%Y%m%d-%H%M).sql
> ```

### 1. 安装依赖（使用 lockfile）

```bash
corepack enable        # 若尚未安装 pnpm
pnpm install --frozen-lockfile
```

### 2. 检查并应用数据库迁移

```bash
pnpm --filter @nexus-feedback/server exec prisma migrate status
```

- **只有新增迁移 pending**（例如 `20261110100000_member_saved_views`、
  `20261110110000_notification_params`）：直接执行下一步。
- **若 `20261110040000_baseline_sync` 出现在 pending**：该迁移用于补齐历史 drift
  （`member.invite_token*`、`organization.board_url` 等）。若线上库由历史 `db push`
  演进、相关列已存在，直接 deploy 会因「列已存在」失败。此时先确认列存在，再登记为已应用：

  ```bash
  # 确认列存在（列不存在时不要 resolve，直接 deploy）
  psql "$DATABASE_URL" -c "\d member" | grep invite_token
  pnpm --filter @nexus-feedback/server exec \
    prisma migrate resolve --applied 20261110040000_baseline_sync
  ```

- 不要执行 `prisma migrate dev` 或 `migrate reset`（会重置数据）。

```bash
# 应用所有待执行迁移（只执行未记录的 SQL，不重置数据）
pnpm --filter @nexus-feedback/server exec prisma migrate deploy

# 重新生成 Prisma Client（发布进程中包含新字段/类型）
pnpm --filter @nexus-feedback/server exec prisma generate
```

### 3. 构建

```bash
pnpm build
```

产物：

- API：`packages/server/dist`
- 管理后台：`packages/admin/dist`
- 公开提交页：`packages/submit-page/dist`
- 公开看板：`packages/board/dist`
- Widget（IIFE，供嵌入）：`packages/widget/dist/nexus-feedback-widget.iife.js`

### 4. 重启 API 进程

按现有进程管理方式二选一：

```bash
pm2 restart nexus-feedback-api        # PM2
sudo systemctl restart nexus-feedback-api   # systemd
```

### 5. 发布静态资源

nginx 指向的目录需与构建产物一致（默认 `dist/`，`try_files` 做 SPA 回退）：

- `/` → `packages/board/dist`
- `/admin/` → `packages/admin/dist`（如按子路径部署，构建前把 `vite.config.ts`
  的 `base` 设为 `/admin/`；根路径/独立端口部署可保持默认 `/`）
- `/submit/` → `packages/submit-page/dist`（同上，子路径部署用 `base: '/submit/'`）
- Widget 文件按原部署位置覆盖（CDN 或后端静态目录）

配置无变化时无需 reload；有变化执行：

```bash
sudo nginx -t && sudo nginx -s reload
```

### 6. 升级后验证

```bash
# API 与配置接口
curl -fsS https://<your-host>/api/v1/health
curl -fsS "https://<your-host>/api/v1/public/demo-project/config" | head

# 关键链路（浏览器/管理员账号）
# - 登录后台，确认 Dashboard/反馈列表/通知中心正常
# - 通知中心：新通知能显示本地化标题（params 已写入）；旧通知回退原文本
# - 反馈列表：保存视图后刷新仍在（服务端同步）
# - 项目设置 → 通知偏好：保存一次确认无 400
# - 公开看板/提交页/订阅卡片/退订链接（邮件中）
```

可选：在能访问线上地址的机器上运行 `pnpm smoke` 做端到端冒烟
（需要 Chrome 9222 或允许脚本自动启动 headless Chrome）。

### 7. 回滚

```bash
git checkout <上一个发布 commit 或 tag>
pnpm install --frozen-lockfile
pnpm build
# 重启 API + 覆盖静态资源
```

注意：数据库迁移只前向执行。本次新增的 `member.saved_views`、`notification.params`
均为可空新增列，旧代码可正常忽略；回滚代码本身安全，但已应用的迁移不会自动回退，
如需彻底回退请使用发布前的数据库备份。

## 发布清单

- `pnpm lint` 已通过。
- `pnpm typecheck` 已通过。
- `pnpm test` 已通过。
- `pnpm test:e2e` 已通过，或明确说明当前阶段不适用。
- migration 已审查。
- `.env.example` 已更新。
- 接口变更已更新 API 文档。
- 已确认回滚方式。
