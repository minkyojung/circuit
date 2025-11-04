import { useState, useMemo } from 'react'
import type { Workspace } from '@/types/workspace'
import type { TerminalBlock } from '@/types/terminal'
import { useSettingsContext } from '@/contexts/SettingsContext'
import { BlockList } from './BlockList'
import { Terminal as TerminalIcon, Sparkles, Layers } from 'lucide-react'

interface ModernTerminalProps {
  workspace: Workspace
}

export function ModernTerminal({ workspace }: ModernTerminalProps) {
  const { settings } = useSettingsContext()

  // Demo mode with dummy blocks for testing
  const [demoBlocks] = useState<TerminalBlock[]>(() => [
    {
      id: '1',
      workspaceId: workspace.id,
      command: 'ls -la',
      output: `total 48
drwxr-xr-x  12 user  staff   384 Jan  1 12:00 .
drwxr-xr-x   8 user  staff   256 Jan  1 11:00 ..
-rw-r--r--   1 user  staff  1024 Jan  1 12:00 README.md
drwxr-xr-x   5 user  staff   160 Jan  1 12:00 src
drwxr-xr-x   3 user  staff    96 Jan  1 12:00 node_modules
-rw-r--r--   1 user  staff   512 Jan  1 12:00 package.json`,
      exitCode: 0,
      startTime: Date.now() - 5000,
      endTime: Date.now() - 4800,
      status: 'completed',
      cwd: '~/',
    },
    {
      id: '2',
      workspaceId: workspace.id,
      command: 'npm test',
      output: `> test
> jest

PASS  src/components/Terminal.test.tsx
  ✓ renders terminal (23 ms)
  ✓ handles resize (12 ms)

Test Suites: 1 passed, 1 total
Tests:       2 passed, 2 total
Snapshots:   0 total
Time:        1.234 s`,
      exitCode: 0,
      startTime: Date.now() - 3000,
      endTime: Date.now() - 1800,
      status: 'completed',
      cwd: '~/project',
    },
    {
      id: '3',
      workspaceId: workspace.id,
      command: 'git status',
      output: `On branch main
Your branch is up to date with 'origin/main'.

Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
        modified:   src/components/Terminal.tsx
        modified:   src/types/settings.ts

no changes added to commit (use "git add" and/or "git commit -a")`,
      exitCode: 0,
      startTime: Date.now() - 1000,
      endTime: Date.now() - 900,
      status: 'completed',
      cwd: '~/project',
    },
    {
      id: '4',
      workspaceId: workspace.id,
      command: 'npm run build',
      output: `> build
> tsc && vite build

Building for production...
`,
      exitCode: null,
      startTime: Date.now(),
      endTime: null,
      status: 'running',
      cwd: '~/project',
    },
  ]);

  const blocksEnabled = settings.terminal.modernFeatures.enableBlocks;

  // Debug logging
  console.log('[ModernTerminal] Settings check:', {
    blocksEnabled,
    fullSettings: settings.terminal.modernFeatures,
  });

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

  // Show block list (using demo data for now)
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
            • {demoBlocks.length} blocks
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span className="text-xs font-medium text-blue-700 dark:text-blue-400">
              Demo Mode
            </span>
          </div>
        </div>
      </div>

      {/* Block List */}
      <div className="flex-1 overflow-hidden">
        <BlockList
          blocks={demoBlocks}
          workspaceId={workspace.id}
          showTimestamps={settings.terminal.modernFeatures.showTimestamps}
          highlightFailed={settings.terminal.modernFeatures.highlightFailedCommands}
          autoScroll={true}
        />
      </div>
    </div>
  );
}
