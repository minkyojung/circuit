import { useState, useEffect, useCallback } from 'react'

/**
 * Panel States
 */
export type PeekPanelState = 'hidden' | 'dot' | 'compact' | 'expanded'

/**
 * Test Result Data
 */
export interface TestResultData {
  type: 'test-result'
  status: 'running' | 'success' | 'failure'
  passed?: number
  failed?: number
  total?: number
  duration?: number
  errors?: string[]
}

/**
 * Custom Peek Data
 */
export interface CustomPeekData {
  type: 'custom'
  title: string
  message: string
  variant?: 'info' | 'success' | 'warning' | 'error'
}

/**
 * Peek Data Union Type
 */
export type PeekData = TestResultData | CustomPeekData | null

/**
 * Hook for managing the Circuit Peek Panel
 *
 * Features:
 * - Auto-show on test start/complete
 * - Manual show/hide via keyboard/mouse
 * - Auto-dismiss on success (after delay)
 * - Expandable states: dot → compact → expanded
 */
export function usePeekPanel() {
  const [state, setState] = useState<PeekPanelState>('compact')
  const [data, setData] = useState<PeekData>({
    type: 'custom',
    title: 'Circuit Peek',
    message: 'Press Cmd+T to toggle, Escape to hide',
    variant: 'info'
  })

  /**
   * Show panel with specific state and data
   */
  const show = useCallback((newState: PeekPanelState, newData?: PeekData) => {
    setState(newState)
    if (newData !== undefined) {
      setData(newData)
    }

    // Notify Electron to resize window
    try {
      const { ipcRenderer } = require('electron')
      ipcRenderer.send('peek:resize', {
        state: newState,
        data: newData || data
      })
    } catch (e) {
      console.warn('IPC not available:', e)
    }
  }, [data])

  /**
   * Hide panel
   */
  const hide = useCallback(() => {
    setState('hidden')
    setData(null)

    try {
      const { ipcRenderer } = require('electron')
      ipcRenderer.send('peek:resize', {
        state: 'hidden',
        data: null
      })
    } catch (e) {
      console.warn('IPC not available:', e)
    }
  }, [])

  /**
   * Expand to next state
   */
  const expand = useCallback(() => {
    const nextState: Record<PeekPanelState, PeekPanelState> = {
      'hidden': 'dot',
      'dot': 'compact',
      'compact': 'expanded',
      'expanded': 'expanded'
    }
    show(nextState[state])
  }, [state, show])

  /**
   * Collapse to previous state
   */
  const collapse = useCallback(() => {
    const prevState: Record<PeekPanelState, PeekPanelState> = {
      'hidden': 'hidden',
      'dot': 'hidden',
      'compact': 'dot',
      'expanded': 'compact'
    }
    show(prevState[state])
  }, [state, show])

  /**
   * Listen for test events from Electron main process
   */
  useEffect(() => {
    try {
      const { ipcRenderer } = require('electron')

      // Test started → show dot
      const handleTestStart = () => {
        show('dot', {
          type: 'test-result',
          status: 'running'
        })
      }

      // Test completed → show compact with results
      const handleTestComplete = (event: any, result: any) => {
        const testData: TestResultData = {
          type: 'test-result',
          status: result.success ? 'success' : 'failure',
          passed: result.passed,
          failed: result.failed,
          total: result.total,
          duration: result.duration,
          errors: result.errors
        }

        show('compact', testData)

        // Auto-dismiss after 5s if success
        if (result.success) {
          setTimeout(() => {
            if (state !== 'expanded') {
              hide()
            }
          }, 5000)
        }
      }

      ipcRenderer.on('test:started', handleTestStart)
      ipcRenderer.on('test:completed', handleTestComplete)

      return () => {
        ipcRenderer.removeListener('test:started', handleTestStart)
        ipcRenderer.removeListener('test:completed', handleTestComplete)
      }
    } catch (e) {
      console.warn('IPC not available in test listener:', e)
    }
  }, [show, hide, state])

  /**
   * Keyboard shortcuts and IPC toggle events
   */
  useEffect(() => {
    // Local keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to hide
      if (e.key === 'Escape' && state !== 'hidden') {
        e.preventDefault()
        hide()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    // Global shortcut from main process (Cmd+T)
    try {
      const { ipcRenderer } = require('electron')

      const handleToggle = () => {
        if (state === 'hidden') {
          show('compact')
        } else {
          hide()
        }
      }

      const handleShow = () => {
        show('compact')
      }

      ipcRenderer.on('peek:toggle', handleToggle)
      ipcRenderer.on('peek:show', handleShow)

      return () => {
        window.removeEventListener('keydown', handleKeyDown)
        ipcRenderer.removeListener('peek:toggle', handleToggle)
        ipcRenderer.removeListener('peek:show', handleShow)
      }
    } catch (e) {
      console.warn('IPC not available for shortcuts:', e)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [state, show, hide])

  return {
    state,
    data,
    show,
    hide,
    expand,
    collapse
  }
}
