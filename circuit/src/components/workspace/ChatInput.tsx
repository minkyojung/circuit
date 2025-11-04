/**
 * ChatInput - Enhanced chat input component
 *
 * This wraps the AI SDK Elements PromptInput for use in our Electron app,
 * with file attachment support and improved UX.
 */

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { ArrowUp, Paperclip, X, ListChecks, ChevronDown, ListTodo, Code } from 'lucide-react'
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
import { FEATURES } from '@/config/features'
import type { ClaudeModel } from '@/types/settings'

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
  workspacePath?: string
  projectPath?: string
  onAddTodo?: (content: string) => void | Promise<void>
  // Code attachment from editor selection
  codeAttachment?: {
    code: string
    filePath: string
    lineStart: number
    lineEnd: number
  } | null
  onCodeAttachmentRemove?: () => void
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
}

const INPUT_STYLES = {
  container: {
    maxWidth: 'max-w-none',
  },
  addContext: {
    button: 'h-6 px-3 py-1 text-sm scale-[0.8] origin-left',
  },
  textarea: {
    padding: 'px-4 pt-4 pb-0',
    minHeight: 'min-h-[108px]',
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
  isCancelling = false,
  onCancel,
  workspacePath,
  projectPath,
  onAddTodo,
  codeAttachment,
  onCodeAttachmentRemove,
}) => {
  const { settings, updateSettings } = useSettingsContext()
  const { metrics } = useClaudeMetrics()
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [thinkingMode, setThinkingMode] = useState<ThinkingMode>('normal')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Convert code attachment to AttachedFile when it changes
  useEffect(() => {
    if (!codeAttachment) {
      // Remove code attachment from attachedFiles if it was removed
      setAttachedFiles(prev => prev.filter(f => f.type !== 'code/selection'))
      return
    }

    // Check if this code attachment already exists
    const codeAttachmentId = `code-${codeAttachment.filePath}-${codeAttachment.lineStart}-${codeAttachment.lineEnd}`
    const exists = attachedFiles.some(f => f.id === codeAttachmentId)

    if (!exists) {
      // Create AttachedFile from code attachment
      const lineInfo = codeAttachment.lineEnd !== codeAttachment.lineStart
        ? `${codeAttachment.lineStart}-${codeAttachment.lineEnd}`
        : `${codeAttachment.lineStart}`

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
        }
      }

      setAttachedFiles(prev => [...prev, codeFile])
    }
  }, [codeAttachment, attachedFiles])

  // Slash commands state
  const [availableCommands, setAvailableCommands] = useState<Array<{ name: string; fileName: string }>>([])
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

  // Load slash commands when project changes
  useEffect(() => {
    console.log('[ChatInput] 🔍 Slash Commands - projectPath:', projectPath)
    console.log('[ChatInput] 🔍 Slash Commands - ipcRenderer:', !!ipcRenderer)

    if (!projectPath || !ipcRenderer) {
      console.log('[ChatInput] ⚠️ Slash Commands - Missing projectPath or ipcRenderer, clearing commands')
      setAvailableCommands([])
      return
    }

    const loadCommands = async () => {
      try {
        console.log('[ChatInput] 📡 Slash Commands - Calling IPC with:', projectPath)
        const result = await ipcRenderer.invoke('slash-commands:list', projectPath)
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
  }, [projectPath])

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
    if (!projectPath || !ipcRenderer) return

    try {
      // Load command content
      const result = await ipcRenderer.invoke('slash-commands:get', projectPath, commandName)

      if (result.success) {
        // Clear input and close menu
        onChange('')
        setShowCommandMenu(false)

        // Submit the command content as a message
        await onSubmit(result.content, attachedFiles, thinkingMode)

        toast.success(`Executed /${commandName}`)
      } else {
        toast.error(`Failed to load command: ${result.error}`)
      }
    } catch (error) {
      console.error('[ChatInput] Failed to execute command:', error)
      toast.error('Failed to execute command')
    }
  }, [projectPath, onSubmit, attachedFiles, thinkingMode, onChange])

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
      {/* Slash Command Menu */}
      <AnimatePresence>
        {showCommandMenu && filteredCommands.length > 0 && (
          <motion.div
            ref={commandMenuRef}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-0 right-0 mb-2 bg-card border border-border rounded-xl shadow-lg overflow-hidden z-50"
          >
            <div className="p-2 border-b border-border">
              <p className="text-xs text-muted-foreground">Slash Commands</p>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {filteredCommands.map((command, index) => (
                <button
                  key={command.name}
                  onClick={() => executeCommand(command.name)}
                  className={`w-full px-3 py-2 text-left transition-colors ${
                    index === selectedCommandIndex
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-secondary/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono">/{command.name}</span>
                  </div>
                </button>
              ))}
            </div>
            <div className="p-2 border-t border-border">
              <p className="text-[10px] text-muted-foreground">
                ↑↓ navigate • Enter select • Esc close
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Card - Floating */}
      <div className="relative w-full flex flex-col border-[0.5px] border-border rounded-2xl bg-muted shadow-lg">
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
                      // Handle code attachments differently
                      if (file.type === 'code/selection' && file.code) {
                        const pathParts = file.code.filePath.split('/')
                        const fileName = pathParts[pathParts.length - 1]
                        const lineInfo = file.code.lineEnd !== file.code.lineStart
                          ? `${file.code.lineStart}-${file.code.lineEnd}`
                          : `${file.code.lineStart}`

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
                                handleRemoveFile(file.id)
                                onCodeAttachmentRemove?.()
                              }}
                              className="ml-0.5 p-0.5 rounded-md transition-colors opacity-60 group-hover:opacity-100 hover:text-foreground hover:bg-secondary/30 dark:hover:text-white dark:hover:bg-secondary/20"
                              aria-label="Remove code attachment"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        )
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

                {/* Add as Todo Button */}
                {onAddTodo && value.trim() && (
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
