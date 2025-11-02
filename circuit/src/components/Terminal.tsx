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

    const initTerminal = async () => {
      console.log('[Terminal] Initializing terminal for workspace:', workspace.id, workspace.path)

      // Clear container
      if (terminalRef.current) {
        terminalRef.current.innerHTML = ''
      }

      // Get or create terminal data
      const terminalData = await getOrCreateTerminal(workspace.id, workspace.path)
      if (!terminalData) {
        console.error('[Terminal] Failed to get terminal data')
        return
      }

      const { terminal, addons } = terminalData

      // Attach terminal to DOM if not already attached
      if (!terminalData.isAttached && terminalRef.current) {
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
            new Promise(resolve => setTimeout(resolve, 2000)) // 2초 타임아웃
          ])

          console.log('[Terminal] Fonts loaded successfully')
        } catch (e) {
          console.warn('[Terminal] Font loading failed or timed out, continuing anyway:', e)
        }

        // Open terminal
        terminal.open(terminalRef.current)
        terminalData.isAttached = true

        // Load WebGL renderer for better performance (3-5x faster than canvas)
        try {
          const { WebglAddon } = await import('@xterm/addon-webgl')
          terminal.loadAddon(new WebglAddon())
          console.log('[Terminal] WebGL renderer loaded')
        } catch (e) {
          console.warn('[Terminal] WebGL not supported, using canvas renderer:', e)
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
        if (!terminalData.hasInitialized) {
          terminalData.hasInitialized = true
          console.log('[Terminal] Sending initial enter to trigger prompt')
          setTimeout(() => {
            ipcRenderer.invoke('terminal:write', workspace.id, '\r')
          }, 300)
        }
      } else if (terminal.element && terminalRef.current) {
        // Terminal was previously attached, re-attach it
        console.log('[Terminal] Re-attaching terminal element')
        terminalRef.current.appendChild(terminal.element)

        // Re-fit
        try {
          addons.fitAddon.fit()
        } catch (error) {
          console.error('[Terminal] Failed to fit terminal on re-attach:', error)
        }
      }

      // Set up resize observer
      const resizeObserver = new ResizeObserver(() => {
        try {
          addons.fitAddon.fit()
          const cols = terminal.cols
          const rows = terminal.rows
          ipcRenderer.invoke('terminal:resize', workspace.id, cols, rows)
        } catch (error) {
          console.error('[Terminal] Resize error:', error)
        }
      })

      if (terminalRef.current) {
        resizeObserver.observe(terminalRef.current)
      }

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

      return () => {
        resizeObserver.disconnect()
      }
    }

    initTerminal()
  }, [workspace.id, workspace.path, getOrCreateTerminal])

  return (
    <div
      ref={terminalRef}
      className="w-full h-full overflow-hidden"
    />
  )
}
