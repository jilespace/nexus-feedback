# 本地开发运行手册

## 前置假设

- 已安装 Node.js 18+。
- 项目统一使用 `pnpm`，不混用 npm/yarn。
- 本地或 Docker 中有 PostgreSQL 16+。
- 文档和源码统一保存为 UTF-8。

## 目标根目录命令

工程初始化后，根目录应提供：

```bash
pnpm install
pnpm dev
pnpm dev:server
pnpm dev:admin
pnpm dev:submit
pnpm dev:widget
pnpm db:start
pnpm db:migrate
pnpm db:seed
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
```

## 本地启动流程

```bash
pnpm install
pnpm db:start
pnpm db:migrate
pnpm db:seed
pnpm dev
```

预期本地服务：

| 服务 | 地址 |
|---|---|
| API server | `http://localhost:3000` |
| Admin app | `http://localhost:8080` |
| Submit page | `http://localhost:8081` |
| Widget dev preview | `http://localhost:5173` |

## 健康检查

服务端必须提供：

```http
GET /api/v1/health
```

成功响应：

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

如果本地开发禁用了对象存储，`storage` 可以返回 `"disabled"`。

## 环境变量文件

本地使用 `.env.local` 保存机器私有配置。不要提交 `.env` 或 `.env.local`。

项目必须维护 `.env.example`，列出所有支持的环境变量、默认值和是否必填。

## Windows 编码提示

如果 PowerShell 读取中文文档出现乱码，先切到 UTF-8 输出：

```powershell
$OutputEncoding = [System.Text.UTF8Encoding]::new()
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
```

