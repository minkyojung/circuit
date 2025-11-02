/**
 * ChatInput - Enhanced chat input component
 *
 * This wraps the AI SDK Elements PromptInput for use in our Electron app,
 * with file attachment support and improved UX.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { ArrowUp, Paperclip, X, ListChecks, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { useSettingsContext } from '@/contexts/SettingsContext'
import { useClaudeMetrics } from '@/hooks/useClaudeMetrics'
import { AnimatePresence, motion } from 'framer-motion'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ContextGauge } from './ContextGauge'

// @ts-ignore - Electron IPC
const ipcRenderer = typeof window !== 'undefined' && (window as any).require ? (window as any).require('electron').ipcRenderer : null

export type ThinkingMode = 'normal' | 'think' | 'megathink' | 'ultrathink' | 'plan'

interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string, attachments: AttachedFile[], thinkingMode: ThinkingMode) => void | Promise<void>
  disabled?: boolean
  placeholder?: string
  showControls?: boolean
  isCancelling?: boolean
  onCancel?: () => void
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
    maxWidth: 'max-w-none',
  },
  addContext: {
    button: 'h-6 px-3 py-1 text-sm scale-[0.8] origin-left',
  },
  textarea: {
    padding: 'px-4 pt-3 pb-0',
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
  isCancelling = false,
  onCancel,
}) => {
  const { settings } = useSettingsContext()
  const { metrics } = useClaudeMetrics()
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [thinkingMode, setThinkingMode] = useState<ThinkingMode>('normal')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const thinkingModeLabels: Record<ThinkingMode, string> = {
    normal: 'Normal',
    think: 'Think',
    megathink: 'Megathink',
    ultrathink: 'Ultrathink',
    plan: 'Plan',
  }

  // Plan mode state (separate from thinking mode)
  const [isPlanMode, setIsPlanMode] = useState(false)

  // Plan mode toggle
  const togglePlanMode = useCallback(() => {
    setIsPlanMode(prev => !prev)
  }, [])

  // Keyboard shortcut: Cmd/Ctrl+Shift+P for Plan mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'P') {
        e.preventDefault()
        togglePlanMode()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePlanMode])

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
      // Use 'plan' mode if isPlanMode is true, otherwise use selected thinkingMode
      const effectiveMode = isPlanMode ? 'plan' : thinkingMode
      await onSubmit(value, attachedFiles, effectiveMode)
      setAttachedFiles([]) // Clear attachments after send
      // Keep Plan Mode and Thinking Mode sticky - don't reset
    } catch (error) {
      console.error('[ChatInput] Submit error:', error)
      toast.error('Failed to send message')
    }
  }, [value, attachedFiles, thinkingMode, isPlanMode, disabled, onSubmit])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  // Handle paste - auto-convert long text to attachment
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      // Check if auto-conversion is enabled
      if (!settings.attachments.autoConvertLongText) return

      const pastedText = e.clipboardData.getData('text')

      // Check if text exceeds threshold
      if (pastedText.length > settings.attachments.threshold) {
        e.preventDefault() // Prevent default paste

        // Create a text file from pasted content
        const blob = new Blob([pastedText], { type: 'text/plain' })

        // Convert to data URL
        const reader = new FileReader()
        reader.onload = (event) => {
          if (event.target?.result) {
            const newFile: AttachedFile = {
              id: `paste-${Date.now()}`,
              name: 'pasted_text.txt',
              type: 'text/plain',
              size: blob.size,
              url: event.target.result as string,
            }

            setAttachedFiles((prev) => [...prev, newFile])
            toast.success(
              `Long text (${(pastedText.length / 1000).toFixed(1)}k chars) converted to attachment`
            )
          }
        }
        reader.readAsDataURL(blob)
      }
      // If text is under threshold, allow normal paste (do nothing)
    },
    [settings.attachments]
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

  // Handle compact action (copy command + open Claude Code)
  const handleCompact = useCallback(() => {
    // Step 1: Copy "/compact" to clipboard
    navigator.clipboard.writeText('/compact').then(
      () => {
        console.log('[ChatInput] /compact command copied to clipboard')

        // Step 2: Open Claude Code (if IPC available)
        if (ipcRenderer) {
          try {
            ipcRenderer.send('open-claude-code', {})
            console.log('[ChatInput] Requested to open Claude Code')
          } catch (err) {
            console.error('[ChatInput] Failed to open Claude Code:', err)
          }
        }

        // Step 3: User feedback
        toast.info('📋 /compact copied. Run it in Claude Code!', {
          duration: 4000,
          action: {
            label: 'Copy again',
            onClick: () => {
              navigator.clipboard.writeText('/compact')
              toast.success('Copied again!')
            }
          }
        })
      },
      (err) => {
        console.error('[ChatInput] Failed to copy command:', err)
        toast.error('Failed to copy command')
      }
    )
  }, [])

  return (
    <div className={INPUT_STYLES.container.maxWidth}>
      {/* Input Card - Floating */}
      <div className="relative w-full flex flex-col border border-border rounded-3xl bg-muted shadow-lg">
          {/* Attachments - Only appears when files exist */}
          <AnimatePresence>
            {attachedFiles.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="pt-3 pb-2">
                  {/* Attachments Pills - Arc-inspired design */}
                  <div className="flex flex-wrap gap-2 px-4">
                    {attachedFiles.map((file) => {
                      // Extract file extension
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
                            onClick={() => handleRemoveFile(file.id)}
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
            )}
          </AnimatePresence>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={placeholder}
            disabled={disabled}
            className={`w-full ${INPUT_STYLES.textarea.padding} bg-transparent border-none outline-none resize-none leading-relaxed text-card-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-0 ${INPUT_STYLES.textarea.fontSize} ${INPUT_STYLES.textarea.minHeight}`}
            rows={1}
            style={{ maxHeight: '200px' }}
          />

          {/* Control Bar */}
          <div className="flex items-center justify-between px-4 pb-3">
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

                {/* Thinking Mode Selector */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={`inline-flex items-center gap-1 ${INPUT_STYLES.controls.modelButton} text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors`}
                      disabled={disabled}
                    >
                      <span>{thinkingModeLabels[thinkingMode]}</span>
                      <ChevronDown size={12} strokeWidth={1.5} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-40 p-1">
                    <DropdownMenuItem
                      onClick={() => setThinkingMode('normal')}
                      className={`py-2 px-3 cursor-pointer hover:bg-secondary/50 focus:bg-secondary/50 ${thinkingMode === 'normal' ? 'bg-secondary' : ''}`}
                    >
                      <span className="text-sm font-light">Normal</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setThinkingMode('think')}
                      className={`py-2 px-3 cursor-pointer hover:bg-secondary/50 focus:bg-secondary/50 ${thinkingMode === 'think' ? 'bg-secondary' : ''}`}
                    >
                      <span className="text-sm font-light">Think</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setThinkingMode('megathink')}
                      className={`py-2 px-3 cursor-pointer hover:bg-secondary/50 focus:bg-secondary/50 ${thinkingMode === 'megathink' ? 'bg-secondary' : ''}`}
                    >
                      <span className="text-sm font-light">Megathink</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setThinkingMode('ultrathink')}
                      className={`py-2 px-3 cursor-pointer hover:bg-secondary/50 focus:bg-secondary/50 ${thinkingMode === 'ultrathink' ? 'bg-secondary' : ''}`}
                    >
                      <span className="text-sm font-light">Ultrathink</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Plan Mode Toggle Button */}
                <button
                  onClick={togglePlanMode}
                  className={`inline-flex items-center justify-center ${INPUT_STYLES.controls.sourcesButton} transition-colors ${
                    isPlanMode
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }`}
                  title="Toggle Plan Mode (⌘⇧P)"
                >
                  <ListChecks size={INPUT_STYLES.controls.sourcesIconSize} strokeWidth={1.5} />
                </button>

                {/* Context Gauge */}
                <ContextGauge
                  percentage={metrics?.context.percentage ?? 0}
                  current={metrics?.context.current}
                  limit={metrics?.context.limit}
                  onCompact={handleCompact}
                  disabled={disabled}
                />
              </div>
            )}

            {/* Right: Send or Cancel button */}
            {disabled && onCancel ? (
              /* Cancel button when sending */
              <button
                onClick={onCancel}
                disabled={isCancelling}
                className={`${INPUT_STYLES.sendButton.size} ${INPUT_STYLES.sendButton.borderRadius} flex items-center justify-center transition-all shrink-0 ${
                  isCancelling
                    ? 'bg-muted/50 text-muted-foreground/40 cursor-not-allowed'
                    : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                }`}
                title={isCancelling ? "Cancelling..." : "Cancel message"}
              >
                <X size={INPUT_STYLES.sendButton.iconSize} strokeWidth={2} />
              </button>
            ) : (
              /* Send button */
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
            )}
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
