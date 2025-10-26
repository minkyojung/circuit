import React, { useState } from 'react'
import { File, Folder, ChevronRight, ChevronDown } from 'lucide-react'
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

// Temporary mock data structure
interface FileNode {
  name: string
  path: string
  type: 'file' | 'folder'
  children?: FileNode[]
  modified?: boolean
  added?: boolean
}

interface FileExplorerProps {
  workspacePath: string
  onFileSelect?: (filePath: string) => void
  selectedFile?: string | null
}

// Mock file tree - replace with actual IPC call later
const MOCK_FILE_TREE: FileNode[] = [
  {
    name: 'src',
    path: 'src',
    type: 'folder',
    children: [
      { name: 'App.tsx', path: 'src/App.tsx', type: 'file', modified: true },
      { name: 'App.css', path: 'src/App.css', type: 'file' },
      { name: 'index.tsx', path: 'src/index.tsx', type: 'file' },
      {
        name: 'components',
        path: 'src/components',
        type: 'folder',
        children: [
          { name: 'Sidebar.tsx', path: 'src/components/Sidebar.tsx', type: 'file' },
          { name: 'AppSidebar.tsx', path: 'src/components/AppSidebar.tsx', type: 'file', added: true },
        ],
      },
    ],
  },
  {
    name: 'public',
    path: 'public',
    type: 'folder',
    children: [
      { name: 'index.html', path: 'public/index.html', type: 'file' },
    ],
  },
  { name: 'package.json', path: 'package.json', type: 'file' },
  { name: 'tsconfig.json', path: 'tsconfig.json', type: 'file' },
]

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
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton
              className="w-full"
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
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={() => onSelect?.(node.path)}
        isActive={isSelected}
        className="w-full"
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
  workspacePath,
  onFileSelect,
  selectedFile,
}) => {
  return (
    <div className="h-full flex flex-col bg-sidebar border-r border-sidebar-border">
      <SidebarGroup>
        <SidebarGroupLabel className="px-4 py-2">
          Files
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {MOCK_FILE_TREE.map((node) => (
              <FileTreeItem
                key={node.path}
                node={node}
                depth={0}
                onSelect={onFileSelect}
                selectedFile={selectedFile}
              />
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      {/* Git Status Summary (placeholder) */}
      <div className="mt-auto p-3 border-t border-sidebar-border">
        <div className="text-xs text-sidebar-foreground-muted">
          <div className="flex items-center gap-2">
            <span className="text-status-working">2 modified</span>
            <span>•</span>
            <span className="text-status-synced">1 added</span>
          </div>
        </div>
      </div>
    </div>
  )
}
