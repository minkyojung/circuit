import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { Terminal as XTermTerminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { WebglAddon } from '@xterm/addon-webgl'
import FontFaceObserver from 'fontfaceobserver'
import { useTheme } from '@/hooks/useTheme'

// Use the secure Electron API exposed via preload script
const ipcRenderer = window.electron.ipcRenderer

interface TerminalAddons {
  fitAddon: FitAddon
  webLinksAddon: WebLinksAddon
}

interface TerminalData {
  terminal: XTermTerminal
  addons: TerminalAddons
  isAttached: boolean
  onDataDisposable?: { dispose: () => void }
  hasInitialized: boolean
}

interface TerminalState {
  // Workspace ID → terminal data
  terminals: Map<string, TerminalData>

  // Currently active workspace ID
  activeWorkspaceId: string | null

  // Terminal panel open state
  isOpen: boolean

  // Terminal panel height (for resizable feature)
  height: number
}

interface TerminalContextValue extends TerminalState {
  // Get or create terminal data for workspace
  getOrCreateTerminal: (workspaceId: string, workspacePath: string) => Promise<TerminalData | null>

  // Create PTY session for workspace
  createPtySession: (workspaceId: string, workspacePath: string) => Promise<boolean>

  // Switch active workspace
  switchWorkspace: (workspaceId: string | null) => void

  // Destroy terminal session
  destroyTerminal: (workspaceId: string) => void

  // Write data to terminal (send commands)
  writeData: (workspaceId: string, data: string) => void

  // UI state controls
  toggleTerminal: () => void
  setHeight: (height: number) => void

  // Check if terminal exists
  hasTerminal: (workspaceId: string) => boolean
}

const TerminalContext = createContext<TerminalContextValue | null>(null)

// LocalStorage keys
const TERMINAL_STATE_KEY = 'circuit-terminal-state'

interface PersistedTerminalState {
  isOpen: boolean
  height: number
}

function loadPersistedState(): PersistedTerminalState {
  try {
    const stored = localStorage.getItem(TERMINAL_STATE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    console.error('[TerminalContext] Failed to load persisted state:', error)
  }

  // Default values
  return {
    isOpen: false, // Start closed by default
    height: 300
  }
}

function savePersistedState(state: PersistedTerminalState) {
  try {
    localStorage.setItem(TERMINAL_STATE_KEY, JSON.stringify(state))
  } catch (error) {
    console.error('[TerminalContext] Failed to save persisted state:', error)
  }
}

interface TerminalProviderProps {
  children: ReactNode
}

/**
 * Helper function to get CSS variable values with HSL fallback
 */
function getCSSVar(varName: string): string {
  const rootStyles = getComputedStyle(document.documentElement);
  const value = rootStyles.getPropertyValue(varName).trim();
  // If it's HSL values without hsl(), wrap it
  if (value && !value.startsWith('#') && !value.startsWith('rgb') && !value.startsWith('hsl')) {
    return `hsl(${value})`;
  }
  return value;
}

/**
 * Updates terminal theme colors dynamically based on current CSS variables
 * This allows terminal colors to adapt when the app theme changes
 */
function updateTerminalTheme(terminal: XTermTerminal): void {
  terminal.options.theme = {
    // Don't set background - let CSS handle transparency with allowTransparency
    foreground: getCSSVar('--sidebar-foreground'),
    cursor: getCSSVar('--primary'),
    cursorAccent: getCSSVar('--sidebar-background'),
    selectionBackground: getCSSVar('--accent').replace(')', ' / 0.3)'), // Add 30% opacity
    selectionForeground: getCSSVar('--sidebar-foreground'),
    black: '#2e3436',
    red: '#cc0000',
    green: '#4e9a06',
    yellow: '#c4a000',
    blue: '#3465a4',
    magenta: '#75507b',
    cyan: '#06989a',
    white: '#d3d7cf',
    brightBlack: '#555753',
    brightRed: '#ef2929',
    brightGreen: '#8ae234',
    brightYellow: '#fce94f',
    brightBlue: '#729fcf',
    brightMagenta: '#ad7fa8',
    brightCyan: '#34e2e2',
    brightWhite: '#eeeeec',
  };
}

export function TerminalProvider({ children }: TerminalProviderProps) {
  // Use useRef for Map to avoid React re-render issues with mutable data
  const terminalsRef = useRef<Map<string, TerminalData>>(new Map())
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null)

  // Load persisted state
  const persistedState = loadPersistedState()
  const [isOpen, setIsOpen] = useState(persistedState.isOpen)
  const [height, setHeight] = useState(persistedState.height)

  // Keep track of sessions we've created
  const createdSessions = useRef<Set<string>>(new Set())

  // Watch for theme changes and update all terminal colors dynamically
  const { resolvedTheme } = useTheme()

  // Persist state changes
  useEffect(() => {
    savePersistedState({ isOpen, height })
  }, [isOpen, height])

  // Update all terminal colors when theme changes
  useEffect(() => {
    console.log('[TerminalContext] Theme changed, updating all terminal colors')
    terminalsRef.current.forEach((terminalData) => {
      updateTerminalTheme(terminalData.terminal)
    })
  }, [resolvedTheme])

  // Set up IPC listeners for terminal data and exit events
  useEffect(() => {
    console.log('[TerminalContext] Registering IPC listeners for terminal data')

    const handleTerminalData = (event: any, workspaceId: string, data: string) => {
      const terminalData = terminalsRef.current.get(workspaceId)
      if (terminalData) {
        terminalData.terminal.write(data)
      }
    }

    const handleTerminalExit = (event: any, workspaceId: string, exitCode: number) => {
      console.log(`[TerminalContext] Terminal exited for workspace: ${workspaceId}, exitCode: ${exitCode}`)

      // Clean up terminal instance
      const terminalData = terminalsRef.current.get(workspaceId)
      if (terminalData) {
        terminalData.terminal.dispose()
        terminalsRef.current.delete(workspaceId)
      }

      createdSessions.current.delete(workspaceId)
    }

    ipcRenderer.on('terminal:data', handleTerminalData)
    ipcRenderer.on('terminal:exit', handleTerminalExit)

    return () => {
      console.log('[TerminalContext] Removing IPC listeners for terminal data')
      ipcRenderer.removeListener('terminal:data', handleTerminalData)
      ipcRenderer.removeListener('terminal:exit', handleTerminalExit)
    }
  }, [])

  const getOrCreateTerminal = useCallback(async (workspaceId: string, workspacePath: string): Promise<TerminalData | null> => {
    const terminals = terminalsRef.current

    // Return existing terminal data
    if (terminals.has(workspaceId)) {
      console.log(`[TerminalContext] Reusing existing terminal for workspace: ${workspaceId}`)
      return terminals.get(workspaceId)!
    }

    // Create new terminal instance
    console.log(`[TerminalContext] Creating new terminal for workspace: ${workspaceId}`)

    try {
      // Create xterm.js instance (will be attached to DOM later)
      const terminal = new XTermTerminal({
        cursorBlink: true,
        fontSize: 12,
        fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", "Source Code Pro", "SF Mono", Menlo, Consolas, Monaco, "Courier New", monospace',
        fontWeight: '300',
        fontWeightBold: '600',
        scrollback: 1000,
        rows: 20,
        cols: 80,
        allowTransparency: true,
        drawBoldTextInBrightColors: true,
      })

      // Apply current theme colors dynamically
      updateTerminalTheme(terminal)

      // Create addons
      const fitAddon = new FitAddon()
      const webLinksAddon = new WebLinksAddon()

      // Load addons into terminal
      terminal.loadAddon(fitAddon)
      terminal.loadAddon(webLinksAddon)

      // Create terminal data
      const terminalData: TerminalData = {
        terminal,
        addons: { fitAddon, webLinksAddon },
        isAttached: false,
        hasInitialized: false
      }

      // Store terminal data
      terminals.set(workspaceId, terminalData)

      // DO NOT create PTY session here - let Terminal.tsx create it after terminal is opened
      // This prevents PTY output from being buffered before terminal is ready

      return terminalData
    } catch (error) {
      console.error('[TerminalContext] Failed to create terminal:', error)
      return null
    }
  }, [])

  const createPtySession = useCallback(async (workspaceId: string, workspacePath: string): Promise<boolean> => {
    // Create PTY session in main process (only if not already created)
    if (!createdSessions.current.has(workspaceId)) {
      console.log(`[TerminalContext] Creating PTY session for workspace: ${workspaceId}`)
      const result = await ipcRenderer.invoke('terminal:create-session', workspaceId, workspacePath)

      if (!result.success) {
        console.error(`[TerminalContext] Failed to create PTY session:`, result.error)
        return false
      }

      createdSessions.current.add(workspaceId)
      console.log(`[TerminalContext] PTY session created successfully for workspace: ${workspaceId}`)

      return true
    }

    console.log(`[TerminalContext] PTY session already exists for workspace: ${workspaceId}`)
    return true
  }, [])

  const switchWorkspace = (workspaceId: string | null) => {
    setActiveWorkspaceId(workspaceId)
  }

  const destroyTerminal = (workspaceId: string) => {
    console.log(`[TerminalContext] Destroying terminal for workspace: ${workspaceId}`)

    // Dispose xterm.js instance
    const terminalData = terminalsRef.current.get(workspaceId)
    if (terminalData) {
      terminalData.terminal.dispose()
      terminalsRef.current.delete(workspaceId)
    }

    // Destroy PTY session in main process
    ipcRenderer.invoke('terminal:destroy-session', workspaceId)
      .then((result: any) => {
        if (!result.success) {
          console.error(`[TerminalContext] Failed to destroy terminal session:`, result.error)
        }
      })

    createdSessions.current.delete(workspaceId)
  }

  const writeData = (workspaceId: string, data: string) => {
    console.log(`[TerminalContext] writeData called:`, {
      workspaceId,
      data: data.replace(/\n/g, '\\n'),
      dataLength: data.length
    })

    // Send data to PTY session via IPC
    ipcRenderer.invoke('terminal:write', workspaceId, data)
      .then((result: any) => {
        console.log(`[TerminalContext] writeData IPC response:`, result)
        if (!result?.success) {
          console.error(`[TerminalContext] Write failed:`, result?.error)
        }
      })
      .catch((error: any) => {
        console.error(`[TerminalContext] writeData IPC error:`, error)
      })
  }

  const toggleTerminal = () => {
    setIsOpen(prev => !prev)
  }

  const hasTerminal = (workspaceId: string): boolean => {
    return terminalsRef.current.has(workspaceId)
  }

  const contextValue: TerminalContextValue = {
    terminals: terminalsRef.current,
    activeWorkspaceId,
    isOpen,
    height,
    getOrCreateTerminal,
    createPtySession,
    switchWorkspace,
    destroyTerminal,
    writeData,
    toggleTerminal,
    setHeight,
    hasTerminal,
  }

  return (
    <TerminalContext.Provider value={contextValue}>
      {children}
    </TerminalContext.Provider>
  )
}

export function useTerminal(): TerminalContextValue {
  const context = useContext(TerminalContext)
  if (!context) {
    throw new Error('useTerminal must be used within a TerminalProvider')
  }
  return context
}
