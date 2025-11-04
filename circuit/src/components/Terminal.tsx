import type { Workspace } from '@/types/workspace'
import { ClassicTerminal } from './terminal/ClassicTerminal'

interface TerminalProps {
  workspace: Workspace
}

export function Terminal({ workspace }: TerminalProps) {
  // Always use classic terminal (stable xterm.js implementation)
  return <ClassicTerminal workspace={workspace} />
}
