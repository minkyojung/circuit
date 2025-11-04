import type { Workspace } from '@/types/workspace'
import { Terminal as TerminalIcon, Sparkles, Zap } from 'lucide-react'

interface ModernTerminalProps {
  workspace: Workspace
}

export function ModernTerminal({ workspace }: ModernTerminalProps) {
  return (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-background to-muted/20">
      <div className="text-center space-y-6 max-w-md px-8">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
            <div className="relative bg-gradient-to-br from-primary/10 to-primary/5 p-6 rounded-2xl border border-primary/20">
              <TerminalIcon className="w-12 h-12 text-primary" strokeWidth={1.5} />
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-foreground">
            Modern Terminal Mode
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Warp-inspired terminal with intelligent blocks, enhanced input, and AI integration
          </p>
        </div>

        {/* Features */}
        <div className="space-y-3 text-left">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
            <Sparkles className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-medium text-foreground">Block System</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Commands and outputs grouped for easy navigation
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
            <Zap className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-medium text-foreground">Enhanced Input</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Monaco editor with autocomplete and syntax highlighting
              </div>
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="pt-4 border-t border-border/50">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
              Coming Soon - Phase 2
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Block system implementation in progress
          </p>
        </div>
      </div>
    </div>
  )
}
