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
    maxWidth: 'max-w-4xl',
  },
  addContext: {
    button: 'h-6 px-3 py-1 text-sm scale-[0.8] origin-left',
  },
  textarea: {
    padding: 'px-4 py-3',
    minHeight: 'min-h-[80px]',
    fontSize: 'text-base font-light',
  },
  controls: {
    gap: 'gap-1',
    attachButton: 'h-[36px] px-2 py-2 rounded-md',
    attachIconSize: 16,
    modelButton: 'h-[36px] px-2 py-2 text-sm rounded-md',
    modelIconSize: 14,
    sourcesButton: 'h-[36px] px-2 py-2 text-sm rounded-md',
    sourcesIconSize: 14,
  },
  sendButton: {
    size: 'w-[36px] h-[36px]',
    borderRadius: 'rounded-full',
    iconSize: 16,
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
      {/* Input Card - Floating */}
      <div className="relative w-full flex flex-col border-2 border-border rounded-3xl bg-secondary/30 shadow-lg">
          {/* Attached Files Preview */}
          {attachedFiles.length > 0 && (
            <div className="px-4 pt-4 pb-3 border-b border-border">
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
            <div className="px-4 pt-4 pb-1">
              <button
                className={`inline-flex items-center gap-1.5 ${INPUT_STYLES.addContext.button} rounded-full border border-border/40 text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-colors`}
                disabled
              >
                <span className="text-xs">@</span>
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
            className={`w-full ${INPUT_STYLES.textarea.padding} bg-transparent border-none outline-none resize-none leading-relaxed text-card-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-0 ${INPUT_STYLES.textarea.fontSize} ${INPUT_STYLES.textarea.minHeight}`}
            rows={1}
            style={{ maxHeight: '200px' }}
          />

          {/* Control Bar */}
          <div className="flex items-center justify-between px-4 pb-4">
            {/* Left: Control buttons */}
            {showControls && (
              <div className={`flex ${INPUT_STYLES.controls.gap} items-center`}>
                {/* Attach File Button */}
                <button
                  onClick={handleOpenFilePicker}
                  disabled={disabled}
                  className={`inline-flex items-center ${INPUT_STYLES.controls.attachButton} text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50`}
                  title="Attach files"
                >
                  <Paperclip size={INPUT_STYLES.controls.attachIconSize} strokeWidth={1.5} />
                </button>

                {/* Model Selector (placeholder) */}
                <button
                  className={`inline-flex items-center gap-1 ${INPUT_STYLES.controls.modelButton} text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors`}
                  disabled
                >
                  <span>Auto</span>
                </button>

                {/* Sources Selector (placeholder) */}
                <button
                  className={`inline-flex items-center gap-1 ${INPUT_STYLES.controls.sourcesButton} text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors`}
                  disabled
                >
                  <Globe size={INPUT_STYLES.controls.sourcesIconSize} strokeWidth={1.5} />
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
                  : 'bg-foreground text-background hover:bg-foreground/90'
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
