/**
 * ChatInput - Enhanced chat input component
 *
 * This wraps the AI SDK Elements PromptInput for use in our Electron app,
 * with file attachment support and improved UX.
 */

import React, { useState, useRef, useCallback } from 'react'
import { ArrowUp, Paperclip, X, Globe, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'

interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string, attachments: AttachedFile[]) => void | Promise<void>
  disabled?: boolean
  placeholder?: string
  showControls?: boolean
}

export interface AttachedFile {
  id: string
  name: string
  type: string
  size: number
  url: string  // Data URL or Object URL
}

const INPUT_STYLES = {
  container: {
    maxWidth: 'max-w-3xl',
  },
  textarea: {
    minHeight: 'min-h-[60px]',
    fontSize: 'text-base',
  },
  sendButton: {
    size: 'w-10 h-10',
    borderRadius: 'rounded-full',
    iconSize: 20,
  },
} as const

export const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = 'Ask, search, or make anything...',
  showControls = true,
}) => {
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // File attachment handling
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const newFiles: AttachedFile[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`File ${file.name} is too large (max 10MB)`)
        continue
      }

      // Validate file type (images, PDFs, text files)
      const allowedTypes = [
        'image/png',
        'image/jpeg',
        'image/gif',
        'image/webp',
        'application/pdf',
        'text/plain',
        'text/markdown',
      ]

      if (!allowedTypes.includes(file.type)) {
        toast.error(`File type ${file.type} is not supported`)
        continue
      }

      // Create data URL for the file
      const reader = new FileReader()
      reader.onload = (event) => {
        if (event.target?.result) {
          newFiles.push({
            id: `file-${Date.now()}-${i}`,
            name: file.name,
            type: file.type,
            size: file.size,
            url: event.target.result as string,
          })

          // Update state after all files are read
          if (newFiles.length === files.length) {
            setAttachedFiles((prev) => [...prev, ...newFiles])
            toast.success(`${newFiles.length} file(s) attached`)
          }
        }
      }
      reader.readAsDataURL(file)
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const handleRemoveFile = useCallback((fileId: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== fileId))
  }, [])

  const handleOpenFilePicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleSend = useCallback(async () => {
    if (!value.trim() && attachedFiles.length === 0) return
    if (disabled) return

    try {
      await onSubmit(value, attachedFiles)
      setAttachedFiles([]) // Clear attachments after send
    } catch (error) {
      console.error('[ChatInput] Submit error:', error)
      toast.error('Failed to send message')
    }
  }, [value, attachedFiles, disabled, onSubmit])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  // Auto-resize textarea
  const handleTextareaChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value)

      // Auto-resize
      const textarea = e.target
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    },
    [onChange]
  )

  return (
    <div className={`${INPUT_STYLES.container.maxWidth} mx-auto`}>
      {/* Input Card */}
      <div className="relative w-full flex flex-col border border-input rounded-xl bg-card shadow-sm">
          {/* Attached Files Preview */}
          {attachedFiles.length > 0 && (
            <div className="px-4 pt-3 pb-2 border-b border-border">
              <div className="flex flex-wrap gap-2">
                {attachedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/50 text-sm"
                  >
                    {file.type.startsWith('image/') ? (
                      <img
                        src={file.url}
                        alt={file.name}
                        className="w-6 h-6 rounded object-cover"
                      />
                    ) : (
                      <Paperclip className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className="max-w-[150px] truncate">{file.name}</span>
                    <button
                      onClick={() => handleRemoveFile(file.id)}
                      className="hover:text-destructive transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Context Button (placeholder for future) */}
          {showControls && (
            <div className="px-4 pt-4 pb-2">
              <button
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-base bg-secondary/50 hover:bg-secondary text-secondary-foreground border border-border/50 transition-colors"
                disabled
              >
                <span className="text-base">@</span>
                <span>Add context</span>
              </button>
            </div>
          )}

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className={`w-full px-4 bg-transparent border-none outline-none resize-none leading-relaxed text-card-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-0 ${INPUT_STYLES.textarea.fontSize} ${INPUT_STYLES.textarea.minHeight}`}
            rows={1}
            style={{ maxHeight: '200px' }}
          />

          {/* Control Bar */}
          <div className="flex items-center justify-between px-4 pb-4">
            {/* Left: Control buttons */}
            {showControls && (
              <div className="flex gap-2 items-center">
                {/* Attach File Button */}
                <button
                  onClick={handleOpenFilePicker}
                  disabled={disabled}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-muted-foreground hover:text-card-foreground hover:bg-accent transition-colors disabled:opacity-50"
                  title="Attach files (images, PDFs, text)"
                >
                  <Paperclip size={18} strokeWidth={1.5} />
                </button>

                {/* Model Selector (placeholder) */}
                <button
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-card-foreground hover:bg-accent transition-colors"
                  disabled
                >
                  <MessageSquare size={18} strokeWidth={1.5} />
                  <span>Auto</span>
                </button>

                {/* Sources Selector (placeholder) */}
                <button
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-card-foreground hover:bg-accent transition-colors"
                  disabled
                >
                  <Globe size={18} strokeWidth={1.5} />
                  <span>All Sources</span>
                </button>
              </div>
            )}

            {/* Right: Send button */}
            <button
              onClick={handleSend}
              disabled={(!value.trim() && attachedFiles.length === 0) || disabled}
              className={`${INPUT_STYLES.sendButton.size} ${INPUT_STYLES.sendButton.borderRadius} flex items-center justify-center transition-all shrink-0 ${
                (!value.trim() && attachedFiles.length === 0) || disabled
                  ? 'bg-muted/50 text-muted-foreground/40 cursor-not-allowed'
                  : 'bg-orange-500 text-white hover:bg-orange-600'
              }`}
              title="Send message (Cmd/Ctrl+Enter)"
            >
              <ArrowUp size={INPUT_STYLES.sendButton.iconSize} strokeWidth={2} />
            </button>
          </div>
        </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.txt,.md"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  )
}
