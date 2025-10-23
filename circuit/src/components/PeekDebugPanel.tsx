import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

/**
 * Debug panel for testing peek window states
 * Only visible in development
 */
export function PeekDebugPanel() {
  const [currentState, setCurrentState] = useState<string>('peek')

  const changeState = (state: 'hidden' | 'peek' | 'compact' | 'expanded') => {
    try {
      const { ipcRenderer } = window.require('electron')
      ipcRenderer.send('peek:debug-change-state', state)
      setCurrentState(state)
    } catch (e) {
      console.error('Failed to change peek state:', e)
    }
  }

  return (
    <Card className="fixed bottom-4 left-4 p-4 bg-card border-border shadow-lg z-50">
      <div className="space-y-3">
        <div className="text-xs font-semibold text-foreground/70 mb-2">
          🐛 Peek Panel Debug
        </div>

        <div className="text-xs text-muted-foreground mb-2">
          Current: <span className="font-mono text-foreground">{currentState}</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={currentState === 'hidden' ? 'default' : 'outline'}
            size="sm"
            onClick={() => changeState('hidden')}
            className="text-xs"
          >
            Hidden
          </Button>

          <Button
            variant={currentState === 'peek' ? 'default' : 'outline'}
            size="sm"
            onClick={() => changeState('peek')}
            className="text-xs"
          >
            Peek
          </Button>

          <Button
            variant={currentState === 'compact' ? 'default' : 'outline'}
            size="sm"
            onClick={() => changeState('compact')}
            className="text-xs"
          >
            Compact
          </Button>

          <Button
            variant={currentState === 'expanded' ? 'default' : 'outline'}
            size="sm"
            onClick={() => changeState('expanded')}
            className="text-xs"
          >
            Expanded
          </Button>
        </div>

        <div className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
          Transitions:
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              changeState('peek')
              setTimeout(() => changeState('compact'), 500)
            }}
            className="text-xs flex-1"
          >
            Peek → Compact
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              changeState('compact')
              setTimeout(() => changeState('expanded'), 500)
            }}
            className="text-xs flex-1"
          >
            Compact → Expanded
          </Button>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            changeState('peek')
            setTimeout(() => changeState('compact'), 500)
            setTimeout(() => changeState('expanded'), 1000)
            setTimeout(() => changeState('compact'), 1500)
            setTimeout(() => changeState('peek'), 2000)
          }}
          className="text-xs w-full"
        >
          Full Cycle Test
        </Button>
      </div>
    </Card>
  )
}
