import { useRef } from 'react';
import { MAX_FILES, formatFileSize, isImageType } from '../lib/files';
import type { AttachmentEntry } from '../hooks/useAttachments';
import {
  AlertCircleIcon,
  CheckCircleIcon,
  FileIcon,
  SpinnerIcon,
  UploadCloudIcon,
  XIcon,
} from './Icons';

type DropHandlers = {
  onDragOver: (event: React.DragEvent) => void;
  onDragLeave: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => void;
};

type AttachmentFieldProps = {
  files: AttachmentEntry[];
  dragOver: boolean;
  issue: string | null;
  uploadingCount: number;
  dropHandlers: DropHandlers;
  onAdd: (files: FileList | File[]) => void;
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
};

export function AttachmentField({
  files,
  dragOver,
  issue,
  uploadingCount,
  dropHandlers,
  onAdd,
  onRemove,
  onRetry,
}: AttachmentFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const reachedLimit = files.length >= MAX_FILES;
  const canAdd = !reachedLimit;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-1">
          附件
          <span className="font-normal text-ink-3">（可选）</span>
        </span>
        <span className="text-[11.5px] text-ink-3 tabular-nums">
          {files.length}/{MAX_FILES}
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/gif,image/webp,application/pdf"
        className="sr-only"
        tabIndex={-1}
        aria-label="添加附件"
        onChange={(event) => {
          if (event.target.files?.length) onAdd(event.target.files);
          event.target.value = '';
        }}
      />

      {canAdd ? (
        <div {...dropHandlers}>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={`group flex w-full items-center gap-3 rounded-field border border-dashed px-4 py-3.5 text-left transition-[border-color,background-color,box-shadow] duration-150 ${
              dragOver
                ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-600/15'
                : 'border-line-strong bg-surface-subtle hover:border-brand-500 hover:bg-brand-50/40'
            }`}
          >
            <span
              className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border bg-surface transition-colors ${
                dragOver ? 'border-brand-500 text-brand-600' : 'border-line text-ink-3 group-hover:text-brand-600'
              }`}
            >
              <UploadCloudIcon className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-medium text-ink-1">
                {dragOver ? '松开即可添加附件' : '点击选择文件，或拖拽到这里'}
              </span>
              <span className="mt-0.5 block text-[11.5px] leading-5 text-ink-3">
                PNG、JPG、GIF、WebP、PDF · 单个 ≤ 10MB
              </span>
            </span>
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-field border border-line bg-surface-subtle px-4 py-3">
          <span className="text-[12.5px] text-ink-2">已达到附件上限，可先移除已添加的文件</span>
          <span className="text-[11.5px] font-medium text-ink-3 tabular-nums">
            {files.length}/{MAX_FILES}
          </span>
        </div>
      )}

      {uploadingCount > 0 && (
        <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-brand-600" role="status" aria-live="polite">
          <SpinnerIcon className="h-3 w-3" />
          正在上传 {uploadingCount} 个附件…
        </p>
      )}

      {issue && (
        <p role="alert" className="nf-error-text">
          <AlertCircleIcon className="h-3.5 w-3.5 flex-shrink-0" />
          {issue}
        </p>
      )}

      {files.length > 0 && (
        <ul className="mt-3 space-y-2">
          {files.map((file) => {
            const isError = file.status === 'error';
            return (
              <li
                key={file.id}
                className={`relative flex items-center gap-3 overflow-hidden rounded-field border px-3 py-2.5 transition-colors ${
                  isError ? 'border-danger-500/30 bg-danger-50' : 'border-line bg-surface-subtle'
                }`}
              >
                {file.previewUrl ? (
                  <img
                    src={file.previewUrl}
                    alt=""
                    className="h-10 w-10 flex-shrink-0 rounded-[7px] border border-line object-cover"
                  />
                ) : (
                  <span
                    className={`flex h-10 w-10 flex-shrink-0 flex-col items-center justify-center gap-0.5 rounded-[7px] border ${
                      isError ? 'border-danger-500/20 bg-surface text-danger-500' : 'border-line bg-surface text-ink-3'
                    }`}
                  >
                    <FileIcon className="h-4 w-4" />
                    <span className="text-[8px] font-semibold uppercase">{isImageType(file.type) ? 'IMG' : 'PDF'}</span>
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-[12.5px] font-medium ${isError ? 'text-danger-700' : 'text-ink-1'}`}
                    title={file.name}
                  >
                    {file.name}
                  </p>
                  <p className={`mt-0.5 truncate text-[11px] ${isError ? 'text-danger-600' : 'text-ink-3'}`}>
                    {formatFileSize(file.size)}
                    {' · '}
                    {file.status === 'uploading' && '上传中…'}
                    {file.status === 'done' && '已添加'}
                    {file.status === 'error' && (file.error || '上传失败')}
                  </p>
                  {file.status === 'uploading' && (
                    <span className="mt-1.5 block h-[3px] overflow-hidden rounded-full bg-brand-100" aria-hidden>
                      <span className="block h-full w-1/3 animate-progress rounded-full bg-brand-600" />
                    </span>
                  )}
                </div>

                {file.status === 'uploading' && (
                  <SpinnerIcon className="h-4 w-4 flex-shrink-0 text-brand-600" />
                )}
                {file.status === 'done' && (
                  <CheckCircleIcon className="h-4 w-4 flex-shrink-0 text-success-500" />
                )}
                {file.status === 'error' && (
                  <button
                    type="button"
                    onClick={() => onRetry(file.id)}
                    className="flex-shrink-0 rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold text-danger-600 transition-colors hover:bg-danger-500/10"
                  >
                    重试
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onRemove(file.id)}
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-surface hover:text-ink-1"
                  aria-label={`移除 ${file.name}`}
                >
                  <XIcon className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
