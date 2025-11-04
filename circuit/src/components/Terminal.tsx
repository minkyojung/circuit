import { useSettingsContext } from '@/contexts/SettingsContext'
import type { Workspace } from '@/types/workspace'
import { ClassicTerminal } from './terminal/ClassicTerminal'
import { ModernTerminal } from './terminal/ModernTerminal'

interface TerminalProps {
  workspace: Workspace
}

export function Terminal({ workspace }: TerminalProps) {
  const { settings } = useSettingsContext()

  // Render terminal based on mode setting
  if (settings.terminal.mode === 'modern') {
    return <ModernTerminal workspace={workspace} />
  }

  // Default to classic mode
  return <ClassicTerminal workspace={workspace} />
}
