import React, { useState } from 'react'
import { File, Folder, ChevronRight, ChevronDown, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

// File tree structure
export interface FileNode {
  name: string
  path: string
  type: 'file' | 'folder'
  children?: FileNode[]
  modified?: boolean
  added?: boolean
}

interface FileExplorerProps {
  fileTree: FileNode[]
  isLoading?: boolean
  onFileSelect?: (filePath: string) => void
  selectedFile?: string | null
}

const FileTreeItem: React.FC<{
  node: FileNode
  depth: number
  onSelect?: (path: string) => void
  selectedFile?: string | null
}> = ({ node, depth, onSelect, selectedFile }) => {
  const [isOpen, setIsOpen] = useState(depth === 0) // Auto-expand root folders

  if (node.type === 'folder') {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <SidebarMenuItem className="my-0">
          <CollapsibleTrigger asChild>
            <SidebarMenuButton
              className="w-full h-[var(--list-item-height)] py-[var(--list-item-padding-y)] gap-1.5"
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
            >
              {isOpen ? (
                <ChevronDown size={14} className="flex-shrink-0" />
              ) : (
                <ChevronRight size={14} className="flex-shrink-0" />
              )}
              <Folder size={14} className="flex-shrink-0 text-sidebar-foreground-muted" />
              <span className="text-sm truncate">{node.name}</span>
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            {node.children?.map((child) => (
              <FileTreeItem
                key={child.path}
                node={child}
                depth={depth + 1}
                onSelect={onSelect}
                selectedFile={selectedFile}
              />
            ))}
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    )
  }

  // File node
  const isSelected = selectedFile === node.path

  return (
    <SidebarMenuItem className="my-0">
      <SidebarMenuButton
        onClick={() => onSelect?.(node.path)}
        isActive={isSelected}
        className="w-full h-[var(--list-item-height)] py-[var(--list-item-padding-y)] gap-1.5"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <File size={14} className="flex-shrink-0 text-sidebar-foreground-muted" />
        <span className="text-sm truncate flex-1">{node.name}</span>

        {/* Git status badges */}
        {node.modified && (
          <span className="text-[10px] px-1 rounded bg-status-working/20 text-status-working font-medium">
            M
          </span>
        )}
        {node.added && (
          <span className="text-[10px] px-1 rounded bg-status-synced/20 text-status-synced font-medium">
            A
          </span>
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  fileTree,
  isLoading = false,
  onFileSelect,
  selectedFile,
}) => {
  // Calculate git status summary from fileTree
  const gitStats = React.useMemo(() => {
    const stats = { modified: 0, added: 0 }

    const countGitStatus = (nodes: FileNode[]) => {
      nodes.forEach(node => {
        if (node.modified) stats.modified++
        if (node.added) stats.added++
        if (node.children) countGitStatus(node.children)
      })
    }

    countGitStatus(fileTree)
    return stats
  }, [fileTree])

  return (
    <div className="h-full flex flex-col bg-sidebar border-r border-sidebar-border">
      <SidebarGroup>
        <SidebarGroupLabel className="px-4 py-2">
          Files
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {isLoading ? (
              <div className="px-4 py-6 text-center text-sidebar-foreground-muted">
                <Loader2 size={16} className="mx-auto animate-spin mb-2" />
                <p className="text-xs">Loading files...</p>
              </div>
            ) : fileTree.length === 0 ? (
              <div className="px-4 py-6 text-center text-sidebar-foreground-muted">
                <p className="text-xs">No files found</p>
              </div>
            ) : (
              fileTree.map((node) => (
                <FileTreeItem
                  key={node.path}
                  node={node}
                  depth={0}
                  onSelect={onFileSelect}
                  selectedFile={selectedFile}
                />
              ))
            )}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      {/* Git Status Summary */}
      {!isLoading && (gitStats.modified > 0 || gitStats.added > 0) && (
        <div className="mt-auto p-3 border-t border-sidebar-border">
          <div className="text-xs text-sidebar-foreground-muted">
            <div className="flex items-center gap-2">
              {gitStats.modified > 0 && (
                <span className="text-status-working">{gitStats.modified} modified</span>
              )}
              {gitStats.modified > 0 && gitStats.added > 0 && <span>•</span>}
              {gitStats.added > 0 && (
                <span className="text-status-synced">{gitStats.added} added</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
