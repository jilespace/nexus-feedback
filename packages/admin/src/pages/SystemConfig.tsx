import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/api/client';
import { useToast } from '@/components/Toast';

type StorageType = 'local' | 's3' | 'qiniu';

const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100';
const labelCls = 'mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300';
const cardCls = 'rounded-lg border border-surface-3 bg-surface-0 p-6 dark:border-gray-700 dark:bg-gray-800';
const btnCls = 'rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50';

function SecretInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputCls} pr-14`}
        placeholder={placeholder}
      />
      <button type="button" onClick={() => setShow(!show)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400">
        {show ? '隐藏' : '显示'}
      </button>
    </div>
  );
}

export function SystemConfig() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [emailApiKey, setEmailApiKey] = useState('');
  const [emailFrom, setEmailFrom] = useState('');
  const [storageType, setStorageType] = useState<StorageType>('local');
  const [storageBucket, setStorageBucket] = useState('');
  const [storageRegion, setStorageRegion] = useState('');
  const [storageEndpoint, setStorageEndpoint] = useState('');
  const [storageAccessKey, setStorageAccessKey] = useState('');
  const [storageSecretKey, setStorageSecretKey] = useState('');
  const [storageDomain, setStorageDomain] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['system-config'],
    queryFn: () => apiRequest<Record<string, string>>('/org/system-config'),
  });

  useEffect(() => {
    if (data) {
      setEmailApiKey(data['email_api_key'] || '');
      setEmailFrom(data['email_from'] || '');
      setStorageType((data['storage_type'] as StorageType) || 'local');
      setStorageBucket(data['storage_bucket'] || '');
      setStorageRegion(data['storage_region'] || '');
      setStorageEndpoint(data['storage_endpoint'] || '');
      setStorageAccessKey(data['storage_access_key'] || '');
      setStorageSecretKey(data['storage_secret_key'] || '');
      setStorageDomain(data['storage_domain'] || '');
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: (configs: Record<string, string>) =>
      apiRequest('/org/system-config', { method: 'PUT', body: JSON.stringify({ configs }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-config'] });
      toast.show('配置已保存');
    },
    onError: (err) => toast.show(err instanceof Error ? err.message : '保存失败', 'error'),
  });

  const saveEmail = () => mutation.mutate({ email_api_key: emailApiKey, email_from: emailFrom });

  const saveStorage = () => {
    const c: Record<string, string> = { storage_type: storageType };
    if (storageType === 's3') Object.assign(c, { storage_bucket: storageBucket, storage_region: storageRegion, storage_endpoint: storageEndpoint, storage_access_key: storageAccessKey, storage_secret_key: storageSecretKey });
    else if (storageType === 'qiniu') Object.assign(c, { storage_bucket: storageBucket, storage_access_key: storageAccessKey, storage_secret_key: storageSecretKey, storage_domain: storageDomain });
    mutation.mutate(c);
  };

  if (isLoading) return <div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400">加载中...</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">系统配置</h1>
      <div className={cardCls}>
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">邮件配置</h2>
        <div className="space-y-4">
          <div><label className={labelCls}>API Key</label><SecretInput value={emailApiKey} onChange={setEmailApiKey} placeholder="输入 Resend API Key" /></div>
          <div><label className={labelCls}>发件人邮箱</label><input type="email" value={emailFrom} onChange={(e) => setEmailFrom(e.target.value)} className={inputCls} placeholder="notifications@example.com" /></div>
          <button onClick={saveEmail} disabled={mutation.isPending} className={btnCls}>{mutation.isPending ? '保存中...' : '保存邮件配置'}</button>
        </div>
      </div>
      <div className={cardCls}>
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">文件存储配置</h2>
        <div className="space-y-4">
          <div><label className={labelCls}>存储类型</label><select value={storageType} onChange={(e) => setStorageType(e.target.value as StorageType)} className={inputCls}><option value="local">本地存储</option><option value="s3">S3 兼容</option><option value="qiniu">七牛云</option></select></div>
          {storageType !== 'local' && (<><div><label className={labelCls}>Bucket</label><input type="text" value={storageBucket} onChange={(e) => setStorageBucket(e.target.value)} className={inputCls} /></div><div><label className={labelCls}>Access Key</label><SecretInput value={storageAccessKey} onChange={setStorageAccessKey} /></div><div><label className={labelCls}>Secret Key</label><SecretInput value={storageSecretKey} onChange={setStorageSecretKey} /></div></>)}
          {storageType === 's3' && (<><div><label className={labelCls}>Region</label><input type="text" value={storageRegion} onChange={(e) => setStorageRegion(e.target.value)} className={inputCls} /></div><div><label className={labelCls}>Endpoint</label><input type="text" value={storageEndpoint} onChange={(e) => setStorageEndpoint(e.target.value)} className={inputCls} /></div></>)}
          {storageType === 'qiniu' && (<div><label className={labelCls}>CDN 域名</label><input type="text" value={storageDomain} onChange={(e) => setStorageDomain(e.target.value)} className={inputCls} placeholder="cdn.example.com" /></div>)}
          <button onClick={saveStorage} disabled={mutation.isPending} className={btnCls}>{mutation.isPending ? '保存中...' : '保存存储配置'}</button>
        </div>
      </div>
    </div>
  );
}
