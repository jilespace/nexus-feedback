# 开发者接入指南

## 概述

Nexus Feedback 提供三种接入方式：

1. **Widget** — 可嵌入任何网页的浮动反馈按钮
2. **公开提交页** — 独立的反馈提交页面，可通过链接分享
3. **API 直接调用** — 适合服务端集成或自定义 UI

## 前置准备

### 获取 API Key

1. 登录管理后台 → 项目接入
2. 选择要接入的项目，查看允许的来源域名
3. 如需新凭证，重新生成 Project API Key（**仅显示一次，请妥善保存**）

---

## 方式一：嵌入 Widget

Widget 是一个自包含的 JS 文件，嵌入后会在页面右下角显示反馈按钮。

### CDN 引入（IIFE）

```html
<script src="https://your-domain.com/nexus-feedback-widget.iife.js"></script>
<script>
  const container = document.createElement('div');
  document.body.appendChild(container);

  NexusFeedbackWidget.mount(container, {
    apiKey: 'your-api-key',
    apiUrl: 'https://your-server.com/api/v1',
    position: 'bottom-right',  // 或 'bottom-left'
    theme: {
      primaryColor: '#4c6ef5', // 品牌主色
      buttonLabel: '反馈',     // 按钮文案
    },
  });
</script>
```

### ESM 引入（React 项目）

```bash
npm install @nexus-feedback/widget
```

```tsx
import { FeedbackWidget } from '@nexus-feedback/widget';

function App() {
  return (
    <>
      <YourApp />
      <FeedbackWidget
        apiKey="your-api-key"
        apiUrl="https://your-server.com/api/v1"
        position="bottom-right"
        theme={{ primaryColor: '#4c6ef5' }}
      />
    </>
  );
}
```

### 配置参数

| 参数 | 必填 | 说明 |
|---|---|---|
| `apiKey` | 是 | Project API Key |
| `apiUrl` | 是 | 服务端地址（含 `/api/v1`） |
| `position` | 否 | `bottom-right`（默认）或 `bottom-left` |
| `theme.primaryColor` | 否 | 品牌主色，默认 `#4c6ef5` |
| `theme.buttonLabel` | 否 | 按钮文案，默认 `反馈` |

---

## 方式二：公开提交页

公开提交页是一个独立页面，通过 URL 参数传递 Project API Key。

### 链接格式

```
https://your-domain.com/submit?key=your-api-key
```

适合以下场景：
- 在产品内嵌入 iframe
- 通过邮件/消息发送反馈链接
- 在帮助文档中提供反馈入口

---

## 方式三：API 直接调用

### 提交反馈

```bash
curl -X POST https://your-server.com/api/v1/feedback \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "title": "页面加载缓慢",
    "content": "首页加载需要 5 秒以上",
    "category": "performance",
    "priority": "high",
    "contact": "user@example.com"
  }'
```

**响应：**
```json
{
  "code": 0,
  "data": {
    "id": "cxxx...",
    "title": "页面加载缓慢",
    "status": "open",
    "created_at": "2026-05-24T10:30:00.000Z"
  },
  "message": "ok"
}
```

### 上传附件

```bash
curl -X POST https://your-server.com/api/v1/upload \
  -H "X-API-Key: your-api-key" \
  -F "file=@screenshot.png"
```

**响应：**
```json
{
  "code": 0,
  "data": {
    "id": "cxxx...",
    "url": "/uploads/xxx.png",
    "filename": "screenshot.png",
    "size": 245760,
    "mime_type": "image/png"
  },
  "message": "ok"
}
```

### 提交带附件的反馈

先上传附件获取 `id`，再在提交反馈时引用：

```bash
curl -X POST https://your-server.com/api/v1/feedback \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "title": "UI 显示异常",
    "content": "按钮在移动端被截断",
    "category": "ui",
    "attachment_ids": ["cxxx..."]
  }'
```

---

## 字段说明

### 反馈字段

| 字段 | 必填 | 类型 | 说明 |
|---|---|---|---|
| `title` | 是 | string | 1-200 字符 |
| `content` | 是 | string | 1-5000 字符 |
| `category` | 是 | enum | `bug`, `feature`, `performance`, `ui`, `other` |
| `priority` | 否 | enum | `low`, `medium`(默认), `high`, `critical` |
| `contact` | 否 | string | 联系方式，最多 200 字符 |
| `app_version` | 否 | string | 应用版本号，最多 50 字符 |
| `metadata` | 否 | object | 自定义键值对（如 page_url, user_id） |
| `attachment_ids` | 否 | string[] | 已上传附件 ID，最多 5 个 |

### 上传限制

| 限制 | 值 |
|---|---|
| 最大文件大小 | 10 MB |
| 支持的类型 | PNG, JPEG, GIF, WebP, PDF |
| 每条反馈最多附件 | 5 个 |

---

## 错误处理

所有错误响应格式统一：

```json
{
  "code": 40001,
  "data": null,
  "message": "validation failed"
}
```

常见错误码：

| Code | 含义 | 处理建议 |
|---|---|---|
| 40001 | 参数校验失败 | 检查必填字段和格式 |
| 40100 | API Key 缺失 | 添加 `X-API-Key` 请求头 |
| 40101 | API Key 无效 | 确认 Key 正确且未过期 |
| 41300 | 文件过大 | 压缩文件或选择更小的文件 |
| 41500 | 文件类型不支持 | 使用支持的文件格式 |

---

## 最佳实践

1. **API Key 安全** — 不要在前端代码中硬编码 Project API Key，Widget 和提交页通过配置注入
2. **错误重试** — 网络错误时建议重试 1-2 次，间隔 1-3 秒
3. **附件先传** — 先上传附件确认成功后再提交反馈，避免反馈创建后附件丢失
4. **metadata 活用** — 通过 metadata 传递页面 URL、用户 ID 等上下文，方便排查
