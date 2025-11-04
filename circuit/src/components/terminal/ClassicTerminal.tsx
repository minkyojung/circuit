import { useEffect, useRef } from 'react'
import '@xterm/xterm/css/xterm.css'
import { useTerminal } from '@/contexts/TerminalContext'
import type { Workspace } from '@/types/workspace'

// @ts-ignore - Electron IPC
const { ipcRenderer } = window.require('electron')

interface ClassicTerminalProps {
  workspace: Workspace
}

export function ClassicTerminal({ workspace }: ClassicTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const { getOrCreateTerminal, createPtySession } = useTerminal()
  const attachedWorkspaceRef = useRef<string | null>(null)

  // Initialize and attach terminal when workspace changes
  useEffect(() => {
    if (!workspace || !terminalRef.current) return

    let isMounted = true
    let resizeObserver: ResizeObserver | null = null
    let initPromptTimer: NodeJS.Timeout | null = null
    let prevCols = 0
    let prevRows = 0

    // Debounce helper to prevent excessive resize calls during animations
    const debounce = <T extends (...args: any[]) => void>(
      func: T,
      wait: number
    ): ((...args: Parameters<T>) => void) => {
      let timeout: NodeJS.Timeout | null = null
      return (...args: Parameters<T>) => {
        if (timeout) clearTimeout(timeout)
        timeout = setTimeout(() => func(...args), wait)
      }
    }

    const initTerminal = async () => {
      console.log('[ClassicTerminal] Initializing terminal for workspace:', workspace.id, workspace.path)

      // Get or create terminal data (use workspace.path from closure, not dependency)
      const terminalData = await getOrCreateTerminal(workspace.id, workspace.path)
      if (!terminalData || !isMounted) {
        console.error('[ClassicTerminal] Failed to get terminal data or component unmounted')
        return
      }

      const { terminal, addons } = terminalData

      // Attach terminal to DOM if not already attached
      if (!terminalData.isAttached && terminalRef.current && isMounted) {
        console.log('[ClassicTerminal] Attaching terminal to DOM')
        console.log('[ClassicTerminal] hasInitialized:', terminalData.hasInitialized)

        // Load fonts before rendering terminal
        try {
          const FontFaceObserver = (await import('fontfaceobserver')).default
          const fontFamily = terminal.options.fontFamily || 'monospace'
          const primaryFont = fontFamily.split(',')[0].replace(/['"]/g, '').trim()

          console.log('[ClassicTerminal] Waiting for font to load:', primaryFont)

          const regular = new FontFaceObserver(primaryFont)
          const bold = new FontFaceObserver(primaryFont, { weight: 'bold' })

          await Promise.race([
            Promise.all([regular.load(), bold.load()]),
            new Promise(resolve => setTimeout(resolve, 2000))
          ])

          console.log('[ClassicTerminal] Fonts loaded successfully')
        } catch (e) {
          console.warn('[ClassicTerminal] Font loading failed or timed out, continuing anyway:', e)
        }

        if (!isMounted || !terminalRef.current) return

        // Load Canvas renderer BEFORE opening terminal for full transparency support
        // Note: WebGL doesn't support transparency (xterm.js Issue #4212)
        try {
          const { CanvasAddon } = await import('@xterm/addon-canvas')
          terminal.loadAddon(new CanvasAddon())
          console.log('[ClassicTerminal] Canvas renderer loaded (full transparency support)')
        } catch (e) {
          console.warn('[ClassicTerminal] Canvas addon failed, using DOM renderer:', e)
        }

        // Open terminal after canvas addon is loaded
        terminal.open(terminalRef.current)
        terminalData.isAttached = true

        // Set up data input handler (only once per terminal)
        if (!terminalData.onDataDisposable) {
          console.log('[ClassicTerminal] Registering onData handler')
          terminalData.onDataDisposable = terminal.onData((data) => {
            ipcRenderer.invoke('terminal:write', workspace.id, data)
          })
        }

        // Fit terminal to container
        try {
          addons.fitAddon.fit()
        } catch (error) {
          console.error('[ClassicTerminal] Failed to fit terminal:', error)
        }

        // Create PTY session AFTER terminal is opened and ready
        // This prevents PTY output from being buffered before terminal can display it
        if (!terminalData.hasInitialized && isMounted) {
          terminalData.hasInitialized = true
          console.log('[ClassicTerminal] Creating PTY session now that terminal is ready')
          const success = await createPtySession(workspace.id, workspace.path)
          if (!success) {
            console.error('[ClassicTerminal] Failed to create PTY session')
          }
        }
      } else if (terminal.element && terminalRef.current && isMounted) {
        // Terminal was previously attached, re-attach it
        console.log('[ClassicTerminal] Re-attaching terminal element for workspace:', workspace.id)
        console.log('[ClassicTerminal] Terminal instance ID:', terminal === terminalData.terminal ? 'same' : 'different')
        console.log('[ClassicTerminal] Has terminal element:', !!terminal.element)
        console.log('[ClassicTerminal] Current container children:', terminalRef.current.children.length)

        // Clear previous terminal content from container
        while (terminalRef.current.firstChild) {
          terminalRef.current.removeChild(terminalRef.current.firstChild)
        }
        console.log('[ClassicTerminal] Cleared container, now has:', terminalRef.current.children.length, 'children')

        // Append the terminal element for this workspace
        terminalRef.current.appendChild(terminal.element)
        console.log('[ClassicTerminal] Appended terminal element, now has:', terminalRef.current.children.length, 'children')

        // Re-fit
        try {
          addons.fitAddon.fit()
        } catch (error) {
          console.error('[ClassicTerminal] Failed to fit terminal on re-attach:', error)
        }
      }

      if (!isMounted || !terminalRef.current) return

      // Set up resize observer with intelligent PTY resize logic
      const handleResize = () => {
        if (!isMounted) return
        try {
          addons.fitAddon.fit()
          const cols = terminal.cols
          const rows = terminal.rows

          // Only resize PTY if:
          // 1. Terminal has valid dimensions (not hidden/collapsed)
          // 2. Dimensions actually changed (prevents redundant calls)
          if (cols > 10 && rows > 5 && (prevCols !== cols || prevRows !== rows)) {
            console.log(`[ClassicTerminal] Resizing PTY: ${prevCols}x${prevRows} → ${cols}x${rows}`)
            ipcRenderer.invoke('terminal:resize', workspace.id, cols, rows)
            prevCols = cols
            prevRows = rows
          }
        } catch (error) {
          console.error('[ClassicTerminal] Resize error:', error)
        }
      }

      const debouncedResize = debounce(handleResize, 150)
      resizeObserver = new ResizeObserver(debouncedResize)

      resizeObserver.observe(terminalRef.current)

      // Initial resize with same validation logic
      try {
        addons.fitAddon.fit()
        const cols = terminal.cols
        const rows = terminal.rows

        if (cols > 10 && rows > 5) {
          console.log(`[ClassicTerminal] Initial PTY size: ${cols}x${rows}`)
          ipcRenderer.invoke('terminal:resize', workspace.id, cols, rows)
          prevCols = cols
          prevRows = rows
        }
      } catch (error) {
        console.error('[ClassicTerminal] Initial resize error:', error)
      }

      attachedWorkspaceRef.current = workspace.id
    }

    initTerminal()

    // Cleanup function to prevent memory leaks and duplicate operations
    return () => {
      isMounted = false
      if (initPromptTimer) {
        clearTimeout(initPromptTimer)
      }
      if (resizeObserver) {
        resizeObserver.disconnect()
      }
    }
  }, [workspace.id, getOrCreateTerminal, createPtySession, workspace.path])

  return (
    <div
      ref={terminalRef}
      className="w-full h-full overflow-hidden bg-transparent"
      style={{
        padding: '8px',
        backgroundColor: 'transparent',
      }}
    />
  )
}
