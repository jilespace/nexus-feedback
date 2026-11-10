# 第三方软件声明

Nexus Feedback 基于大量优秀的开源软件构建。本文件列出**直接依赖**及其许可证，
供分发与合规审查参考。

> 说明：
>
> - 完整许可证文本位于各依赖包的 `node_modules/<package>/LICENSE*`（安装依赖后可见）；
> - 传递依赖（transitive dependencies）各自保留其原始许可证，`pnpm licenses list` 可导出完整清单；
> - 本文件由仓库维护者手工汇总，依赖升级后请重新核对；
> - 若你要分发构建产物（`dist/`、Docker 镜像等），请保留本文件与 `LICENSE`。

## 运行时直接依赖

| 依赖 | 许可证 | 用途 |
|---|---|---|
| express | MIT | HTTP API 框架 |
| @prisma/client / prisma | Apache-2.0 | ORM 与数据库迁移 |
| jsonwebtoken | MIT | 管理端 JWT 认证 |
| argon2 | MIT | 密码哈希 |
| zod | MIT | 请求与环境变量校验 |
| helmet / cors / express-rate-limit | MIT | 安全响应头、CORS、限流 |
| multer | MIT | 文件上传 |
| @aws-sdk/client-s3 / s3-request-presigner | Apache-2.0 | S3 兼容对象存储 |
| qiniu | MIT | 七牛云对象存储 |
| resend | MIT | 事务邮件 |
| node-cron | ISC | 定时任务（周报清理等） |
| csv-stringify | MIT | CSV 导出 |
| dotenv | BSD-2-Clause | 环境变量加载 |
| swagger-ui-express | MIT | OpenAPI 文档界面 |
| react / react-dom | MIT | 管理端、公开看板、提交页、Widget |
| react-router-dom | MIT | 前端路由 |
| react-i18next / i18next | MIT | 国际化（中/英） |
| @tanstack/react-query | MIT | 前端数据请求与缓存 |
| recharts | MIT | Dashboard 图表 |
| clsx | MIT | 条件 class 组合 |
| @fontsource-variable/instrument-sans | OFL-1.1 | Instrument Sans 可变字体 |

## 构建与开发依赖

| 依赖 | 许可证 | 用途 |
|---|---|---|
| vite / @vitejs/plugin-react | MIT | 前端构建与开发服务器 |
| typescript | Apache-2.0 | 类型系统与编译 |
| tsx | MIT | 服务端开发热加载 |
| tailwindcss / postcss / autoprefixer | MIT | 样式工具链 |
| vitest | MIT | 单元测试 |
| supertest | MIT | HTTP 接口测试 |
| eslint / @eslint/js / typescript-eslint | MIT | 代码检查 |
| @types/* | MIT | TypeScript 类型声明 |

## 基础设施与服务

| 组件 | 许可证/协议 | 说明 |
|---|---|---|
| PostgreSQL 16 | PostgreSQL License（类 BSD/MIT） | 主数据库 |
| Resend | 商业服务 | 邮件发送（可选） |
| S3 兼容存储 / 七牛云 OSS | 商业服务 | 附件存储（可选） |
| Docker / Docker Compose | Apache-2.0 | 本地数据库容器 |

## 品牌与字体

- `Instrument Sans` 字体按 SIL Open Font License 1.1 分发。
- 项目名称与 Logo 仅用于标识本项目，不随 MIT 许可证授予商标使用权。

## MIT 许可证声明

本项目中标记为 MIT 的依赖，其版权声明与许可文本可在对应包的 `LICENSE` 文件中找到。
根据 MIT 许可证要求，分发本项目（含构建产物）时需保留这些版权与许可声明。

如发现遗漏或错误，请提交 Issue 或 PR 更正。
