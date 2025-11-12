/**
 * ChatInput - Enhanced chat input component
 *
 * This wraps the AI SDK Elements PromptInput for use in our Electron app,
 * with file attachment support and improved UX.
 */

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { useSettingsContext } from '@/contexts/SettingsContext'
import { useClaudeMetrics } from '@/hooks/useClaudeMetrics'
import { useThinkingMode as useThinkingModeHook } from '@/hooks/useThinkingMode'
import { useArchitectMode as useArchitectModeHook } from '@/hooks/useArchitectMode'
import { useAttachments } from '@/hooks/useAttachments'
import { AttachmentsPills } from './ChatInput/AttachmentsPills'
import { SlashCommandMenu } from './ChatInput/SlashCommandMenu'
import { ChatInputControls } from './ChatInput/ChatInputControls'
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
        <SlashCommandMenu
          showCommandMenu={showCommandMenu}
          filteredCommands={filteredCommands}
          selectedCommandIndex={selectedCommandIndex}
          onExecuteCommand={executeCommand}
          commandMenuRef={commandMenuRef}
        />
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
          <ChatInputControls
            showControls={showControls}
            disabled={disabled}
            isSending={isSending}
            isCancelling={isCancelling}
            value={value}
            hasAttachments={attachedFiles.length > 0}
            onAttachFile={handleOpenFilePicker}
            onCycleModel={cycleModel}
            onSend={handleSend}
            onCancel={onCancel}
            onCompact={handleCompact}
            currentModel={settings.model.default}
            modelLabels={modelLabels}
            thinkingMode={thinkingMode}
            thinkingModeLabels={thinkingModeLabels}
            onThinkingModeChange={setThinkingMode}
            architectMode={architectMode}
            onArchitectModeToggle={toggleArchitectMode}
            workspacePath={workspacePath}
            isPlanMode={isPlanMode}
            onPlanModeToggle={togglePlanMode}
            contextMetrics={metrics}
            INPUT_STYLES={INPUT_STYLES}
          />
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
