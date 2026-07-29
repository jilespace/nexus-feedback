import { useState, useRef, useEffect } from 'react';
import { t, Locale } from './i18n';
import { fetchProjectCategories, ProjectCategory } from './api';

type FeedbackFormProps = {
  apiKey: string;
  apiUrl: string;
  primaryColor: string;
  onSuccess: () => void;
  onError: (msg: string) => void;
  locale?: Locale;
};

type FileEntry = {
  id: string;
  name: string;
  size: number;
  status: 'uploading' | 'done' | 'error';
  error?: string;
};



const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 3;
const MAX_CONTENT = 500;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function FeedbackForm({ apiKey, apiUrl, primaryColor, onSuccess, onError, locale = 'zh' }: FeedbackFormProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('bug');
  const [contact, setContact] = useState('');
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [categories, setCategories] = useState<ProjectCategory[]>([]);
  const [categoryLoading, setCategoryLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const slug = apiUrl.includes('/api/v1/public/')
      ? apiUrl.split('/api/v1/public/')[1]?.split('/')[0] || ''
      : '';
    if (slug) {
      fetchProjectCategories(apiUrl, slug).then(cats => {
        setCategories(cats);
        setCategoryLoading(false);
        if (cats[0]) setCategory(cats[0].name);
      });
    } else {
      setCategoryLoading(false);
    }
  }, [apiUrl]);

  const errors: Record<string, string> = {};
  if (touched.title && !title.trim()) errors.title = t(locale, 'titleRequired');
  if (touched.content && !content.trim()) errors.content = t(locale, 'descriptionRequired');
  if (content.length > MAX_CONTENT) errors.content = `${t(locale, 'charLimit')} (${content.length}/${MAX_CONTENT})`;

  const uploadFile = async (file: File): Promise<FileEntry | null> => {
    const entry: FileEntry = { id: `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`, name: file.name, size: file.size, status: 'uploading' };
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${apiUrl}/upload`, {
        method: 'POST',
        headers: { 'X-API-Key': apiKey },
        body: formData,
      });
      const json = await res.json();
      if (json.code !== 0) throw new Error(json.message || '上传失败');
      return { ...entry, id: json.data.id, status: 'done' };
    } catch (err) {
      return { ...entry, status: 'error', error: err instanceof Error ? err.message : '上传失败' };
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    e.target.value = ''; // reset input so same file can be re-selected

    const remaining = MAX_FILES - files.length;
    if (remaining <= 0) return;

    const toUpload = selectedFiles.slice(0, remaining);
    const validFiles: File[] = [];

    for (const f of toUpload) {
      if (!ALLOWED_TYPES.includes(f.type)) {
        onError(`文件 ${f.name} 类型不支持`);
        continue;
      }
      if (f.size > MAX_FILE_SIZE) {
        onError(`文件 ${f.name} 超过 10MB 限制`);
        continue;
      }
      validFiles.push(f);
    }

    if (validFiles.length === 0) return;

    // Add uploading entries immediately
    const uploadingEntries: FileEntry[] = validFiles.map(f => ({
      id: `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: f.name,
      size: f.size,
      status: 'uploading' as const,
    }));
    setFiles(prev => [...prev, ...uploadingEntries]);

    // Upload in parallel
    const results = await Promise.all(validFiles.map(uploadFile));
    setFiles(prev => {
      const updated = [...prev];
      for (const result of results) {
        if (!result) continue;
        const idx = updated.findIndex(f => f.id === result.id);
        if (idx !== -1) updated[idx] = result;
      }
      return updated;
    });
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ title: true, content: true });
    if (!title.trim() || !content.trim()) return;
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
          contact: contact.trim() || undefined,
          attachment_ids: attachmentIds.length > 0 ? attachmentIds : undefined,
          source: 'widget',
        }),
      });
      const json = await res.json();
      if (json.code !== 0) throw new Error(json.message);
      onSuccess();
    } catch (err) {
      onError(err instanceof Error ? err.message : '提交失败');
    } finally {
      setLoading(false);
    }
  };

  const baseInput: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid #e0e0e0', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s, box-shadow 0.15s' };
  const errorInput: React.CSSProperties = { borderColor: '#e53935', boxShadow: '0 0 0 2px rgba(229,57,53,0.1)' };
  const focusRing = `0 0 0 2px ${primaryColor}22`;

  return (
    <form onSubmit={handleSubmit} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div>
        <label style={{ fontSize: '12px', fontWeight: 500, color: '#555', marginBottom: '4px', display: 'block' }}>{t(locale, 'title')}</label>
        <input value={title} onChange={e => setTitle(e.target.value)} onBlur={() => setTouched(t => ({ ...t, title: true }))} placeholder={t(locale, 'titlePlaceholder')} style={{ ...baseInput, ...(errors.title ? errorInput : {}) }} onFocus={e => { e.currentTarget.style.boxShadow = focusRing; e.currentTarget.style.borderColor = primaryColor; }} onBlurCapture={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = errors.title ? '#e53935' : '#e0e0e0'; }} aria-label={t(locale, 'title')} aria-invalid={!!errors.title} />
        {errors.title && <span style={{ fontSize: '11px', color: '#e53935', marginTop: '2px', display: 'block' }}>{errors.title}</span>}
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <label style={{ fontSize: '12px', fontWeight: 500, color: '#555' }}>{t(locale, 'description')}</label>
          <span style={{ fontSize: '11px', color: content.length > MAX_CONTENT ? '#e53935' : '#999' }}>{content.length}/{MAX_CONTENT}</span>
        </div>
        <textarea value={content} onChange={e => setContent(e.target.value)} onBlur={() => setTouched(t => ({ ...t, content: true }))} placeholder={t(locale, 'descriptionPlaceholder')} rows={3} style={{ ...baseInput, resize: 'vertical', ...(errors.content ? errorInput : {}) }} onFocus={e => { e.currentTarget.style.boxShadow = focusRing; e.currentTarget.style.borderColor = primaryColor; }} onBlurCapture={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = errors.content ? '#e53935' : '#e0e0e0'; }} aria-label={t(locale, 'description')} aria-invalid={!!errors.content} />
        {errors.content && <span style={{ fontSize: '11px', color: '#e53935', marginTop: '2px', display: 'block' }}>{errors.content}</span>}
      </div>

      {/* File attachment area */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/gif,image/webp,application/pdf"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
        {files.length < MAX_FILES && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '5px 10px',
              border: `1px solid #e0e0e0`,
              borderRadius: '6px',
              background: '#f9f9f9',
              color: '#666',
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = primaryColor; e.currentTarget.style.color = primaryColor; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e0e0e0'; e.currentTarget.style.color = '#666'; }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
            </svg>
            {t(locale, 'attachment')} ({files.length}/{MAX_FILES})
          </button>
        )}

        {files.length > 0 && (
          <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {files.map(f => (
              <div
                key={f.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 10px',
                  border: `1px solid ${f.status === 'error' ? '#ffcdd2' : '#e0e0e0'}`,
                  borderRadius: '6px',
                  background: f.status === 'error' ? '#fff5f5' : '#fafafa',
                  fontSize: '11px',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={f.status === 'error' ? '#e53935' : '#999'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: f.status === 'error' ? '#c62828' : '#333' }}>
                  {f.name} ({formatFileSize(f.size)})
                </span>
                {f.status === 'uploading' && (
                  <span style={{ color: primaryColor, fontSize: '10px', flexShrink: 0 }}>{t(locale, 'uploading')}</span>
                )}
                {f.status === 'error' && (
                  <span style={{ color: '#c62828', fontSize: '10px', flexShrink: 0 }} title={f.error}>{f.error || '失败'}</span>
                )}
                <button
                  type="button"
                  onClick={() => removeFile(f.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#999',
                    cursor: 'pointer',
                    padding: '2px',
                    fontSize: '14px',
                    lineHeight: 1,
                    flexShrink: 0,
                  }}
                  aria-label={`移除 ${f.name}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <label style={{ fontSize: '12px', fontWeight: 500, color: '#555', marginBottom: '6px', display: 'block' }}>{t(locale, 'category')}</label>
        {categoryLoading ? (
          <div style={{ display: 'flex', gap: '6px' }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ width: '60px', height: '28px', borderRadius: '16px', background: '#f0f0f0', animation: 'pulse 1.5s infinite' }} />
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {categories.map(c => (
              <button key={c.name} type="button" onClick={() => setCategory(c.name)} aria-pressed={category === c.name} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '16px', border: category === c.name ? `1.5px solid ${c.color}` : '1.5px solid #e0e0e0', background: category === c.name ? `${c.color}11` : '#fff', color: category === c.name ? c.color : '#666', fontSize: '12px', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={c.icon || ''}/></svg>
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <label style={{ fontSize: '12px', fontWeight: 500, color: '#555', marginBottom: '4px', display: 'block' }}>{t(locale, 'contact')}</label>
        <input value={contact} onChange={e => setContact(e.target.value)} placeholder={t(locale, 'contactPlaceholder')} style={baseInput} onFocus={e => { e.currentTarget.style.boxShadow = focusRing; e.currentTarget.style.borderColor = primaryColor; }} onBlurCapture={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = '#e0e0e0'; }} aria-label={t(locale, 'contact')} />
      </div>

      <button type="submit" disabled={loading || !!errors.content} aria-label="Submit feedback" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: primaryColor, color: '#fff', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '14px', fontWeight: 600, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1, transition: 'opacity 0.15s' }}>
        {loading && <svg width="14" height="14" viewBox="0 0 24 24" style={{ animation: 'spin 0.8s linear infinite' }}><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeLinecap="round"/></svg>}
        {loading ? t(locale, 'submitting') : t(locale, 'submit')}
      </button>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </form>
  );
}
