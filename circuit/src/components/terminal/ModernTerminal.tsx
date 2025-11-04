import { useEffect, useRef } from 'react'
import type { Workspace } from '@/types/workspace'
import { useSettingsContext } from '@/contexts/SettingsContext'
import { useBlock } from '@/contexts/BlockContext'
import { useTerminal } from '@/contexts/TerminalContext'
import { BlockList } from './BlockList'
import { Terminal as TerminalIcon, Sparkles, Layers } from 'lucide-react'

interface ModernTerminalProps {
  workspace: Workspace
}

export function ModernTerminal({ workspace }: ModernTerminalProps) {
  const { settings } = useSettingsContext()
  const { getBlocks } = useBlock()
  const { getOrCreateTerminal, createPtySession } = useTerminal()

  // Get real blocks from BlockContext
  const blocks = getBlocks(workspace.id)

  const blocksEnabled = settings.terminal.modernFeatures.enableBlocks

  // Initialize PTY session for this workspace
  useEffect(() => {
    let isMounted = true

    const initPty = async () => {
      if (!workspace || !blocksEnabled) return

      console.log('[ModernTerminal] Initializing PTY for workspace:', workspace.id)

      // Create terminal data (needed for PTY session)
      const terminalData = await getOrCreateTerminal(workspace.id, workspace.path)
      if (!terminalData || !isMounted) {
        console.error('[ModernTerminal] Failed to get terminal data')
        return
      }

      // Create PTY session if not already created
      if (!terminalData.hasInitialized) {
        terminalData.hasInitialized = true
        const success = await createPtySession(workspace.id, workspace.path)
        if (!success) {
          console.error('[ModernTerminal] Failed to create PTY session')
        } else {
          console.log('[ModernTerminal] PTY session created successfully')
        }
      }
    }

    initPty()

    return () => {
      isMounted = false
    }
  }, [workspace.id, workspace.path, blocksEnabled, getOrCreateTerminal, createPtySession])

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
                  Commands you run will appear as blocks here
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
            autoScroll={true}
          />
        )}
      </div>
    </div>
  )
}
