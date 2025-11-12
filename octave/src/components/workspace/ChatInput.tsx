/**
 * ChatInput - Enhanced chat input component
 *
 * This wraps the AI SDK Elements PromptInput for use in our Electron app,
 * with file attachment support and improved UX.
 */

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { ArrowUp, Paperclip, X, ListChecks, ChevronDown, ListTodo, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { useSettingsContext } from '@/contexts/SettingsContext'
import { useClaudeMetrics } from '@/hooks/useClaudeMetrics'
import { useThinkingMode as useThinkingModeHook } from '@/hooks/useThinkingMode'
import { useArchitectMode as useArchitectModeHook } from '@/hooks/useArchitectMode'
import { useAttachments } from '@/hooks/useAttachments'
import { AnimatePresence, motion } from 'framer-motion'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ContextGauge } from './ContextGauge'
import { AttachmentsPills } from './ChatInput/AttachmentsPills'
import { FEATURES } from '@/config/features'
import type { ClaudeModel } from '@/types/settings'

const ipcRenderer = typeof window !== 'undefined' && (window as any).require ? (window as any).require('electron').ipcRenderer : null

export type ThinkingMode = 'normal' | 'think' | 'megathink' | 'ultrathink' | 'plan'

interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string, attachments: AttachedFile[], thinkingMode: ThinkingMode, architectMode: boolean) => void | Promise<void>
  disabled?: boolean
  placeholder?: string
  showControls?: boolean
  isSending?: boolean
  isCancelling?: boolean
  onCancel?: () => void
  workspacePath?: string
  projectPath?: string
  onAddTodo?: (content: string) => void | Promise<void>
  onCompact?: () => void | Promise<void>
  // Context metrics (calculated from messages)
  contextMetrics?: any
  // Code attachment from editor selection
  codeAttachment?: {
    code: string
    filePath: string
    lineStart: number
    lineEnd: number
  } | null
  onCodeAttachmentRemove?: () => void
  // Message reference attachment
  messageAttachment?: {
    messageId: string
    content: string
  } | null
  onMessageAttachmentRemove?: () => void
}

export interface AttachedFile {
  id: string
  name: string
  type: string
  size: number
  url: string  // Data URL or Object URL
  // For code attachments
  code?: {
    content: string
    filePath: string
    lineStart: number
    lineEnd: number
  }
  // For message reference attachments
  message?: {
    id: string
    content: string
  }
}

const INPUT_STYLES = {
  container: {
    maxWidth: 'max-w-none',
  },
  addContext: {
    button: 'h-6 px-3 py-1 text-sm scale-[0.8] origin-left',
  },
  textarea: {
    padding: 'p-0',
    minHeight: 'min-h-[80px]',
    fontSize: 'text-base font-light',
  },
  controls: {
    gap: 'gap-1',
    attachButton: 'h-[32px] px-2 py-1.5 rounded-md',
    attachIconSize: 16,
    modelButton: 'h-[32px] px-2 py-1.5 text-sm rounded-md',
    modelIconSize: 14,
    sourcesButton: 'h-[32px] px-2 py-1.5 text-sm rounded-md',
    sourcesIconSize: 14,
  },
  sendButton: {
    size: 'w-[32px] h-[32px]',
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
  isSending = false,
  isCancelling = false,
  onCancel,
  workspacePath,
  projectPath,
  onAddTodo,
  onCompact,
  contextMetrics,
  codeAttachment,
  onCodeAttachmentRemove,
  messageAttachment,
  onMessageAttachmentRemove,
}) => {
  const { settings, updateSettings } = useSettingsContext()
  const { metrics: fallbackMetrics } = useClaudeMetrics()

  // Use passed contextMetrics if available, fallback to useClaudeMetrics
  const metrics = contextMetrics || fallbackMetrics

  // Custom hooks for state management
  const { thinkingMode, setThinkingMode } = useThinkingModeHook()
  const { architectMode, setArchitectMode: setArchitectModeHook } = useArchitectModeHook(workspacePath)
  const {
    attachedFiles,
    handleFileSelect,
    handleRemoveFile,
    handleOpenFilePicker,
    fileInputRef,
    clearAttachments,
    addFile,
  } = useAttachments({
    codeAttachment,
    messageAttachment,
  })

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Code and message attachments are now handled by useAttachments hook

  // Slash commands state
  const [availableCommands, setAvailableCommands] = useState<Array<{ name: string; fileName: string; description?: string }>>([])
  const [showCommandMenu, setShowCommandMenu] = useState(false)
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0)
  const commandMenuRef = useRef<HTMLDivElement>(null)

  const thinkingModeLabels: Record<ThinkingMode, string> = {
    normal: 'Normal',
    think: 'Think',
    megathink: 'Megathink',
    ultrathink: 'Ultrathink',
    plan: 'Plan',
  }

  // Model cycling configuration
  const modelOrder: ClaudeModel[] = [
    'claude-sonnet-4-5-20250929',
    'claude-opus-4-20250514',
    'claude-haiku-4-20250918',
  ]

  const modelLabels: Record<ClaudeModel, string> = {
    'claude-sonnet-4-5-20250929': 'Sonnet 4.5',
    'claude-opus-4-20250514': 'Opus 4',
    'claude-haiku-4-20250918': 'Haiku 4',
  }

  // Cycle to next model
  const cycleModel = useCallback(() => {
    const currentIndex = modelOrder.indexOf(settings.model.default)
    const nextIndex = (currentIndex + 1) % modelOrder.length
    updateSettings('model', { default: modelOrder[nextIndex] })
  }, [settings.model.default, updateSettings])

  // Plan mode state (separate from thinking mode)
  const [isPlanMode, setIsPlanMode] = useState(false)

  // Plan mode toggle
  const togglePlanMode = useCallback(() => {
    setIsPlanMode(prev => !prev)
  }, [])

  // Architect mode toggle
  const toggleArchitectMode = useCallback(async () => {
    if (!workspacePath) {
      toast.error('No workspace path available');
      return;
    }

    try {
      const newValue = !architectMode;
      await setArchitectModeHook(newValue);
      toast.success(newValue ? 'Architect Mode enabled' : 'Architect Mode disabled');
    } catch (error) {
      console.error('[ChatInput] Failed to toggle architect mode:', error);
      toast.error('Failed to toggle Architect Mode');
    }
  }, [workspacePath, architectMode, setArchitectModeHook])

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

  // Load slash commands when workspace changes
  useEffect(() => {
    console.log('[ChatInput] 🔍 Slash Commands - workspacePath:', workspacePath)
    console.log('[ChatInput] 🔍 Slash Commands - ipcRenderer:', !!ipcRenderer)

    if (!workspacePath || !ipcRenderer) {
      console.log('[ChatInput] ⚠️ Slash Commands - Missing workspacePath or ipcRenderer, clearing commands')
      setAvailableCommands([])
      return
    }

    const loadCommands = async () => {
      try {
        console.log('[ChatInput] 📡 Slash Commands - Calling IPC with:', workspacePath)
        const result = await ipcRenderer.invoke('slash-commands:list', workspacePath)
        console.log('[ChatInput] 📥 Slash Commands - IPC Result:', result)

        if (result.success) {
          console.log('[ChatInput] ✅ Slash Commands - Loaded commands:', result.commands)
          setAvailableCommands(result.commands || [])
        } else {
          console.log('[ChatInput] ❌ Slash Commands - Failed:', result.error)
        }
      } catch (error) {
        console.error('[ChatInput] Failed to load slash commands:', error)
      }
    }

    loadCommands()
  }, [workspacePath])

  // Detect slash command input
  useEffect(() => {
    console.log('[ChatInput] 🎯 Input changed:', value)
    console.log('[ChatInput] 🎯 Available commands:', availableCommands.length)

    // Check if input starts with `/` and has at least one character after it
    if (value.startsWith('/') && value.length > 1 && !value.includes('\n')) {
      const command = value.slice(1).toLowerCase()

      // Filter commands that match the input
      const filtered = availableCommands.filter(cmd =>
        cmd.name.toLowerCase().startsWith(command)
      )

      console.log('[ChatInput] 🎯 Filtered commands:', filtered.length)

      if (filtered.length > 0) {
        console.log('[ChatInput] ✅ Showing command menu')
        setShowCommandMenu(true)
        setSelectedCommandIndex(0)
      } else {
        console.log('[ChatInput] ❌ No filtered commands, hiding menu')
        setShowCommandMenu(false)
      }
    } else if (value === '/') {
      // Show all commands when user types just `/`
      console.log('[ChatInput] 🎯 Typed "/" - available commands:', availableCommands.length)
      if (availableCommands.length > 0) {
        console.log('[ChatInput] ✅ Showing all commands')
        setShowCommandMenu(true)
        setSelectedCommandIndex(0)
      } else {
        console.log('[ChatInput] ❌ No commands available')
      }
    } else {
      setShowCommandMenu(false)
    }
  }, [value, availableCommands])

  // Get filtered commands for display
  const filteredCommands = useMemo(() => {
    if (!value.startsWith('/')) return []

    if (value === '/') {
      return availableCommands
    }

    const command = value.slice(1).toLowerCase()
    return availableCommands.filter(cmd =>
      cmd.name.toLowerCase().startsWith(command)
    )
  }, [value, availableCommands])

  // Execute slash command
  const executeCommand = useCallback(async (commandName: string) => {
    if (!workspacePath || !ipcRenderer) return

    try {
      // Load command content
      const result = await ipcRenderer.invoke('slash-commands:get', workspacePath, commandName)

      if (result.success) {
        // Clear input and close menu
        onChange('')
        setShowCommandMenu(false)

        // Submit the command content as a message
        await onSubmit(result.content, attachedFiles, thinkingMode, architectMode)

        toast.success(`Executed /${commandName}`)
      } else {
        toast.error(`Failed to load command: ${result.error}`)
      }
    } catch (error) {
      console.error('[ChatInput] Failed to execute command:', error)
      toast.error('Failed to execute command')
    }
  }, [workspacePath, onSubmit, attachedFiles, thinkingMode, architectMode, onChange])

  // File attachment handling is now done by useAttachments hook

  const handleSend = useCallback(async () => {
    if (!value.trim() && attachedFiles.length === 0) return
    if (disabled) return

    try {
      // Use 'plan' mode if isPlanMode is true, otherwise use selected thinkingMode
      const effectiveMode = isPlanMode ? 'plan' : thinkingMode
      await onSubmit(value, attachedFiles, effectiveMode, architectMode)
      clearAttachments() // Clear attachments after send
      // Keep Plan Mode, Thinking Mode, and Architect Mode sticky - don't reset
    } catch (error) {
      console.error('[ChatInput] Submit error:', error)
      toast.error('Failed to send message')
    }
  }, [value, attachedFiles, thinkingMode, isPlanMode, architectMode, disabled, onSubmit, clearAttachments])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Handle command menu navigation
      if (showCommandMenu && filteredCommands.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setSelectedCommandIndex(prev =>
            prev < filteredCommands.length - 1 ? prev + 1 : 0
          )
          return
        }

        if (e.key === 'ArrowUp') {
          e.preventDefault()
          setSelectedCommandIndex(prev =>
            prev > 0 ? prev - 1 : filteredCommands.length - 1
          )
          return
        }

        if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
          e.preventDefault()
          const selectedCommand = filteredCommands[selectedCommandIndex]
          if (selectedCommand) {
            executeCommand(selectedCommand.name)
          }
          return
        }

        if (e.key === 'Escape') {
          e.preventDefault()
          setShowCommandMenu(false)
          return
        }
      }

      // Normal send (Cmd/Ctrl+Enter)
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend, showCommandMenu, filteredCommands, selectedCommandIndex, executeCommand]
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

            addFile(newFile)
            toast.success(
              `Long text (${(pastedText.length / 1000).toFixed(1)}k chars) converted to attachment`
            )
          }
        }
        reader.readAsDataURL(blob)
      }
      // If text is under threshold, allow normal paste (do nothing)
    },
    [settings.attachments, addFile]
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

  // Reset textarea height when value is cleared
  useEffect(() => {
    if (value === '' && textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [value])

  // Handle compact action - delegates to parent component
  const handleCompact = useCallback(async () => {
    if (!onCompact) {
      console.warn('[ChatInput] No onCompact handler provided')
      return
    }

    try {
      console.log('[ChatInput] Triggering session compact...')
      await onCompact()
      console.log('[ChatInput] ✅ Session compact completed')
    } catch (error) {
      console.error('[ChatInput] Session compact failed:', error)
      toast.error('Failed to compact session')
    }
  }, [onCompact])

  // Handle add as todo
  const handleAddAsTodo = useCallback(async () => {
    if (!value.trim() || !onAddTodo) return

    try {
      await onAddTodo(value.trim())
      onChange('') // Clear input after adding
      toast.success('Added to tasks')
    } catch (error) {
      console.error('[ChatInput] Failed to add todo:', error)
      toast.error('Failed to add task')
    }
  }, [value, onAddTodo, onChange])

  return (
    <div className={INPUT_STYLES.container.maxWidth}>
      {/* Input Card - Floating */}
      <div
        className="relative w-full flex flex-col border-[0.5px] border-border rounded-2xl bg-muted p-4 gap-3 shadow-[0_-8px_40px_rgba(0,0,0,0.05),0_4px_6px_rgba(0,0,0,0.03)] dark:shadow-[0_-8px_40px_rgba(0,0,0,0.25),0_4px_6px_rgba(0,0,0,0.1)]"
      >
        {/* Slash Command Menu */}
        <AnimatePresence>
          {showCommandMenu && filteredCommands.length > 0 && (
            <motion.div
              ref={commandMenuRef}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-full left-0 mb-2 w-1/2 min-w-[400px] bg-card border border-border rounded-xl shadow-lg overflow-hidden z-50"
            >
              <div className="p-1 max-h-64 overflow-y-auto">
                {filteredCommands.map((command, index) => (
                  <button
                    key={command.name}
                    onClick={() => executeCommand(command.name)}
                    className={`w-full py-2 px-3 text-left cursor-pointer hover:bg-secondary/50 focus:bg-secondary/50 transition-colors rounded-md ${
                      index === selectedCommandIndex ? 'bg-secondary' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-light flex-shrink-0">/{command.name}</span>
                      {command.description && (
                        <span className="text-xs text-muted-foreground/60 flex-1 truncate">
                          {command.description}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
          {/* Attachments */}
          <AttachmentsPills
            attachedFiles={attachedFiles}
            onRemoveFile={handleRemoveFile}
            onCodeAttachmentRemove={onCodeAttachmentRemove}
            onMessageAttachmentRemove={onMessageAttachmentRemove}
          />

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
          <div className="flex items-center justify-between">
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

                {/* Model Selector - Cycle through models on click */}
                <button
                  onClick={cycleModel}
                  disabled={disabled}
                  className={`inline-flex items-center ${INPUT_STYLES.controls.modelButton} text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50`}
                  title={`Current: ${modelLabels[settings.model.default]} (click to cycle)`}
                >
                  <span className="font-light">{modelLabels[settings.model.default]}</span>
                </button>

                {/* Thinking Mode Selector */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={`inline-flex items-center gap-1 ${INPUT_STYLES.controls.modelButton} text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors`}
                      disabled={disabled}
                    >
                      <span className="font-light">{thinkingModeLabels[thinkingMode]}</span>
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

                {/* Architect Mode Toggle Button */}
                <button
                  onClick={toggleArchitectMode}
                  disabled={disabled || !workspacePath}
                  className={`inline-flex items-center justify-center ${INPUT_STYLES.controls.sourcesButton} transition-colors ${
                    architectMode
                      ? 'bg-[#192621] text-white hover:bg-[#223330] border border-[#2A3D35]'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }`}
                  title={architectMode ? 'Architect Mode ON' : 'Architect Mode OFF'}
                >
                  <Sparkles size={INPUT_STYLES.controls.sourcesIconSize} strokeWidth={1.5} />
                </button>

                {/* Plan Mode Toggle Button - Feature Flag Controlled */}
                {FEATURES.PLAN_MODE && (
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
                )}

                {/* Add as Todo Button - DISABLED */}
                {false && onAddTodo && value.trim() && (
                  <button
                    onClick={handleAddAsTodo}
                    disabled={disabled}
                    className={`inline-flex items-center justify-center ${INPUT_STYLES.controls.sourcesButton} text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50`}
                    title="Add as Task"
                  >
                    <ListTodo size={INPUT_STYLES.controls.sourcesIconSize} strokeWidth={1.5} />
                  </button>
                )}
              </div>
            )}

            {/* Right: Context Gauge and Send or Cancel button */}
            <div className="flex items-center gap-2">
              {showControls && (
                /* Context Gauge */
                <ContextGauge
                  percentage={metrics?.context.percentage ?? 0}
                  current={metrics?.context.current}
                  limit={metrics?.context.limit}
                  onCompact={handleCompact}
                  disabled={disabled}
                />
              )}
              {isSending && onCancel ? (
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
                    : 'bg-[#192621] text-white hover:bg-[#223330] border border-[#2A3D35]'
                }`}
                title="Send message (Cmd/Ctrl+Enter)"
              >
                <ArrowUp size={INPUT_STYLES.sendButton.iconSize} strokeWidth={2} />
              </button>
            )}
            </div>
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
