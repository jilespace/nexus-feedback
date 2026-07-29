import { useEffect, useState } from 'react';
import { SubmitForm } from './components/SubmitForm';

type AccessStatus = 'missing' | 'checking' | 'valid' | 'invalid';

export function App() {
  const apiUrl = '/api/v1';
  const apiKey = new URLSearchParams(window.location.search).get('key') ?? '';
  const [accessStatus, setAccessStatus] = useState<AccessStatus>(apiKey ? 'checking' : 'missing');
  const [accessMessage, setAccessMessage] = useState('');

  useEffect(() => {
    if (!apiKey) {
      setAccessStatus('missing');
      return;
    }

    let ignore = false;

    async function validateAccess() {
      setAccessStatus('checking');
      setAccessMessage('');

      try {
        const res = await fetch(`${apiUrl}/feedback/access`, {
          headers: { 'X-API-Key': apiKey },
        });
        const json = await res.json();
        if (ignore) return;

        if (res.ok && json.code === 0) {
          setAccessStatus('valid');
          return;
        }

        setAccessStatus('invalid');
        setAccessMessage(json.message || '链接无效或已过期');
      } catch {
        if (ignore) return;
        setAccessStatus('invalid');
        setAccessMessage('暂时无法校验链接，请稍后重试');
      }
    }

    validateAccess();

    return () => {
      ignore = true;
    };
  }, [apiKey]);

  const accessCard =
    accessStatus === 'missing' ? (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
        缺少 Project API Key。请通过正确的链接访问此页面。
      </div>
    ) : accessStatus === 'checking' ? (
      <div className="rounded-xl border border-surface-3 bg-surface-0 p-6 text-center text-sm text-gray-500 shadow-sm">
        正在校验访问链接...
      </div>
    ) : accessStatus === 'invalid' ? (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
        {accessMessage || '链接无效或已过期'}
      </div>
    ) : (
      <SubmitForm apiUrl={apiUrl} apiKey={apiKey} />
    );

  return (
    <div className="relative flex min-h-screen flex-col bg-surface-1">
      <div
        className="pointer-events-none fixed inset-0 opacity-40"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgb(92 124 250 / 0.08) 1px, transparent 0)',
          backgroundSize: '32px 32px',
        }}
      />

      <header className="relative z-10 border-b border-surface-3 bg-surface-0/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-900">提交反馈</h1>
            <p className="text-xs text-gray-500">感谢您花时间告诉我们您的想法</p>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 items-start justify-center px-4 py-10">
        <div className="w-full max-w-lg animate-fade-in-up">{accessCard}</div>
      </main>

      <footer className="relative z-10 border-t border-surface-3 bg-surface-0/60 py-4 text-center">
        <p className="text-xs text-gray-400">
          Powered by <span className="font-medium text-brand-600">Nexus Feedback</span>
        </p>
      </footer>
    </div>
  );
}
