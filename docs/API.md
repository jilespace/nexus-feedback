# API 契约

## 基础规则

- Base path: `/api/v1`
- 请求和响应 JSON 字段使用 `snake_case`。
- 成功响应使用 HTTP 2xx 和 `code: 0`。
- 失败响应使用最接近语义的 HTTP status，并返回非 0 `code`。
- 所有响应使用统一包裹格式。

成功：

```json
{
  "code": 0,
  "data": {},
  "message": "ok"
}
```

失败：

```json
{
  "code": 40001,
  "data": null,
  "message": "validation failed"
}
```

## 错误码

完整错误码、处理策略与管理端本地化规则见 [ERRORS.md](./ERRORS.md)。下表为常用速查：

| Code | HTTP | 含义 |
|---:|---:|---|
| 0 | 2xx | 成功 |
| 40001 | 400 | 参数校验失败 |
| 40100 | 401 | API Key 缺失 |
| 40101 | 401 | API Key 无效 |
| 40110 | 401 | Admin token 缺失或过期 |
| 40300 | 403 | 权限不足 |
| 40400 | 404 | 资源不存在 |
| 40900 | 409 | 状态冲突 |
| 41300 | 413 | 文件过大 |
| 41500 | 415 | 文件类型不支持 |
| 42900 | 429 | 请求过于频繁 |
| 50000 | 500 | 服务端内部错误 |

## 认证

外部提交接口使用：

```http
X-API-Key: <project-api-key>
```

管理端接口使用：

```http
Authorization: Bearer <admin-jwt>
```

管理端接口不能接受 Project API Key。

## 健康检查

```http
GET /api/v1/health
```

响应：

```json
{
  "code": 0,
  "data": {
    "status": "ok",
    "database": "ok",
    "storage": "ok"
  },
  "message": "ok"
}
```

## 提交反馈

```http
POST /api/v1/feedback
Content-Type: application/json
X-API-Key: <project-api-key>
```

请求：

```json
{
  "title": "Homepage is slow",
  "content": "The homepage takes about five seconds to load.",
  "category": "performance",
  "priority": "medium",
  "contact": "user@example.com",
  "app_version": "1.2.3",
  "metadata": {
    "page_url": "https://example.com/dashboard",
    "user_id": "external-user-123"
  },
  "attachment_ids": ["ckv_file_123"]
}
```

字段规则：

| 字段 | 必填 | 规则 |
|---|---:|---|
| `title` | 是 | string，1-200 字符 |
| `content` | 是 | string，1-5000 字符 |
| `category` | 是 | `bug`, `feature`, `performance`, `ui`, `other` |
| `priority` | 否 | `low`, `medium`, `high`, `critical`；默认 `medium` |
| `contact` | 否 | string，最多 200 字符 |
| `app_version` | 否 | string，最多 50 字符 |
| `metadata` | 否 | JSON object，值应为基础类型或基础类型数组 |
| `attachment_ids` | 否 | 最多 5 个已上传附件 id |

响应：

```json
{
  "code": 0,
  "data": {
    "id": "ckv_feedback_123",
    "title": "Homepage is slow",
    "status": "open",
    "created_at": "2026-05-23T10:30:00.000Z"
  },
  "message": "ok"
}
```

## 上传附件

```http
POST /api/v1/upload
Content-Type: multipart/form-data
X-API-Key: <project-api-key>
```

表单字段：

| 字段 | 必填 | 规则 |
|---|---:|---|
| `file` | 是 | png、jpg、gif、webp、pdf；默认最大 10 MB |

响应：

```json
{
  "code": 0,
  "data": {
    "id": "ckv_file_123",
    "url": "https://storage.example.com/uploads/abc.png",
    "filename": "screenshot.png",
    "size": 245760,
    "mime_type": "image/png"
  },
  "message": "ok"
}
```

附件可以先于反馈提交而存在。未绑定反馈的附件应由清理任务在 24 小时后删除。

## 管理员登录

```http
POST /api/v1/admin/login
Content-Type: application/json
```

请求：

```json
{
  "username": "admin",
  "password": "correct horse battery staple"
}
```

响应：

```json
{
  "code": 0,
  "data": {
    "token": "jwt-token",
    "expires_at": "2026-05-24T10:30:00.000Z"
  },
  "message": "ok"
}
```

## 管理端反馈列表

```http
GET /api/v1/admin/feedback?status=open&category=bug&page=1&page_size=20
Authorization: Bearer <admin-jwt>
```

查询参数：

| 字段 | 必填 | 规则 |
|---|---:|---|
| `status` | 否 | `open`, `in_progress`, `resolved`, `closed` |
| `category` | 否 | 与提交反馈分类枚举一致 |
| `priority` | 否 | 与提交反馈优先级枚举一致 |
| `page` | 否 | integer，默认 1 |
| `page_size` | 否 | integer，默认 20，最大 100 |

响应：

```json
{
  "code": 0,
  "data": {
    "items": [
      {
        "id": "ckv_feedback_123",
        "title": "Homepage is slow",
        "category": "performance",
        "priority": "medium",
        "status": "open",
        "created_at": "2026-05-23T10:30:00.000Z",
        "reply_count": 0,
        "attachment_count": 1
      }
    ],
    "page": 1,
    "page_size": 20,
    "total": 1
  },
  "message": "ok"
}
```

默认排序为 `created_at desc`。

## 管理端反馈详情

```http
GET /api/v1/admin/feedback/:id
Authorization: Bearer <admin-jwt>
```

响应必须包含反馈字段、附件、回复、project 摘要和 metadata。

## 更新反馈状态

```http
PATCH /api/v1/admin/feedback/:id/status
Authorization: Bearer <admin-jwt>
Content-Type: application/json
```

请求：

```json
{
  "status": "in_progress"
}
```

非法状态流转返回 `40900`。

## 回复反馈

```http
POST /api/v1/admin/feedback/:id/replies
Authorization: Bearer <admin-jwt>
Content-Type: application/json
```

请求：

```json
{
  "content": "Thanks for the report. We reproduced the issue and are working on a fix."
}
```

v1 回复是管理端内部记录。除非未来明确增加公开通知能力，否则不对提交用户展示。

## 管理端统计

```http
GET /api/v1/admin/stats
Authorization: Bearer <admin-jwt>
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
    "by_category": {
      "bug": 80,
      "feature": 60,
      "performance": 30,
      "ui": 20,
      "other": 66
    },
    "by_week": [
      { "week": "2026-W20", "count": 12 },
      { "week": "2026-W21", "count": 18 }
    ]
  },
  "message": "ok"
}
```
