import { useCallback, useEffect, useRef, useState } from 'react';
import { uploadAttachment } from '../lib/api';
import { MAX_FILES, isImageType, validateAttachment } from '../lib/files';

export type AttachmentEntry = {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  status: 'uploading' | 'done' | 'error';
  error?: string;
  previewUrl?: string;
};

function createEntry(file: File): AttachmentEntry {
  const clientId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id: clientId,
    file,
    name: file.name,
    size: file.size,
    type: file.type,
    status: 'uploading',
    previewUrl: isImageType(file.type) ? URL.createObjectURL(file) : undefined,
  };
}

export function useAttachments(apiUrl: string, apiKey: string) {
  const [files, setFiles] = useState<AttachmentEntry[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [issue, setIssue] = useState<string | null>(null);
  const filesRef = useRef<AttachmentEntry[]>(files);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    return () => {
      for (const entry of filesRef.current) {
        if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
      }
    };
  }, []);

  const upload = useCallback(
    async (entry: AttachmentEntry) => {
      try {
        const result = await uploadAttachment(apiUrl, apiKey, entry.file);
        setFiles((prev) =>
          prev.map((item) =>
            item.id === entry.id ? { ...item, id: result.id, status: 'done' as const, error: undefined } : item,
          ),
        );
      } catch (err) {
        setFiles((prev) =>
          prev.map((item) =>
            item.id === entry.id
              ? {
                  ...item,
                  status: 'error' as const,
                  error: err instanceof Error ? err.message : '上传失败，请重试',
                }
              : item,
          ),
        );
      }
    },
    [apiUrl, apiKey],
  );

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const list = Array.from(incoming);
      if (list.length === 0) return;

      const remaining = MAX_FILES - files.length;
      if (remaining <= 0) {
        setIssue(`最多添加 ${MAX_FILES} 个附件`);
        return;
      }

      const accepted: AttachmentEntry[] = [];
      let firstIssue: string | null = null;

      for (const file of list.slice(0, remaining)) {
        const problem = validateAttachment(file);
        if (problem) {
          firstIssue = firstIssue ?? problem;
          continue;
        }
        accepted.push(createEntry(file));
      }

      setIssue(firstIssue);
      if (accepted.length === 0) return;
      setFiles((prev) => [...prev, ...accepted]);
      for (const entry of accepted) {
        void upload(entry);
      }
    },
    [files.length, upload],
  );

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
  }, []);

  const retryFile = useCallback(
    (id: string) => {
      const target = files.find((item) => item.id === id);
      if (!target || target.status !== 'error') return;
      const retried: AttachmentEntry = { ...target, status: 'uploading', error: undefined };
      setFiles((prev) => prev.map((item) => (item.id === id ? retried : item)));
      void upload(retried);
    },
    [files, upload],
  );

  const reset = useCallback(() => {
    for (const entry of filesRef.current) {
      if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
    }
    setFiles([]);
    setIssue(null);
    setDragOver(false);
  }, []);

  const attachmentIds = files.filter((item) => item.status === 'done').map((item) => item.id);
  const uploadingCount = files.filter((item) => item.status === 'uploading').length;
  const failedCount = files.filter((item) => item.status === 'error').length;

  return {
    files,
    attachmentIds,
    uploadingCount,
    failedCount,
    dragOver,
    issue,
    addFiles,
    removeFile,
    retryFile,
    reset,
    setIssue,
    dropHandlers: {
      onDragOver: (event: React.DragEvent) => {
        event.preventDefault();
        setDragOver(true);
      },
      onDragLeave: (event: React.DragEvent) => {
        event.preventDefault();
        setDragOver(false);
      },
      onDrop: (event: React.DragEvent) => {
        event.preventDefault();
        setDragOver(false);
        if (event.dataTransfer.files?.length) addFiles(event.dataTransfer.files);
      },
    },
  };
}
