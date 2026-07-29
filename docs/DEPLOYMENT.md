# 部署与运维

## 目标部署形态

默认部署使用 Docker Compose，包含：

- `server`：Node.js API。
- `admin`：管理后台静态资源服务。
- `submit-page`：公开提交页静态资源服务。
- `db`：PostgreSQL 16。

对象存储可按 `STORAGE_TYPE` 选择 `local`、`s3` 或 `oss`。

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

## 发布清单

- `pnpm lint` 已通过。
- `pnpm typecheck` 已通过。
- `pnpm test` 已通过。
- `pnpm test:e2e` 已通过，或明确说明当前阶段不适用。
- migration 已审查。
- `.env.example` 已更新。
- 接口变更已更新 API 文档。
- 已确认回滚方式。

