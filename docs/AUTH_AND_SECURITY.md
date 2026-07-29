# 认证与安全

## 认证边界

Nexus Feedback 有两个认证面：

| 使用场景 | 调用方 | 凭证 |
|---|---|---|
| 反馈提交 | Widget、公开提交页、外部客户端 | Project API Key |
| 管理操作 | 管理后台 | Admin JWT |

Project API Key 绝不能授权管理端接口。

## API Key 规则

- 使用加密安全随机数生成 key。
- 数据库只存 SHA-256 哈希，不存明文。
- 明文 key 只在创建或重新生成时展示一次。
- 校验时对传入 key 哈希后比较。
- 每个 key 只属于一个 project。
- 提交和上传接口按 project 维度限流。

推荐字段：

```prisma
model Project {
  id              String   @id @default(cuid())
  name            String
  slug            String
  api_key_hash    String   @unique
  api_key_prefix  String   @default("")
  allowed_origins String[]
  org_id          String
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt
}
```

## Admin JWT 规则

- 管理员登录返回短期 JWT，默认 24 小时过期。
- 密码使用 argon2id 等密码哈希算法存储。
- 管理端只接受 `Authorization: Bearer <token>`。
- 缺失、过期或无效 token 返回 `40110`。

## CORS 规则

- 生产环境禁止使用 `Access-Control-Allow-Origin: *`。
- Widget 和公开提交页来源必须匹配 project 的 `allowed_origins`。
- 服务端到服务端调用不依赖浏览器 CORS。

## 上传安全

- 尽量基于文件内容校验 MIME 类型，不只依赖扩展名。
- 严格执行 `MAX_FILE_SIZE`。
- 存储 key 由服务端生成，不使用用户上传文件名作为路径。
- 不执行、不 inline 用户上传内容。
- 未绑定反馈的上传文件 24 小时后清理。

## 敏感日志

禁止记录：

- 明文 API Key。
- 密码和密码哈希。
- Admin JWT。
- 用户联系方式。
- 完整反馈提交请求体。

日志中使用 feedback id、project id、request id 等稳定标识即可。
