import { useState, useRef } from 'react';

type SubmitFormProps = {
  apiUrl: string;
  apiKey: string;
};

type FileEntry = {
  id: string;
  name: string;
  size: number;
  type: string;
  status: 'uploading' | 'done' | 'error';
  error?: string;
  previewUrl?: string;
};

const CATEGORIES = [
  { value: 'bug', label: 'Bug 报告', icon: 'M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { value: 'feature', label: '功能建议', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { value: 'performance', label: '性能问题', icon: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z' },
  { value: 'ui', label: 'UI 问题', icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z' },
  { value: 'other', label: '其他', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
];

const PRIORITIES = [
  { value: 'low', label: '低', color: 'bg-gray-100 text-gray-600 border-gray-200' },
  { value: 'medium', label: '中', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'high', label: '高', color: 'bg-red-50 text-red-600 border-red-200' },
];

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;
const MAX_CONTENT = 1000;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function isImageType(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

export function SubmitForm({ apiUrl, apiKey }: SubmitFormProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('bug');
  const [priority, setPriority] = useState('medium');
  const [contact, setContact] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const errors: Record<string, string> = {};
  if (touched.title && !title.trim()) errors.title = '请输入标题';
  if (touched.content && !content.trim()) errors.content = '请输入详细描述';
  if (content.length > MAX_CONTENT) errors.content = `超出字数限制`;

  const processFiles = async (fileList: FileList | File[]) => {
    const selectedFiles = Array.from(fileList);
    const remaining = MAX_FILES - files.length;
    if (remaining <= 0) return;

    const toProcess = selectedFiles.slice(0, remaining);
    const validFiles: File[] = [];

    for (const f of toProcess) {
      if (!ALLOWED_TYPES.includes(f.type)) {
        setError(`文件 ${f.name} 类型不支持`);
        continue;
      }
      if (f.size > MAX_FILE_SIZE) {
        setError(`文件 ${f.name} 超过 10MB 限制`);
        continue;
      }
      validFiles.push(f);
    }

    if (validFiles.length === 0) return;

    const uploadedEntries = await Promise.all(
      validFiles.map(async (f) => {
        const pendingId = `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const previewUrl = isImageType(f.type) ? URL.createObjectURL(f) : undefined;
        const entry: FileEntry = {
          id: pendingId,
          name: f.name,
          size: f.size,
          type: f.type,
          status: 'uploading',
          previewUrl,
        };

        // Add immediately for instant feedback
        setFiles(prev => [...prev, entry]);

        const formData = new FormData();
        formData.append('file', f);
        try {
          const res = await fetch(`${apiUrl}/upload`, {
            method: 'POST',
            headers: { 'X-API-Key': apiKey },
            body: formData,
          });
          const json = await res.json();
          if (json.code !== 0) throw new Error(json.message || '上传失败');
          return { pendingId, finalId: json.data.id as string, status: 'done' as const, error: undefined };
        } catch (err) {
          return { pendingId, finalId: pendingId, status: 'error' as const, error: err instanceof Error ? err.message : '上传失败' };
        }
      }),
    );

    // Replace pending entries with final results
    setFiles(prev => {
      const updated = [...prev];
      for (const result of uploadedEntries) {
        const idx = updated.findIndex(f => f.id === result.pendingId);
        if (idx !== -1) {
          updated[idx] = { ...updated[idx], id: result.finalId, status: result.status, error: result.error } as FileEntry;
        }
      }
      return updated;
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const removeFile = (id: string) => {
    setFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file?.previewUrl) URL.revokeObjectURL(file.previewUrl);
      return prev.filter(f => f.id !== id);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ title: true, content: true });
    if (!title.trim() || !content.trim()) {
      setError('标题和内容不能为空');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const attachmentIds = files.filter(f => f.status === 'done').map(f => f.id);
      const res = await fetch(`${apiUrl}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          category,
          priority,
          contact: contact.trim() || undefined,
          attachment_ids: attachmentIds.length > 0 ? attachmentIds : undefined,
          source: 'submit-page',
        }),
      });
      const json = await res.json();
      if (json.code !== 0) throw new Error(json.message);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSuccess(false);
    setTitle('');
    setContent('');
    setContact('');
    setTouched({});
    setError('');
    // Cleanup preview URLs
    files.forEach(f => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl); });
    setFiles([]);
  };

  if (success) {
    return (
      <div className="animate-fade-in-up rounded-xl border border-green-200 bg-green-50 p-10 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <svg className="h-8 w-8 animate-check text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-green-800">提交成功</h2>
        <p className="mt-2 text-sm text-green-600">感谢您的反馈，我们会尽快处理并跟进。</p>
        <button onClick={resetForm} className="mt-6 rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-200">
          继续提交
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="animate-fade-in-up space-y-5 rounded-xl border border-surface-3 bg-surface-0 p-6 shadow-sm">
      {/* Title */}
      <div>
        <label htmlFor="title" className="mb-1.5 block text-sm font-medium text-gray-700">标题 <span className="text-red-400">*</span></label>
        <input id="title" value={title} onChange={e => setTitle(e.target.value)} onBlur={() => setTouched(t => ({ ...t, title: true }))} className={`block w-full rounded-lg border px-3 py-2.5 text-sm transition-all focus:outline-none focus:ring-2 ${errors.title ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : 'border-surface-3 focus:border-brand-500 focus:ring-brand-100'}`} placeholder="简要描述您的反馈" required />
        {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title}</p>}
      </div>

      {/* Content */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="content" className="text-sm font-medium text-gray-700">详细描述 <span className="text-red-400">*</span></label>
          <span className={`text-xs ${content.length > MAX_CONTENT ? 'text-red-500 font-medium' : 'text-gray-400'}`}>{content.length}/{MAX_CONTENT}</span>
        </div>
        <textarea id="content" value={content} onChange={e => setContent(e.target.value)} onBlur={() => setTouched(t => ({ ...t, content: true }))} rows={4} className={`block w-full rounded-lg border px-3 py-2.5 text-sm transition-all focus:outline-none focus:ring-2 ${errors.content ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : 'border-surface-3 focus:border-brand-500 focus:ring-brand-100'}`} placeholder="请详细描述您遇到的问题或建议" required />
        {errors.content && <p className="mt-1 text-xs text-red-500">{errors.content}</p>}
      </div>

      {/* File upload area */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          附件<span className="ml-1 text-xs text-gray-400">（可选，最多 {MAX_FILES} 个）</span>
        </label>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/gif,image/webp,application/pdf"
          className="hidden"
          onChange={handleFileSelect}
        />

        {files.length < MAX_FILES && (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors ${
              dragOver
                ? 'border-brand-500 bg-brand-50'
                : 'border-surface-3 hover:border-gray-300 hover:bg-surface-2'
            }`}
          >
            <svg className="mx-auto mb-2 h-8 w-8 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
            </svg>
            <p className="text-sm text-gray-500">
              <span className="font-medium text-brand-600">点击选择文件</span> 或拖拽文件到此处
            </p>
            <p className="mt-1 text-xs text-gray-400">支持 PNG、JPEG、GIF、WebP、PDF，单文件不超过 10MB</p>
          </div>
        )}

        {files.length > 0 && (
          <div className="mt-3 space-y-2">
            {files.map(f => (
              <div
                key={f.id}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                  f.status === 'error'
                    ? 'border-red-200 bg-red-50'
                    : 'border-surface-3 bg-surface-1'
                }`}
              >
                {/* Preview thumbnail */}
                {f.previewUrl ? (
                  <img
                    src={f.previewUrl}
                    alt={f.name}
                    className="h-10 w-10 flex-shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-surface-2">
                    <svg className="h-5 w-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                  </div>
                )}

                {/* File info */}
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-medium ${f.status === 'error' ? 'text-red-700' : 'text-gray-700'}`}>
                    {f.name}
                  </p>
                  <p className={`text-xs ${f.status === 'error' ? 'text-red-500' : 'text-gray-400'}`}>
                    {formatFileSize(f.size)} · {f.type}
                  </p>
                </div>

                {/* Status */}
                {f.status === 'uploading' && (
                  <div className="flex flex-shrink-0 items-center gap-1.5">
                    <svg className="h-4 w-4 animate-spin text-brand-600" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeLinecap="round"/>
                    </svg>
                    <span className="text-xs text-brand-600">上传中</span>
                  </div>
                )}
                {f.status === 'done' && (
                  <svg className="h-4 w-4 flex-shrink-0 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 13l4 4L19 7"/>
                  </svg>
                )}
                {f.status === 'error' && (
                  <span className="flex-shrink-0 text-xs text-red-500" title={f.error}>失败</span>
                )}

                {/* Remove */}
                <button
                  type="button"
                  onClick={() => removeFile(f.id)}
                  className="flex-shrink-0 rounded p-1 text-gray-400 transition-colors hover:bg-surface-3 hover:text-gray-600"
                  aria-label={`移除 ${f.name}`}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Category chips */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">分类</label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(c => (
            <button key={c.value} type="button" onClick={() => setCategory(c.value)} className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${category === c.value ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-surface-3 bg-surface-0 text-gray-500 hover:border-gray-300 hover:text-gray-700'}`} aria-pressed={category === c.value}>
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={c.icon}/></svg>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Priority pills */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">优先级</label>
        <div className="flex gap-2">
          {PRIORITIES.map(p => (
            <button key={p.value} type="button" onClick={() => setPriority(p.value)} className={`rounded-full border px-4 py-1.5 text-xs font-medium transition-all ${priority === p.value ? p.color + ' ring-1 ring-offset-1' : 'border-surface-3 bg-surface-1 text-gray-400 hover:text-gray-600'}`} aria-pressed={priority === p.value}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contact */}
      <div>
        <label htmlFor="contact" className="mb-1.5 block text-sm font-medium text-gray-700">联系方式<span className="ml-1 text-xs text-gray-400">（可选）</span></label>
        <input id="contact" value={contact} onChange={e => setContact(e.target.value)} className="block w-full rounded-lg border border-surface-3 px-3 py-2.5 text-sm transition-all focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100" placeholder="邮箱或其他联系方式" />
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <svg className="h-4 w-4 flex-shrink-0 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Submit */}
      <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:opacity-60">
        {loading && <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeLinecap="round"/></svg>}
        {loading ? '提交中...' : '提交反馈'}
      </button>
    </form>
  );
}
