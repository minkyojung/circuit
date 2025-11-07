/**
 * Command Palette (Cmd+K)
 * Apple Spotlight-inspired quick access to all actions
 */

import * as React from 'react'
import { useState, useEffect, useMemo } from 'react'
import { Command as CommandPrimitive } from 'cmdk'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, FolderGit2, Plus, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import Fuse from 'fuse.js'
import { slideUpVariants } from '@/lib/motion-tokens'
import type { Workspace } from '@/types/workspace'

export interface Command {
  id: string
  label: string
  description?: string
  icon?: React.ReactNode
  keywords?: string[]
  onSelect: () => void
  group?: 'workspaces' | 'actions' | 'settings'
}

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaces?: Workspace[]
  onSelectWorkspace?: (workspace: Workspace) => void
  onCreateWorkspace?: () => void
  onOpenSettings?: () => void
}

export function CommandPalette({
  open,
  onOpenChange,
  workspaces = [],
  onSelectWorkspace,
  onCreateWorkspace,
  onOpenSettings,
}: CommandPaletteProps) {
  const [search, setSearch] = useState('')

  // Build command list
  const commands = useMemo<Command[]>(() => {
    const allCommands: Command[] = []

    // Workspace commands
    workspaces.forEach((workspace) => {
      allCommands.push({
        id: `workspace-${workspace.id}`,
        label: workspace.name,
        description: workspace.branch,
        icon: <FolderGit2 size={16} />,
        keywords: ['workspace', 'open', workspace.name, workspace.branch],
        onSelect: () => {
          onSelectWorkspace?.(workspace)
          onOpenChange(false)
        },
        group: 'workspaces',
      })
    })

    // Action commands
    if (onCreateWorkspace) {
      allCommands.push({
        id: 'create-workspace',
        label: 'New Workspace',
        description: 'Create a new workspace',
        icon: <Plus size={16} />,
        keywords: ['new', 'create', 'workspace', 'add'],
        onSelect: () => {
          onCreateWorkspace()
          onOpenChange(false)
        },
        group: 'actions',
      })
    }

    if (onOpenSettings) {
      allCommands.push({
        id: 'open-settings',
        label: 'Settings',
        description: 'Open settings',
        icon: <Settings size={16} />,
        keywords: ['settings', 'preferences', 'configure'],
        onSelect: () => {
          onOpenSettings()
          onOpenChange(false)
        },
        group: 'settings',
      })
    }

    return allCommands
  }, [workspaces, onSelectWorkspace, onCreateWorkspace, onOpenSettings, onOpenChange])

  // Fuzzy search with Fuse.js
  const fuse = useMemo(
    () =>
      new Fuse(commands, {
        keys: ['label', 'description', 'keywords'],
        threshold: 0.3,
        includeScore: true,
      }),
    [commands]
  )

  const filteredCommands = useMemo(() => {
    if (!search.trim()) {
      return commands
    }

    const results = fuse.search(search)
    return results.map((result) => result.item)
  }, [search, commands, fuse])

  // Group commands
  const groupedCommands = useMemo(() => {
    const groups: Record<string, Command[]> = {
      workspaces: [],
      actions: [],
      settings: [],
    }

    filteredCommands.forEach((command) => {
      const group = command.group || 'actions'
      if (!groups[group]) groups[group] = []
      groups[group].push(command)
    })

    return groups
  }, [filteredCommands])

  // Reset search when closed
  useEffect(() => {
    if (!open) {
      setSearch('')
    }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-[var(--overlay-backdrop)] backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
          />

          {/* Command Palette */}
          <motion.div
            variants={slideUpVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed left-1/2 top-[20%] z-50 w-full max-w-2xl -translate-x-1/2"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="rounded-xl border border-border shadow-2xl overflow-hidden"
              style={{
                backgroundColor: 'var(--material-thick)',
                backdropFilter: 'blur(40px)',
              }}
            >
              <CommandPrimitive
                className="w-full"
                shouldFilter={false} // We handle filtering with Fuse
              >
                {/* Search Input */}
                <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                  <Search size={18} className="text-muted-foreground flex-shrink-0" />
                  <CommandPrimitive.Input
                    value={search}
                    onValueChange={setSearch}
                    placeholder="Search workspaces and commands..."
                    className="flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground outline-none"
                    autoFocus
                  />
                  <kbd className="px-2 py-1 text-xs bg-muted text-muted-foreground rounded font-mono">
                    ESC
                  </kbd>
                </div>

                {/* Command List */}
                <CommandPrimitive.List className="max-h-[400px] overflow-y-auto p-2">
                  {filteredCommands.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No results found
                    </div>
                  ) : (
                    <>
                      {/* Workspaces Group */}
                      {groupedCommands.workspaces.length > 0 && (
                        <CommandPrimitive.Group heading="Workspaces">
                          <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                            Workspaces
                          </div>
                          {groupedCommands.workspaces.map((command) => (
                            <CommandItem key={command.id} command={command} />
                          ))}
                        </CommandPrimitive.Group>
                      )}

                      {/* Actions Group */}
                      {groupedCommands.actions.length > 0 && (
                        <CommandPrimitive.Group heading="Actions">
                          <div className="px-2 py-1 text-xs font-medium text-muted-foreground mt-2">
                            Actions
                          </div>
                          {groupedCommands.actions.map((command) => (
                            <CommandItem key={command.id} command={command} />
                          ))}
                        </CommandPrimitive.Group>
                      )}

                      {/* Settings Group */}
                      {groupedCommands.settings.length > 0 && (
                        <CommandPrimitive.Group heading="Settings">
                          <div className="px-2 py-1 text-xs font-medium text-muted-foreground mt-2">
                            Settings
                          </div>
                          {groupedCommands.settings.map((command) => (
                            <CommandItem key={command.id} command={command} />
                          ))}
                        </CommandPrimitive.Group>
                      )}
                    </>
                  )}
                </CommandPrimitive.List>
              </CommandPrimitive>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function CommandItem({ command }: { command: Command }) {
  return (
    <CommandPrimitive.Item
      value={command.id}
      onSelect={command.onSelect}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer",
        "text-sm text-foreground",
        "hover:bg-sidebar-hover",
        "data-[selected=true]:bg-sidebar-accent",
        "transition-colors duration-150"
      )}
    >
      {command.icon && (
        <div className="flex-shrink-0 text-muted-foreground">
          {command.icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{command.label}</div>
        {command.description && (
          <div className="text-xs text-muted-foreground truncate">
            {command.description}
          </div>
        )}
      </div>
    </CommandPrimitive.Item>
  )
}
