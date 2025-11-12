/**
 * AttachmentsPills Component
 *
 * Displays attached files as interactive pills in Arc-inspired design.
 * Handles three types of attachments:
 * - Message references (green)
 * - Code selections (purple)
 * - Regular files (with preview)
 */

import React from 'react';
import { MessageCircle, Code, X, Paperclip } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AttachedFile } from '../ChatInput';

interface AttachmentsPillsProps {
  attachedFiles: AttachedFile[];
  onRemoveFile: (id: string) => void;
  onCodeAttachmentRemove?: () => void;
  onMessageAttachmentRemove?: () => void;
}

export const AttachmentsPills: React.FC<AttachmentsPillsProps> = ({
  attachedFiles,
  onRemoveFile,
  onCodeAttachmentRemove,
  onMessageAttachmentRemove,
}) => {
  if (attachedFiles.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="overflow-hidden"
      >
        <div>
          {/* Attachments Pills - Arc-inspired design */}
          <div className="flex flex-wrap gap-2">
            {attachedFiles.map((file) => {
              // Handle message reference attachments
              if (file.type === 'message/reference' && file.message) {
                return (
                  <div
                    key={file.id}
                    className="group flex items-center gap-2 pl-2 pr-2 py-2 rounded-xl bg-card transition-all"
                  >
                    {/* Message icon - Green */}
                    <div className="flex-shrink-0">
                      <div className="w-6 h-[30px] rounded-md bg-green-500/20 flex items-center justify-center">
                        <MessageCircle className="w-3 h-3 text-green-400" strokeWidth={2} />
                      </div>
                    </div>

                    {/* Message info - Vertical layout */}
                    <div className="flex flex-col justify-center min-w-0 gap-1">
                      <span className="text-sm font-light text-foreground max-w-[160px] truncate leading-tight">
                        Previous message
                      </span>
                      <span className="text-[10px] text-muted-foreground font-medium leading-tight">
                        {(file.message.content.length / 1000).toFixed(1)}k chars
                      </span>
                    </div>

                    {/* Remove button */}
                    <button
                      onClick={() => {
                        onRemoveFile(file.id);
                        onMessageAttachmentRemove?.();
                      }}
                      className="ml-0.5 p-0.5 rounded-md transition-colors opacity-60 group-hover:opacity-100 hover:text-foreground hover:bg-secondary/30 dark:hover:text-white dark:hover:bg-secondary/20"
                      aria-label="Remove message reference"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              }

              // Handle code attachments differently
              if (file.type === 'code/selection' && file.code) {
                const pathParts = file.code.filePath.split('/');
                const fileName = pathParts[pathParts.length - 1];
                const lineInfo = file.code.lineEnd !== file.code.lineStart
                  ? `${file.code.lineStart}-${file.code.lineEnd}`
                  : `${file.code.lineStart}`;

                return (
                  <div
                    key={file.id}
                    className="group flex items-center gap-2 pl-2 pr-2 py-2 rounded-xl bg-card transition-all"
                  >
                    {/* Code icon - Purple */}
                    <div className="flex-shrink-0">
                      <div className="w-6 h-[30px] rounded-md bg-purple-500/20 flex items-center justify-center">
                        <Code className="w-3 h-3 text-purple-400" strokeWidth={2} />
                      </div>
                    </div>

                    {/* Code info - Vertical layout */}
                    <div className="flex flex-col justify-center min-w-0 gap-1">
                      <span className="text-sm font-light text-foreground max-w-[160px] truncate leading-tight font-mono">
                        {fileName}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-medium leading-tight font-mono">
                        :{lineInfo}
                      </span>
                    </div>

                    {/* Remove button */}
                    <button
                      onClick={() => {
                        onRemoveFile(file.id);
                        onCodeAttachmentRemove?.();
                      }}
                      className="ml-0.5 p-0.5 rounded-md transition-colors opacity-60 group-hover:opacity-100 hover:text-foreground hover:bg-secondary/30 dark:hover:text-white dark:hover:bg-secondary/20"
                      aria-label="Remove code attachment"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              }

              // Regular file attachments
              const extension = file.name.split('.').pop()?.toUpperCase() || 'FILE';
              const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');

              return (
                <div
                  key={file.id}
                  className="group flex items-center gap-2 pl-2 pr-2 py-2 rounded-xl bg-card transition-all"
                >
                  {/* Icon/Thumbnail - Vertical rectangle */}
                  <div className="flex-shrink-0">
                    {file.type.startsWith('image/') ? (
                      <img
                        src={file.url}
                        alt={file.name}
                        className="w-6 h-[30px] rounded-md object-cover"
                      />
                    ) : (
                      <div className="w-6 h-[30px] rounded-md bg-black flex items-center justify-center">
                        <Paperclip className="w-3 h-3 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* File info - Vertical layout with spacing */}
                  <div className="flex flex-col justify-center min-w-0 gap-1">
                    <span className="text-sm font-light text-foreground max-w-[160px] truncate leading-tight">
                      {nameWithoutExt}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-medium leading-tight">
                      {extension}
                    </span>
                  </div>

                  {/* Remove button */}
                  <button
                    onClick={() => onRemoveFile(file.id)}
                    className="ml-0.5 p-0.5 rounded-md transition-colors opacity-60 group-hover:opacity-100 hover:text-foreground hover:bg-secondary/30 dark:hover:text-white dark:hover:bg-secondary/20"
                    aria-label="Remove attachment"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
