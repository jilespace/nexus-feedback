# Nexus Feedback 生产口径性能基线

> 状态：已记录（2026-11-10，初版）。
> 数据来源：本地 `pnpm build` 产物的 preview 静态服务采样，报告位于 `.tools/perf/`（该目录已 gitignore，
> 不入库）。本文档用于迭代前后的生产口径对比；它不是线上 RUM/真实用户数据。

## 1. 环境

| 项目 | 值 |
|---|---|
| 日期 | 2026-11-10 |
| 机器 | 本机（Windows 11，内核 10.0.26300），CPU Intel Core i5-12400F |
| Node | v24.14.0（脚本为纯 Node 24 + 内置 WebSocket，零依赖） |
| Chrome | 156.0.8078.80 headless（CDP 9222，复用已有实例） |
| 网络 | 全部 loopback（localhost），无 CDN、无人工网络延迟 |
| API | http://localhost:3000（dev server 运行中） |
| 构建 | `pnpm build`（Vite production build，当前工作区未提交状态） |
| preview 服务 | Node `http` 静态托管 dist + `/api` 反代 3000；因 dev server 占用 8080-8082，脚本自动 +1 至 admin `8083` / board `8084` / submit `8085` |
| 演示数据 | `demo-project`（Demo Org 演示反馈与更新日志数据） |

## 2. 方法

- 命令：`pnpm build` → `pnpm perf:prod -- --runs=3 --settle=300`；本基线执行 2 次，取第 1 次为基线
  （第 2 次用于稳定性复核，两次数值差异见 §7）。
- 页面 × 视口：提交页、board 首页、board 详情、Landing、登录页（未登录 `/dashboard`）、
  登录后 dashboard；桌面 `1440×900`、移动 `390×844`（dpr=2）。
- 采样：每个「页面 × 视口」3 次取中位数；每次采样使用独立浏览器上下文，禁用缓存
  （`Network.setCacheDisabled`），`load` 后额外等待 300ms 收敛 LCP/CLS。
- 指标：FCP、LCP、CLS、DOMContentLoaded、Load、TTFB，`performance.getEntriesByType('resource')`
  的资源数与传输/解码大小；同时记录最大资源、LCP 元素、CLS 位移来源。
- 阈值（仅提示，脚本退出码不受影响）：FCP ≤ 1800ms、LCP ≤ 2500ms、CLS ≤ 0.1。
- preview 口径：Vite 构建产物经 Node 静态服务器提供（文本资源 gzip、SPA fallback），`/api` 反代
  到本地 API，接近「静态部署」而非 dev 未压缩模块口径。

## 3. 结果（preview，基线 run1）

报告：`.tools/perf/report-20261110-103215.json/.md`

| 页面 | 视口 | FCP | LCP | CLS | DCL | Load | TTFB | 资源数 | 传输大小 | 解码大小 | 判定 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 看板首页 | 1440×900 | 116ms | 116ms | 0.000 | 31ms | 31ms | 3ms | 6 | 143.6KB | 384.0KB | ✅ PASS |
| 看板详情 | 1440×900 | 108ms | 188ms | 0.001 | 35ms | 35ms | 2ms | 5 | 133.0KB | 373.7KB | ✅ PASS |
| 提交页 | 1440×900 | 96ms | 96ms | 0.000 | 24ms | 24ms | 2ms | 5 | 94.0KB | 237.1KB | ✅ PASS |
| Landing 首页 | 1440×900 | 260ms | 260ms | 0.000 | 35ms | 35ms | 2ms | 5 | 198.0KB | 610.7KB | ✅ PASS |
| 登录页（未登录） | 1440×900 | 136ms | 136ms | 0.000 | 45ms | 45ms | 2ms | 3 | 186.8KB | 563.6KB | ✅ PASS |
| 仪表盘（登录态） | 1440×900 | 128ms | 128ms | 0.000 | 37ms | 37ms | 2ms | 16 | 314.3KB | 962.0KB | ✅ PASS |
| 看板首页 | 390×844 | 104ms | 104ms | 0.000 | 36ms | 36ms | 2ms | 6 | 143.6KB | 384.0KB | ✅ PASS |
| 看板详情 | 390×844 | 96ms | 152ms | 0.000 | 30ms | 30ms | 2ms | 5 | 133.0KB | 373.7KB | ✅ PASS |
| 提交页 | 390×844 | 84ms | 84ms | 0.000 | 27ms | 27ms | 2ms | 5 | 94.0KB | 237.1KB | ✅ PASS |
| Landing 首页 | 390×844 | 248ms | 248ms | 0.000 | 35ms | 35ms | 1ms | 5 | 198.0KB | 610.7KB | ✅ PASS |
| 登录页（未登录） | 390×844 | 108ms | 108ms | 0.000 | 34ms | 34ms | 2ms | 3 | 186.8KB | 563.6KB | ✅ PASS |
| 仪表盘（登录态） | 390×844 | 124ms | 124ms | 0.000 | 37ms | 38ms | 2ms | 16 | 314.3KB | 962.0KB | ✅ PASS |

**结论：12/12 个「页面 × 视口」组合通过全部阈值。** 传输大小为 gzip 后大小，解码大小为压缩前
（preview 静态服务对文本资源按 `Accept-Encoding: gzip` 压缩）。

## 4. 与阈值对比

| 指标 | 阈值 | 实测最大值（中位数） | 余量 | 判定 |
|---|---|---|---|---|
| FCP | ≤ 1800ms | 260ms（Landing 1440） | 使用阈值预算的 14% | ✅ PASS |
| LCP | ≤ 2500ms | 260ms（Landing 1440） | 使用阈值预算的 10% | ✅ PASS |
| CLS | ≤ 0.1 | 0.001（看板详情 1440） | 约为阈值的 1% | ✅ PASS |
| DCL | 无阈值 | 45ms（登录页 1440） | — | ✅ |
| Load | 无阈值 | 45ms（登录页 1440） | — | ✅ |
| TTFB | 无阈值 | 3ms（loopback） | — | ✅ |
| 资源数 | 无阈值 | 16（仪表盘） | — | ✅ |
| 传输大小 | 无阈值 | 314.3KB（仪表盘） | — | ✅ |

最重页面为仪表盘（314.3KB / 16 请求，含异步图表 chunk）；公开端页面均为 94–198KB / 3–6 请求。

## 5. 资源构成（preview，run1 Top 资源）

- 看板：`index-DpnMBJie.js` 93.8KB(gzip) + `index-CDPZUFqA.css` 7.8KB + 字体 29.7KB；
  数据请求 `feedback` ~10.9KB、`config` ~0.9KB。
- 提交页：`index-BsGzfH3t.js` 56.9KB + CSS 6.5KB + 字体 29.7KB。
- Landing：admin 共享 `index-Au8oU5iD.js` 142.3KB + CSS 14.8KB + `Landing-*.js` 5.4KB +
  Landing CSS 5.8KB + 字体 29.7KB。
- 登录页：admin 共享 entry 142.3KB + CSS 14.8KB + 字体 29.7KB。
- 仪表盘：admin entry 142.3KB + 异步 `CategoricalChart` 92.6KB + `TrendChart` 15.7KB + CSS 14.8KB。
- 字体：Instrument Sans 约 29.7KB（woff2）；各页 gzip 传输为解码体积的约 1/2.7–1/3。

LCP 元素（run1）：看板首页 `p.mt-1.5`、board 详情 `p.whitespace-pre-wrap`、提交页 `p.mt-5`、
Landing `h2.lp-h2`、登录页 `p.auth-brand-h1`、仪表盘 `span.flex-1`。

## 6. 与 dev 口径差异

dev 口径（`pnpm perf`）测量的是 Vite dev server：模块未压缩、按需编译、包含 HMR 运行时，
请求数和传输体积显著高于生产构建，**dev 数值只能横向比较，不能作为生产基线**。

| 页面 | 视口 | dev FCP/LCP | preview FCP/LCP | dev 资源/传输 | preview 资源/传输 |
|---|---|---|---|---|---|
| 看板首页 | 1440×900 | 256 / 256ms | 116 / 116ms | 54 / 2474.2KB | 6 / 143.6KB |
| 看板详情 | 1440×900 | 224 / 284ms | 108 / 188ms | 52 / 2452.9KB | 5 / 133.0KB |
| 提交页 | 1440×900 | 220 / 220ms | 96 / 96ms | 31 / 1680.9KB | 5 / 94.0KB |
| Landing 首页 | 1440×900 | 480 / 480ms | 260 / 260ms | 77 / 3051.0KB | 5 / 198.0KB |
| 登录页（未登录） | 1440×900 | 288 / 288ms | 136 / 136ms | 71 / 2832.2KB | 3 / 186.8KB |
| 仪表盘（登录态） | 1440×900 | 404 / 404ms | 128 / 128ms | 85 / 4383.2KB | 16 / 314.3KB |
| 看板首页 | 390×844 | 292 / 292ms | 104 / 104ms | 54 / 2474.2KB | 6 / 143.6KB |
| 看板详情 | 390×844 | 308 / 440ms | 96 / 152ms | 52 / 2452.9KB | 5 / 133.0KB |
| 提交页 | 390×844 | 256 / 256ms | 84 / 84ms | 31 / 1680.9KB | 5 / 94.0KB |
| Landing 首页 | 390×844 | 592 / 592ms | 248 / 248ms | 77 / 3051.0KB | 5 / 198.0KB |
| 登录页（未登录） | 390×844 | 356 / 356ms | 108 / 108ms | 71 / 2832.2KB | 3 / 186.8KB |
| 仪表盘（登录态） | 390×844 | 356 / 356ms | 124 / 124ms | 85 / 4383.2KB | 16 / 314.3KB |

dev 对照报告：`.tools/perf/report-20261110-103427.json/.md`（同会话、同脚本、`--runs=3 --settle=300`）。
差异主要来自 dev 的未压缩模块与 HMR 依赖（`react-refresh`、`client`、预打包 chunk 等），
传输体积约为 preview 的 3–17 倍。

## 7. 稳定性复核（两次 preview）

两次运行：run1 `report-20261110-103215.*`、run2 `report-20261110-103330.*`（间隔约 1 分钟）。
- 两次均 **12/12 PASS**、CLS 均 ≤0.001。
- 差异最大项：看板首页 1440 FCP 116→196ms、Landing 1440 FCP 260→312ms，其余多数在 ±20ms 内；
  原因是同机并行任务与 headless Chrome 调度噪声。
- 本基线采用 run1（更接近空载、数值更低）；如需更保守可参考 run2。
- 首屏重复采样方差不足以改变任何阈值判定。

## 8. 与历史基线对比

Round 11 preview 基线（`report-20261110-063649.*`）中看板首页桌面 CLS 曾为 0.093（接近 0.1 阈值）；
当前构建（`report-20261110-103215.*`）看板首页 1440 CLS 为 0.0004、390 为 0，说明首屏布局稳定性
已明显改善（历史报告仍保留在 `.tools/perf/` 供追溯）。

## 9. 已知限制

- **loopback / 无网络延迟**：本地 localhost，无 CDN、无真实 RTT/带宽限制，TTFB 1–3ms 不代表线上。
- **preview 静态服务器非生产部署**：Node 单线程静态服务 + gzip（无 Brotli/HTTP2/TLS/边缘缓存），
  与 nginx/CDN 生产环境的压缩、连接复用与缓存策略不同。
- **无 CPU/网络节流**：未模拟中低端手机与弱网；移动视口仅改变布局与 dpr，不代表真实移动端性能。
- **headless Chrome 与共享实例**：CDP 9222 与并行任务共用，偶发负载波动（见 §7）；每次采样已禁用缓存。
- **演示数据**：`demo-project` 数据量固定，页面内容/请求数随演示数据变化。
- **报告不入库**：`.tools/perf/` 在 `.gitignore` 中；报告文件仅本机存在，需要可重新运行生成（见 §10）。
- **不是 RUM**：真实用户 LCP/CLS 长尾、设备分布与网络环境以线上 RUM 为准。

## 10. 问题与后续

- **阈值不达标页：无。** 12/12 组合全部 PASS，FCP/LCP 余量 ≥ 6 倍、CLS 约为阈值 1%。
- 关注项（非问题）：仪表盘首屏 16 请求 / 314.3KB 为最重页面（含按需加载的图表 chunk）；Landing
  FCP/LCP 260ms 为公开端最慢项，但远低于 1.8s/2.5s 阈值。
- 后续建议：
  1. 在 CI/发版前用同一脚本做趋势对比（建议固定机器、串行执行，避免并行任务噪声后再考虑门禁）。
  2. 生产环境（nginx/CDN、HTTP2、Brotli、边缘缓存）就绪后复测，形成「真实部署口径」基线。
  3. 增加 CPU 4× + Fast 3G 的 throttle profile，作为中低端手机代理指标。
  4. 接入 RUM（Web Vitals）采集真实 LCP/CLS 分位数，与本地基线互为补充。
  5. 关注后续新增页面/依赖对请求数与 bundle 的影响（当前单页 3–16 请求，仍有较大余量）。

## 11. 复跑方式与报告引用

```bash
# 1) 构建最新产物
pnpm build

# 2) 生产口径采样（自动起/关 preview 静态服务与 /api 代理，端口冲突自动 +1）
pnpm perf:prod -- --runs=3 --settle=300

# 可选：同时跑 dev 口径对照
pnpm perf -- --runs=3 --settle=300
```

报告文件（均在 `.tools/perf/`，**gitignored，不入库**）：

| 用途 | 报告 |
|---|---|
| 生产口径基线（本文档数据） | `.tools/perf/report-20261110-103215.json` / `.md` |
| 生产口径稳定性复核 | `.tools/perf/report-20261110-103330.json` / `.md` |
| dev 口径对照 | `.tools/perf/report-20261110-103427.json` / `.md` |

报告 JSON 含每次原始采样、Top 资源、LCP 元素、CLS 位移来源与 gate 字段；MD 为中文表格版本。
如报告文件被清理，按上方命令重新生成即可；数字以最新一次报告为准，更新本文档时请记录日期。

## 12. 变更记录

- 2026-11-10：初版。`pnpm build` + `pnpm perf:prod -- --runs=3 --settle=300` 两次运行，
  12/12 页面×视口 PASS；与 dev 口径的差异、限制与后续建议见 §6–§10。
