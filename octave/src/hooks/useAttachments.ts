/**
 * useAttachments Hook
 *
 * Manages file attachments for chat input, including:
 * - Regular file uploads (images, PDFs, text)
 * - Code selections from editor
 * - Message references
 *
 * @example
 * const {
 *   attachedFiles,
 *   handleFileSelect,
 *   handleRemoveFile,
 *   handleOpenFilePicker,
 *   fileInputRef,
 *   clearAttachments
 * } = useAttachments({
 *   codeAttachment,
 *   messageAttachment,
 * });
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

export interface AttachedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string; // Data URL or Object URL
  // For code attachments
  code?: {
    content: string;
    filePath: string;
    lineStart: number;
    lineEnd: number;
  };
  // For message reference attachments
  message?: {
    id: string;
    content: string;
  };
}

interface UseAttachmentsParams {
  codeAttachment?: {
    code: string;
    filePath: string;
    lineStart: number;
    lineEnd: number;
  } | null;
  messageAttachment?: {
    messageId: string;
    content: string;
  } | null;
}

interface UseAttachmentsReturn {
  attachedFiles: AttachedFile[];
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleRemoveFile: (fileId: string) => void;
  handleOpenFilePicker: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  clearAttachments: () => void;
  addFile: (file: AttachedFile) => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_FILE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/markdown',
];

export function useAttachments({
  codeAttachment,
  messageAttachment,
}: UseAttachmentsParams = {}): UseAttachmentsReturn {
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Convert code attachment to AttachedFile when it changes
  useEffect(() => {
    if (!codeAttachment) {
      // Remove code attachment from attachedFiles if it was removed
      setAttachedFiles((prev) => prev.filter((f) => f.type !== 'code/selection'));
      return;
    }

    // Create AttachedFile from code attachment
    const codeAttachmentId = `code-${codeAttachment.filePath}-${codeAttachment.lineStart}-${codeAttachment.lineEnd}`;

    // Check if this code attachment already exists (check inside setState to avoid re-triggering)
    setAttachedFiles((prev) => {
      const exists = prev.some((f) => f.id === codeAttachmentId);
      if (exists) {
        return prev; // No change
      }

      const lineInfo =
        codeAttachment.lineEnd !== codeAttachment.lineStart
          ? `${codeAttachment.lineStart}-${codeAttachment.lineEnd}`
          : `${codeAttachment.lineStart}`;

      const codeFile: AttachedFile = {
        id: codeAttachmentId,
        name: `${codeAttachment.filePath}:${lineInfo}`,
        type: 'code/selection',
        size: codeAttachment.code.length,
        url: '', // Not used for code
        code: {
          content: codeAttachment.code,
          filePath: codeAttachment.filePath,
          lineStart: codeAttachment.lineStart,
          lineEnd: codeAttachment.lineEnd,
        },
      };

      return [...prev, codeFile];
    });
  }, [codeAttachment]);

  // Convert message attachment to AttachedFile when it changes
  useEffect(() => {
    if (!messageAttachment) {
      // Remove message attachment from attachedFiles if it was removed
      setAttachedFiles((prev) => prev.filter((f) => f.type !== 'message/reference'));
      return;
    }

    // Create AttachedFile from message attachment
    const messageAttachmentId = `message-${messageAttachment.messageId}`;

    // Check if this message attachment already exists
    setAttachedFiles((prev) => {
      const exists = prev.some((f) => f.id === messageAttachmentId);
      if (exists) {
        return prev; // No change
      }

      const messageFile: AttachedFile = {
        id: messageAttachmentId,
        name: 'Previous message',
        type: 'message/reference',
        size: messageAttachment.content.length,
        url: '', // Not used for messages
        message: {
          id: messageAttachment.messageId,
          content: messageAttachment.content,
        },
      };

      return [...prev, messageFile];
    });
  }, [messageAttachment]);

  // File attachment handling
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles: AttachedFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`File ${file.name} is too large (max 10MB)`);
        continue;
      }

      // Validate file type
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        toast.error(`File type ${file.type} is not supported`);
        continue;
      }

      // Create data URL for the file
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          newFiles.push({
            id: `file-${Date.now()}-${i}`,
            name: file.name,
            type: file.type,
            size: file.size,
            url: event.target.result as string,
          });

          // Update state after all files are read
          if (newFiles.length === files.length) {
            setAttachedFiles((prev) => [...prev, ...newFiles]);
            toast.success(`${newFiles.length} file(s) attached`);
          }
        }
      };
      reader.readAsDataURL(file);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleRemoveFile = useCallback((fileId: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== fileId));
  }, []);

  const handleOpenFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachedFiles([]);
  }, []);

  const addFile = useCallback((file: AttachedFile) => {
    setAttachedFiles((prev) => [...prev, file]);
  }, []);

  return {
    attachedFiles,
    handleFileSelect,
    handleRemoveFile,
    handleOpenFilePicker,
    fileInputRef,
    clearAttachments,
    addFile,
  };
}
