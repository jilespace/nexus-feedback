# Widget 接入指南

## 包形态

Widget package 应输出：

- 面向现代构建工具的 ESM build。
- 面向 script 直接引入的 IIFE build。
- 面向 React 使用者的 TypeScript 类型。

## React 接入

```tsx
import { FeedbackWidget } from '@nexus-feedback/widget';

export function App() {
  return (
    <FeedbackWidget
      apiKey="nf_live_xxx"
      apiUrl="https://feedback.example.com/api/v1"
      position="bottom-right"
      locale="zh-CN"
      theme={{
        primaryColor: '#2563eb',
        accentColor: '#14b8a6',
        radius: 14,
        density: 'comfortable',
      }}
      context={{
        pageUrl: window.location.href,
        appVersion: '1.2.3',
      }}
    />
  );
}
```

## Props 契约

| Prop | 必填 | 说明 |
|---|---:|---|
| `apiKey` | 是 | Project API Key |
| `apiUrl` | 是 | 以 `/api/v1` 结尾的 API Base URL |
| `position` | 否 | `bottom-right`、`bottom-left`、`top-right`、`top-left` |
| `locale` | 否 | UI 语言 |
| `theme` | 否 | 视觉定制 |
| `context` | 否 | 作为 feedback `metadata` 提交的客户端上下文 |
| `defaultCategory` | 否 | 默认分类 |
| `onSubmitted` | 否 | 提交成功回调，参数包含 feedback id |
| `onError` | 否 | 规范化错误回调 |

## UI 状态

Widget 必须包含：

- 收起态 launcher。
- 展开态表单。
- 附件上传进度。
- 字段校验错误。
- 提交中状态。
- 提交成功状态。
- 可恢复失败状态和重试入口。

## 宿主页安全

- 不泄漏全局 CSS。
- 使用稳定的 z-index token。
- 不引起宿主页布局跳动。
- 不假设宿主应用安装了 Tailwind。
- 使用 CSS variables 支持主题定制。

如果使用 Shadow DOM，需要说明宿主应用如何覆盖主题变量。

## IIFE 接入

IIFE build 暴露一个全局对象：

```html
<script src="https://cdn.example.com/nexus-feedback-widget.iife.js"></script>
<script>
  window.NexusFeedback.mount({
    apiKey: 'nf_live_xxx',
    apiUrl: 'https://feedback.example.com/api/v1',
    position: 'bottom-right'
  });
</script>
```
