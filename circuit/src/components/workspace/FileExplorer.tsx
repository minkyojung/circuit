import React, { useState } from 'react'
import { Folder, ChevronRight, ChevronDown } from 'lucide-react'
import { getIconForFile } from 'vscode-material-icon-theme-js'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { FileTreeSkeleton } from '@/components/ui/skeleton'

// Import Material Icon Theme SVGs - Common file types
import ReactTsIcon from 'material-icon-theme/icons/react_ts.svg?react'
import ReactIcon from 'material-icon-theme/icons/react.svg?react'
import TypeScriptIcon from 'material-icon-theme/icons/typescript.svg?react'
import JavaScriptIcon from 'material-icon-theme/icons/javascript.svg?react'
import JsonIcon from 'material-icon-theme/icons/nodejs.svg?react'
import CssIcon from 'material-icon-theme/icons/css.svg?react'
import ScssIcon from 'material-icon-theme/icons/sass.svg?react'
import HtmlIcon from 'material-icon-theme/icons/html.svg?react'
import MarkdownIcon from 'material-icon-theme/icons/markdown.svg?react'
import PythonIcon from 'material-icon-theme/icons/python.svg?react'
import RustIcon from 'material-icon-theme/icons/rust.svg?react'
import GoIcon from 'material-icon-theme/icons/go.svg?react'
import YamlIcon from 'material-icon-theme/icons/yaml.svg?react'
import XmlIcon from 'material-icon-theme/icons/xml.svg?react'
import ImageIcon from 'material-icon-theme/icons/image.svg?react'
import VueIcon from 'material-icon-theme/icons/vue.svg?react'
import SvelteIcon from 'material-icon-theme/icons/svelte.svg?react'
import NextIcon from 'material-icon-theme/icons/next.svg?react'
import ViteIcon from 'material-icon-theme/icons/vite.svg?react'
import TailwindIcon from 'material-icon-theme/icons/tailwindcss.svg?react'
import DockerIcon from 'material-icon-theme/icons/docker.svg?react'
import GitIcon from 'material-icon-theme/icons/git.svg?react'
import NpmIcon from 'material-icon-theme/icons/npm.svg?react'
import YarnIcon from 'material-icon-theme/icons/yarn.svg?react'
import DefaultIcon from 'material-icon-theme/icons/file.svg?react'

// Map SVG file names to imported React components
const iconComponentMap: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  // React & TypeScript
  'react_ts.svg': ReactTsIcon,
  'react.svg': ReactIcon,
  'typescript.svg': TypeScriptIcon,
  'javascript.svg': JavaScriptIcon,

  // Config & Data
  'nodejs.svg': JsonIcon,
  'json.svg': JsonIcon,
  'yaml.svg': YamlIcon,
  'xml.svg': XmlIcon,

  // Styles
  'css.svg': CssIcon,
  'sass.svg': ScssIcon,
  'tailwindcss.svg': TailwindIcon,

  // Markup
  'html.svg': HtmlIcon,
  'markdown.svg': MarkdownIcon,

  // Programming Languages
  'python.svg': PythonIcon,
  'rust.svg': RustIcon,
  'go.svg': GoIcon,

  // Frameworks
  'vue.svg': VueIcon,
  'svelte.svg': SvelteIcon,
  'next.svg': NextIcon,

  // Build Tools
  'vite.svg': ViteIcon,
  'npm.svg': NpmIcon,
  'yarn.svg': YarnIcon,

  // DevOps
  'docker.svg': DockerIcon,
  'git.svg': GitIcon,

  // Media
  'image.svg': ImageIcon,

  // Default
  'file.svg': DefaultIcon,
}

// Get icon component for a file
const getFileIcon = (filename: string): React.ComponentType<React.SVGProps<SVGSVGElement>> => {
  const iconName = getIconForFile(filename)
  if (!iconName) return DefaultIcon
  return iconComponentMap[iconName] || DefaultIcon
}

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
              className="w-full h-[var(--list-item-height)] py-[var(--list-item-padding-y)] gap-2"
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
            >
              {isOpen ? (
                <ChevronDown size={16} strokeWidth={1.5} className="flex-shrink-0" />
              ) : (
                <ChevronRight size={16} strokeWidth={1.5} className="flex-shrink-0" />
              )}
              <Folder size={16} strokeWidth={1.5} className="flex-shrink-0 text-sidebar-foreground-muted" />
              <span className="text-base font-normal truncate">{node.name}</span>
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
  const FileIconComponent = getFileIcon(node.name)

  return (
    <SidebarMenuItem className="my-0">
      <SidebarMenuButton
        onClick={() => onSelect?.(node.path)}
        isActive={isSelected}
        className="w-full h-[var(--list-item-height)] py-[var(--list-item-padding-y)] gap-2"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {/* File type icon */}
        <div className="flex-shrink-0" style={{ width: '16px', height: '16px' }}>
          <FileIconComponent width={16} height={16} />
        </div>

        <span className="text-base font-normal truncate flex-1">{node.name}</span>

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
    <div className="h-full flex flex-col">
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            {isLoading ? (
              <FileTreeSkeleton />
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
