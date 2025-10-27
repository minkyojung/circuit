import React, { useState, useMemo, useEffect, useRef } from 'react'
import { Folder, ChevronRight, Search, X, Copy, MoreHorizontal, RefreshCw, ChevronsDownUp } from 'lucide-react'
import { getIconForFile } from 'vscode-material-icon-theme-js'
import { cn } from '@/lib/utils'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { FileTreeSkeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { motion, AnimatePresence } from 'framer-motion'

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
  onRefresh?: () => void
}

const FileTreeItem: React.FC<{
  node: FileNode
  depth: number
  onSelect?: (path: string) => void
  selectedFile?: string | null
  searchQuery?: string
  collapseKey?: number
}> = ({ node, depth, onSelect, selectedFile, searchQuery, collapseKey }) => {
  const [isOpen, setIsOpen] = useState(depth === 0) // Auto-expand root folders
  const [isHovered, setIsHovered] = useState(false)

  // Auto-expand folders when searching
  useEffect(() => {
    if (searchQuery && searchQuery.length > 0) {
      setIsOpen(true)
    }
  }, [searchQuery])

  // Collapse all when collapseKey changes
  useEffect(() => {
    if (collapseKey && collapseKey > 0) {
      setIsOpen(false)
    }
  }, [collapseKey])

  if (node.type === 'folder') {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <SidebarMenuItem className="my-0">
          <div
            className="relative"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            {/* Indent guide line */}
            {depth > 0 && (
              <div
                className="absolute top-0 bottom-0 w-px bg-sidebar-border opacity-20"
                style={{ left: `${depth * 12 - 4}px` }}
              />
            )}

            <CollapsibleTrigger asChild>
              <SidebarMenuButton
                className="w-full h-[var(--list-item-height)] py-[var(--list-item-padding-y)] gap-2 group"
                style={{ paddingLeft: `${depth * 12 + 8}px` }}
              >
                <motion.div
                  animate={{ rotate: isOpen ? 90 : 0 }}
                  transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                  className="flex-shrink-0"
                >
                  <ChevronRight size={16} strokeWidth={1.5} />
                </motion.div>
                <Folder size={16} strokeWidth={1.5} className="flex-shrink-0 text-sidebar-foreground-muted" />
                <span className="text-base font-normal truncate flex-1">{node.name}</span>

                {/* Folder count badge */}
                {node.children && node.children.length > 0 && (
                  <span className="text-[10px] px-1.5 rounded-full bg-sidebar-accent text-sidebar-foreground-muted opacity-60">
                    {node.children.length}
                  </span>
                )}
              </SidebarMenuButton>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            {node.children?.map((child) => (
              <FileTreeItem
                key={child.path}
                node={child}
                depth={depth + 1}
                onSelect={onSelect}
                selectedFile={selectedFile}
                searchQuery={searchQuery}
                collapseKey={collapseKey}
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
      <div
        className="relative"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Indent guide line */}
        {depth > 0 && (
          <div
            className="absolute top-0 bottom-0 w-px bg-sidebar-border opacity-20"
            style={{ left: `${depth * 12 - 4}px` }}
          />
        )}

        <SidebarMenuButton
          onClick={() => onSelect?.(node.path)}
          isActive={isSelected}
          className="w-full h-[var(--list-item-height)] py-[var(--list-item-padding-y)] gap-2 group pr-1"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {/* File type icon */}
          <div className="flex-shrink-0" style={{ width: '16px', height: '16px' }}>
            <FileIconComponent width={16} height={16} />
          </div>

          <span className="text-base font-normal truncate flex-1">{node.name}</span>

          {/* Git status badges */}
          {node.modified && (
            <span className="text-[10px] px-1 rounded bg-status-working/20 text-status-working font-medium flex-shrink-0">
              M
            </span>
          )}
          {node.added && (
            <span className="text-[10px] px-1 rounded bg-status-synced/20 text-status-synced font-medium flex-shrink-0">
              A
            </span>
          )}

          {/* Action buttons (shown on hover) */}
          <AnimatePresence>
            {isHovered && !isSelected && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.1 }}
                className="flex items-center gap-0.5 ml-1 flex-shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="p-0.5 rounded hover:bg-sidebar-accent transition-colors"
                  title="Copy path"
                  onClick={(e) => {
                    e.stopPropagation()
                    navigator.clipboard.writeText(node.path)
                  }}
                >
                  <Copy size={12} strokeWidth={1.5} className="text-sidebar-foreground-muted" />
                </button>
                <button
                  className="p-0.5 rounded hover:bg-sidebar-accent transition-colors"
                  title="More actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal size={12} strokeWidth={1.5} className="text-sidebar-foreground-muted" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </SidebarMenuButton>
      </div>
    </SidebarMenuItem>
  )
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  fileTree,
  isLoading = false,
  onFileSelect,
  selectedFile,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [collapseKey, setCollapseKey] = useState(0) // Key to force collapse all folders
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Filter file tree based on search query
  const filteredFileTree = useMemo(() => {
    if (!searchQuery.trim()) return fileTree

    const query = searchQuery.toLowerCase()

    const filterNodes = (nodes: FileNode[]): FileNode[] => {
      return nodes.reduce<FileNode[]>((acc, node) => {
        if (node.type === 'folder') {
          const filteredChildren = node.children ? filterNodes(node.children) : []
          if (filteredChildren.length > 0 || node.name.toLowerCase().includes(query)) {
            acc.push({ ...node, children: filteredChildren })
          }
        } else if (node.name.toLowerCase().includes(query)) {
          acc.push(node)
        }
        return acc
      }, [])
    }

    return filterNodes(fileTree)
  }, [fileTree, searchQuery])

  // Calculate git status summary from fileTree
  const gitStats = useMemo(() => {
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

  // Keyboard shortcut to focus search (Cmd/Ctrl + F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        setIsSearchOpen(true)
        setTimeout(() => searchInputRef.current?.focus(), 100)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="h-full flex flex-col">
      {/* Header with actions */}
      <div className="px-3 py-3 flex items-center gap-1">
        <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.15)' }} />
        <button
          onClick={() => {
            setIsSearchOpen(!isSearchOpen)
            if (!isSearchOpen) {
              setTimeout(() => searchInputRef.current?.focus(), 100)
            }
          }}
          className={cn(
            "p-2.5 rounded-md transition-all duration-200",
            "text-sidebar-foreground-muted",
            isSearchOpen
              ? "bg-sidebar-accent opacity-100"
              : "opacity-70 hover:opacity-100 hover:bg-sidebar-hover"
          )}
          title="Search files (⌘F)"
        >
          <Search size={14} strokeWidth={2} />
        </button>
        <button
          onClick={onRefresh}
          className={cn(
            "p-2.5 rounded-md transition-all duration-200",
            "text-sidebar-foreground-muted",
            "opacity-70 hover:opacity-100 hover:bg-sidebar-hover"
          )}
          title="Refresh file tree"
        >
          <RefreshCw size={14} strokeWidth={2} />
        </button>
        <button
          onClick={() => setCollapseKey(prev => prev + 1)}
          className={cn(
            "p-2.5 rounded-md transition-all duration-200",
            "text-sidebar-foreground-muted",
            "opacity-70 hover:opacity-100 hover:bg-sidebar-hover"
          )}
          title="Collapse all folders"
        >
          <ChevronsDownUp size={14} strokeWidth={2} />
        </button>
      </div>

      {/* Search Bar (collapsible) */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-2 pb-2">
              <div className="relative">
                <Search
                  size={14}
                  strokeWidth={1.5}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sidebar-foreground-muted opacity-40 pointer-events-none"
                />
                <Input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={cn(
                    "h-7 pl-8 pr-7 text-sm bg-sidebar-accent border-sidebar-border",
                    "placeholder:text-sidebar-foreground-muted placeholder:opacity-60",
                    "focus-visible:ring-1 focus-visible:ring-sidebar-ring"
                  )}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-sidebar-hover transition-colors"
                  >
                    <X size={12} strokeWidth={1.5} className="text-sidebar-foreground-muted" />
                  </button>
                )}
              </div>

              {/* Search results count */}
              {searchQuery && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-1.5 px-1 text-[10px] text-sidebar-foreground-muted opacity-60"
                >
                  {filteredFileTree.length === 0
                    ? 'No results'
                    : `${filteredFileTree.length} result${filteredFileTree.length === 1 ? '' : 's'}`}
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            {isLoading ? (
              <FileTreeSkeleton />
            ) : filteredFileTree.length === 0 ? (
              <div className="px-4 py-6 text-center text-sidebar-foreground-muted">
                <p className="text-xs">
                  {searchQuery ? 'No files match your search' : 'No files found'}
                </p>
              </div>
            ) : (
              filteredFileTree.map((node) => (
                <FileTreeItem
                  key={node.path}
                  node={node}
                  depth={0}
                  onSelect={onFileSelect}
                  selectedFile={selectedFile}
                  searchQuery={searchQuery}
                  collapseKey={collapseKey}
                />
              ))
            )}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      {/* Git Status Summary */}
      {!isLoading && (gitStats.modified > 0 || gitStats.added > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-auto p-3 border-t border-sidebar-border"
        >
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
        </motion.div>
      )}
    </div>
  )
}
