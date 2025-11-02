import { useEffect, useRef } from 'react'
import '@xterm/xterm/css/xterm.css'
import { useTerminal } from '@/contexts/TerminalContext'
import type { Workspace } from '@/types/workspace'

// @ts-ignore - Electron IPC
const { ipcRenderer } = window.require('electron')

interface TerminalProps {
  workspace: Workspace
}

export function Terminal({ workspace }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const { getOrCreateTerminal } = useTerminal()
  const attachedWorkspaceRef = useRef<string | null>(null)

  // Initialize and attach terminal when workspace changes
  useEffect(() => {
    if (!workspace || !terminalRef.current) return

    let isMounted = true
    let resizeObserver: ResizeObserver | null = null
    let initPromptTimer: NodeJS.Timeout | null = null

    const initTerminal = async () => {
      console.log('[Terminal] Initializing terminal for workspace:', workspace.id, workspace.path)

      // Get or create terminal data (use workspace.path from closure, not dependency)
      const terminalData = await getOrCreateTerminal(workspace.id, workspace.path)
      if (!terminalData || !isMounted) {
        console.error('[Terminal] Failed to get terminal data or component unmounted')
        return
      }

      const { terminal, addons } = terminalData

      // Attach terminal to DOM if not already attached
      if (!terminalData.isAttached && terminalRef.current && isMounted) {
        console.log('[Terminal] Attaching terminal to DOM')

        // Load fonts before rendering terminal
        try {
          const FontFaceObserver = (await import('fontfaceobserver')).default
          const fontFamily = terminal.options.fontFamily || 'monospace'
          const primaryFont = fontFamily.split(',')[0].replace(/['"]/g, '').trim()

          console.log('[Terminal] Waiting for font to load:', primaryFont)

          const regular = new FontFaceObserver(primaryFont)
          const bold = new FontFaceObserver(primaryFont, { weight: 'bold' })

          await Promise.race([
            Promise.all([regular.load(), bold.load()]),
            new Promise(resolve => setTimeout(resolve, 2000))
          ])

          console.log('[Terminal] Fonts loaded successfully')
        } catch (e) {
          console.warn('[Terminal] Font loading failed or timed out, continuing anyway:', e)
        }

        if (!isMounted || !terminalRef.current) return

        // Open terminal
        terminal.open(terminalRef.current)
        terminalData.isAttached = true

        // Clear any buffered output from PTY initialization
        // This prevents duplicate prompts from React Strict Mode double-mount
        terminal.clear()
        console.log('[Terminal] Cleared buffered PTY output')

        // Load Canvas renderer for full transparency support
        // Note: WebGL doesn't support transparency (xterm.js Issue #4212)
        try {
          const { CanvasAddon } = await import('@xterm/addon-canvas')
          terminal.loadAddon(new CanvasAddon())
          console.log('[Terminal] Canvas renderer loaded (full transparency support)')
        } catch (e) {
          console.warn('[Terminal] Canvas addon failed, using DOM renderer:', e)
        }

        // Set up data input handler (only once per terminal)
        if (!terminalData.onDataDisposable) {
          console.log('[Terminal] Registering onData handler')
          terminalData.onDataDisposable = terminal.onData((data) => {
            ipcRenderer.invoke('terminal:write', workspace.id, data)
          })
        }

        // Fit terminal to container
        try {
          addons.fitAddon.fit()
        } catch (error) {
          console.error('[Terminal] Failed to fit terminal:', error)
        }

        // Send initial enter to trigger prompt display (only once per terminal session)
        if (!terminalData.hasInitialized && isMounted) {
          terminalData.hasInitialized = true
          console.log('[Terminal] Sending initial enter to trigger prompt')
          initPromptTimer = setTimeout(() => {
            if (isMounted) {
              ipcRenderer.invoke('terminal:write', workspace.id, '\r')
            }
          }, 300)
        }
      } else if (terminal.element && terminalRef.current && isMounted) {
        // Terminal was previously attached, re-attach it
        console.log('[Terminal] Re-attaching terminal element')

        // Clear previous terminal content from container
        while (terminalRef.current.firstChild) {
          terminalRef.current.removeChild(terminalRef.current.firstChild)
        }

        // Append the terminal element for this workspace
        terminalRef.current.appendChild(terminal.element)

        // Re-fit
        try {
          addons.fitAddon.fit()
        } catch (error) {
          console.error('[Terminal] Failed to fit terminal on re-attach:', error)
        }
      }

      if (!isMounted || !terminalRef.current) return

      // Set up resize observer
      resizeObserver = new ResizeObserver(() => {
        if (!isMounted) return
        try {
          addons.fitAddon.fit()
          const cols = terminal.cols
          const rows = terminal.rows
          ipcRenderer.invoke('terminal:resize', workspace.id, cols, rows)
        } catch (error) {
          console.error('[Terminal] Resize error:', error)
        }
      })

      resizeObserver.observe(terminalRef.current)

      // Initial resize
      try {
        addons.fitAddon.fit()
        const cols = terminal.cols
        const rows = terminal.rows
        ipcRenderer.invoke('terminal:resize', workspace.id, cols, rows)
      } catch (error) {
        console.error('[Terminal] Initial resize error:', error)
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
  }, [workspace.id, getOrCreateTerminal])

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
