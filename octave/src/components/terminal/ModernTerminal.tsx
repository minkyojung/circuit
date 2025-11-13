import { useEffect, useRef, useState } from 'react'
import type { Workspace } from '@/types/workspace'
import { useSettingsContext } from '@/contexts/SettingsContext'
import { useBlocks } from '@/contexts/BlockContext'
import { useTerminal } from '@/contexts/TerminalContext'
import { BlockList } from './BlockList'
import { Terminal as TerminalIcon, Sparkles, Layers, Send, ChevronDown, FolderOpen, Home, Copy } from 'lucide-react'

interface ModernTerminalProps {
  workspace: Workspace
}

export function ModernTerminal({ workspace }: ModernTerminalProps) {
  const { settings } = useSettingsContext()
  const { getBlocks } = useBlocks()
  const { getOrCreateTerminal, createPtySession, writeData } = useTerminal()
  const [inputValue, setInputValue] = useState('')
  const [isPtyReady, setIsPtyReady] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  // Command history
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [tempInput, setTempInput] = useState('') // Save current input when navigating history

  // Directory dropdown
  const [isDirectoryDropdownOpen, setIsDirectoryDropdownOpen] = useState(false)

  // Get real blocks from BlockContext
  const blocks = getBlocks(workspace.id)

  const blocksEnabled = settings.terminal.modernFeatures.enableBlocks

  // Get current working directory from most recent block or workspace
  const getCurrentDirectory = (): string => {
    if (blocks.length > 0) {
      // Use cwd from most recent block
      const latestBlock = blocks[blocks.length - 1]
      if (latestBlock.cwd) {
        return latestBlock.cwd
      }
    }
    // Fallback to workspace path
    return workspace.path
  }

  // Format directory path - replace home directory with ~
  const formatPath = (path: string): string => {
    const homeDir = process.env.HOME || process.env.USERPROFILE || ''
    if (homeDir && path.startsWith(homeDir)) {
      return '~' + path.slice(homeDir.length)
    }
    return path
  }

  const currentDir = formatPath(getCurrentDirectory())

  // Get path segments for directory navigation
  const getPathSegments = (path: string): { name: string; fullPath: string }[] => {
    const homeDir = process.env.HOME || process.env.USERPROFILE || ''
    let segments: { name: string; fullPath: string }[] = []

    // Replace ~ with actual home directory for processing
    let fullPath = path
    if (path.startsWith('~')) {
      fullPath = homeDir + path.slice(1)
    }

    // Split path into segments
    const parts = fullPath.split('/').filter(p => p)
    let currentPath = ''

    // Add home segment
    segments.push({ name: '~', fullPath: homeDir })

    // Add each directory segment
    for (const part of parts) {
      currentPath += '/' + part
      const displayPath = currentPath.startsWith(homeDir)
        ? '~' + currentPath.slice(homeDir.length)
        : currentPath
      segments.push({ name: part, fullPath: displayPath })
    }

    return segments
  }

  // Handle directory change
  const handleChangeDirectory = (path: string) => {
    if (!writeData || !isPtyReady) return
    console.log('[ModernTerminal] Changing directory to:', path)
    writeData(workspace.id, `cd ${path}\n`)
    setIsDirectoryDropdownOpen(false)
  }

  const pathSegments = getPathSegments(currentDir)
  const currentFolderName = pathSegments[pathSegments.length - 1]?.name || 'unknown'

  // Load command history from localStorage on mount
  useEffect(() => {
    const storageKey = `octave-terminal-history-${workspace.id}`
    const savedHistory = localStorage.getItem(storageKey)
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory)
        if (Array.isArray(parsed)) {
          setHistory(parsed)
        }
      } catch (error) {
        console.warn('[ModernTerminal] Failed to parse history:', error)
      }
    }
  }, [workspace.id])

  // Save history to localStorage whenever it changes
  useEffect(() => {
    if (history.length > 0) {
      const storageKey = `octave-terminal-history-${workspace.id}`
      localStorage.setItem(storageKey, JSON.stringify(history))
    }
  }, [history, workspace.id])

  // Initialize PTY session for this workspace
  // CRITICAL: PTY session MUST be created regardless of blocksEnabled
  // The terminal needs PTY to function, blocks are just a UI feature
  useEffect(() => {
    let isMounted = true
    setIsInitializing(true)
    setIsPtyReady(false)

    const initPty = async () => {
      if (!workspace) {
        console.error('[ModernTerminal] No workspace provided')
        setIsInitializing(false)
        return
      }

      console.log('[ModernTerminal] Initializing PTY for workspace:', workspace.id)

      try {
        // Create terminal data (needed for PTY session)
        const terminalData = await getOrCreateTerminal(workspace.id, workspace.path)
        if (!terminalData || !isMounted) {
          console.error('[ModernTerminal] Failed to get terminal data')
          setIsInitializing(false)
          return
        }

        // Create PTY session if not already created
        if (!terminalData.hasInitialized) {
          console.log('[ModernTerminal] Creating new PTY session...')
          terminalData.hasInitialized = true
          const success = await createPtySession(workspace.id, workspace.path)

          if (!success) {
            console.error('[ModernTerminal] Failed to create PTY session')
            setIsPtyReady(false)
          } else {
            console.log('[ModernTerminal] ✓ PTY session created successfully')
            setIsPtyReady(true)
          }
        } else {
          console.log('[ModernTerminal] PTY session already exists')
          setIsPtyReady(true)
        }
      } catch (error) {
        console.error('[ModernTerminal] Error during PTY initialization:', error)
        setIsPtyReady(false)
      } finally {
        if (isMounted) {
          setIsInitializing(false)
        }
      }
    }

    initPty()

    return () => {
      isMounted = false
    }
  }, [workspace.id, workspace.path, getOrCreateTerminal, createPtySession])

  // Handle keyboard navigation through history
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Ctrl+C: Send interrupt signal to PTY
    if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()

      // Check if there's a running command
      const hasRunningBlock = blocks.some(b => b.status === 'running')

      if (hasRunningBlock && writeData && isPtyReady) {
        console.log('[ModernTerminal] Sending Ctrl+C (SIGINT) to PTY')
        // Send SIGINT (Ctrl+C) to PTY - ASCII code 3
        writeData(workspace.id, '\x03')
      } else if (inputValue) {
        // If no running command, clear input field
        setInputValue('')
      }
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (history.length === 0) return

      // Save current input when starting history navigation
      if (historyIndex === -1) {
        setTempInput(inputValue)
      }

      const newIndex = historyIndex === -1
        ? history.length - 1
        : Math.max(0, historyIndex - 1)

      setHistoryIndex(newIndex)
      setInputValue(history[newIndex])
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex === -1) return

      const newIndex = historyIndex + 1

      if (newIndex >= history.length) {
        // Back to current input
        setHistoryIndex(-1)
        setInputValue(tempInput)
      } else {
        setHistoryIndex(newIndex)
        setInputValue(history[newIndex])
      }
    }
  }

  // Handle command rerun from block
  const handleRerun = (command: string) => {
    console.log('[ModernTerminal] Rerunning command:', command)
    if (!writeData || !isPtyReady) {
      console.warn('[ModernTerminal] Cannot rerun - terminal not ready')
      return
    }

    // Add to history
    if (command && (history.length === 0 || history[history.length - 1] !== command)) {
      setHistory(prev => [...prev, command])
    }

    // Send to PTY
    writeData(workspace.id, command + '\n')
  }

  // Handle command submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    console.log('[ModernTerminal] handleSubmit called:', {
      inputValue,
      isPtyReady,
      hasWriteData: !!writeData,
      workspaceId: workspace.id
    })

    if (!inputValue.trim()) {
      console.log('[ModernTerminal] Empty input, ignoring')
      return
    }

    if (!writeData) {
      console.error('[ModernTerminal] writeData function not available!')
      return
    }

    if (!isPtyReady) {
      console.warn('[ModernTerminal] PTY not ready yet, waiting...')
      // Try to send anyway, IPC handler might queue it
    }

    // Add to history (avoid duplicates of last command)
    const trimmedInput = inputValue.trim()
    if (trimmedInput && (history.length === 0 || history[history.length - 1] !== trimmedInput)) {
      setHistory(prev => [...prev, trimmedInput])
    }

    // Reset history navigation
    setHistoryIndex(-1)
    setTempInput('')

    // Send command to PTY (with newline)
    console.log('[ModernTerminal] Sending command to PTY:', inputValue)
    try {
      writeData(workspace.id, inputValue + '\n')
      setInputValue('')
      console.log('[ModernTerminal] Command sent successfully')
    } catch (error) {
      console.error('[ModernTerminal] Failed to send command:', error)
    }
  }

  // Debug logging
  console.log('[ModernTerminal] Settings check:', {
    blocksEnabled,
    blocksCount: blocks.length,
    fullSettings: settings.terminal.modernFeatures,
  })

  if (!blocksEnabled) {
    // Show onboarding UI when blocks are disabled
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-background to-muted/20">
        <div className="text-center space-y-6 max-w-md px-8">
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
              <div className="relative bg-gradient-to-br from-primary/10 to-primary/5 p-6 rounded-2xl border border-primary/20">
                <Layers className="w-12 h-12 text-primary" strokeWidth={1.5} />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-foreground">
              Enable Block System
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Turn on blocks in Settings → Terminal → Modern Features
            </p>
          </div>

          <div className="p-4 rounded-lg bg-muted/30 border border-border/50 text-left">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="text-sm text-muted-foreground">
                Blocks group commands and outputs for easier navigation, copying, and AI analysis
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show block list (using real data from BlockContext)
  return (
    <div className="w-full h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/20">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">
            {workspace.name}
          </span>
          <span className="text-xs text-muted-foreground">
            • {blocks.length} blocks
          </span>
        </div>

        <div className="flex items-center gap-2">
          {blocks.length === 0 && (
            <div className="text-xs text-muted-foreground">
              Run commands to create blocks
            </div>
          )}
        </div>
      </div>

      {/* Block List or Empty State */}
      <div className="flex-1 overflow-hidden">
        {blocks.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center space-y-3 max-w-md px-8">
              <div className="text-muted-foreground">
                <TerminalIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No commands yet</p>
                <p className="text-xs mt-1">
                  Type a command below to get started
                </p>
              </div>
            </div>
          </div>
        ) : (
          <BlockList
            blocks={blocks}
            workspaceId={workspace.id}
            showTimestamps={settings.terminal.modernFeatures.showTimestamps}
            highlightFailed={settings.terminal.modernFeatures.highlightFailedCommands}
            onRerun={handleRerun}
            autoScroll={true}
          />
        )}
      </div>

      {/* Command Input Section */}
      <div className="border-t border-border bg-muted/20">
        {/* Directory Navigation Bar */}
        <div className="px-3 py-1.5 border-b border-border/50 bg-background/50">
          <div className="relative inline-block">
            <button
              onClick={() => setIsDirectoryDropdownOpen(!isDirectoryDropdownOpen)}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-muted/50 transition-colors text-xs"
              disabled={isInitializing}
            >
              <FolderOpen className="w-3 h-3 text-blue-500" />
              <span className="font-mono text-foreground text-xs">{currentFolderName}</span>
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </button>

            {/* Dropdown Menu */}
            {isDirectoryDropdownOpen && (
              <>
                {/* Backdrop to close dropdown */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setIsDirectoryDropdownOpen(false)}
                />

                {/* Menu */}
                <div className="absolute left-0 top-full mt-0.5 z-20 w-[280px] rounded border border-border bg-background shadow-lg">
                  {/* Current Full Path */}
                  <div className="px-2 py-1.5 border-b border-border/50 bg-muted/30">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-[10px] font-mono text-muted-foreground truncate flex-1">
                        {currentDir}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          navigator.clipboard.writeText(getCurrentDirectory())
                        }}
                        className="p-0.5 hover:bg-muted rounded transition-colors flex-shrink-0"
                        title="Copy full path"
                      >
                        <Copy className="w-2.5 h-2.5 text-muted-foreground" />
                      </button>
                    </div>
                  </div>

                  {/* Parent Directories */}
                  <div className="py-0.5 max-h-[200px] overflow-y-auto">
                    {pathSegments.slice(0, -1).reverse().map((segment, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleChangeDirectory(segment.fullPath)}
                        className="w-full px-2 py-1 text-left hover:bg-muted/50 transition-colors flex items-center gap-1.5"
                      >
                        {segment.name === '~' ? (
                          <Home className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <FolderOpen className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        )}
                        <span className="text-xs font-mono truncate">
                          {segment.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground ml-auto flex-shrink-0">
                          cd
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Command Input */}
        <form onSubmit={handleSubmit} className="flex items-center gap-2 px-4 py-3">
          <div className="text-sm text-muted-foreground font-mono">
            <span>$</span>
          </div>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isInitializing ? "Initializing terminal..." : (isPtyReady ? "Type a command..." : "Terminal not ready...")}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none font-mono"
            disabled={isInitializing}
            autoFocus
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isInitializing}
            className="p-1.5 rounded hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title={isInitializing ? "Initializing..." : (!isPtyReady ? "Terminal not ready" : "Send command")}
          >
            <Send className="w-4 h-4 text-muted-foreground" />
          </button>
        </form>
        {!isPtyReady && !isInitializing && (
          <div className="px-4 pb-2 text-xs text-amber-500">
            Terminal session not ready. Check console for errors.
          </div>
        )}
      </div>
    </div>
  )
}
