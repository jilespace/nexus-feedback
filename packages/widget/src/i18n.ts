type Locale = 'zh' | 'en';

const translations: Record<Locale, Record<string, string>> = {
  zh: {
    feedback: '反馈',
    submitFeedback: '提交反馈',
    thankYou: '感谢您的反馈！',
    thankYouDetail: '我们会尽快处理您的建议',
    submitFailed: '提交失败',
    retry: '重试',
    title: '标题 *',
    titlePlaceholder: '简要描述',
    description: '描述 *',
    descriptionPlaceholder: '详细描述您的反馈...',
    category: '分类',
    contact: '联系方式（可选）',
    contactPlaceholder: '邮箱或其他',
    attachment: '附件',
    uploading: '上传中...',
    submit: '提交反馈',
    submitting: '提交中...',
    titleRequired: '请输入标题',
    descriptionRequired: '请输入描述',
    charLimit: '超出字数限制',
    fileTypeNotSupported: '文件类型不支持',
    fileTooLarge: '超过 10MB 限制',
    remove: '移除',
  },
  en: {
    feedback: 'Feedback',
    submitFeedback: 'Submit Feedback',
    thankYou: 'Thank you for your feedback!',
    thankYouDetail: 'We will process your suggestion as soon as possible',
    submitFailed: 'Submission failed',
    retry: 'Retry',
    title: 'Title *',
    titlePlaceholder: 'Brief description',
    description: 'Description *',
    descriptionPlaceholder: 'Describe your feedback in detail...',
    category: 'Category',
    contact: 'Contact (optional)',
    contactPlaceholder: 'Email or other',
    attachment: 'Attachment',
    uploading: 'Uploading...',
    submit: 'Submit Feedback',
    submitting: 'Submitting...',
    titleRequired: 'Please enter a title',
    descriptionRequired: 'Please enter a description',
    charLimit: 'Character limit exceeded',
    fileTypeNotSupported: 'File type not supported',
    fileTooLarge: 'Exceeds 10MB limit',
    remove: 'Remove',
  },
};

export function t(locale: Locale, key: string): string {
  return translations[locale]?.[key] ?? translations.en[key] ?? key;
}

export type { Locale };
