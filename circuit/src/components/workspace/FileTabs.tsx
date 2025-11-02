/**
 * File Tabs Component
 *
 * Tab-based interface for managing multiple open files in the editor
 * Similar to IDE file tabs (VS Code, WebStorm, etc.)
 */

import { X, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getFileName } from '@/lib/fileUtils'
import { getIconForFile } from 'vscode-material-icon-theme-js'

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
import DefaultIcon from 'material-icon-theme/icons/file.svg?react'

// Map SVG file names to imported React components
const iconComponentMap: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  'react_ts.svg': ReactTsIcon,
  'react.svg': ReactIcon,
  'typescript.svg': TypeScriptIcon,
  'javascript.svg': JavaScriptIcon,
  'nodejs.svg': JsonIcon,
  'json.svg': JsonIcon,
  'yaml.svg': YamlIcon,
  'css.svg': CssIcon,
  'sass.svg': ScssIcon,
  'html.svg': HtmlIcon,
  'markdown.svg': MarkdownIcon,
  'python.svg': PythonIcon,
  'rust.svg': RustIcon,
  'go.svg': GoIcon,
  'file.svg': DefaultIcon,
}

// Get icon component for a file
const getFileIconComponent = (filename: string): React.ComponentType<React.SVGProps<SVGSVGElement>> => {
  const iconName = getIconForFile(filename)
  if (!iconName) return DefaultIcon
  return iconComponentMap[iconName] || DefaultIcon
}

export interface OpenFile {
  path: string
  unsavedChanges?: boolean
}

interface FileTabsProps {
  openFiles: OpenFile[]
  activeFilePath: string | null
  onFileChange: (filePath: string) => void
  onCloseFile: (filePath: string) => void
}

export function FileTabs({
  openFiles,
  activeFilePath,
  onFileChange,
  onCloseFile
}: FileTabsProps) {
  if (openFiles.length === 0) {
    return null
  }

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-thin border-b border-border bg-card">
      {openFiles.map((file) => {
        const isActive = file.path === activeFilePath
        const fileName = getFileName(file.path)
        const FileIconComponent = getFileIconComponent(fileName)

        return (
          <div
            key={file.path}
            className={cn(
              'group relative flex items-center gap-2 px-3 py-2 transition-colors',
              'text-sm font-medium whitespace-nowrap cursor-pointer',
              'border-r border-border',
              isActive
                ? 'bg-background text-foreground'
                : 'bg-card text-muted-foreground hover:bg-secondary/30 hover:text-foreground'
            )}
            onClick={() => onFileChange(file.path)}
          >
            {/* File Icon - Material Icon Theme */}
            <FileIconComponent className="shrink-0 w-4 h-4" />

            {/* File Name */}
            <span className="max-w-[150px] truncate">
              {fileName}
            </span>

            {/* Close button or unsaved indicator */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onCloseFile(file.path)
              }}
              className={cn(
                'ml-1 p-0.5 rounded transition-all',
                file.unsavedChanges
                  ? 'text-warning hover:bg-warning/20'
                  : 'hover:bg-destructive/20 hover:text-destructive',
                isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              )}
              title={file.unsavedChanges ? 'Unsaved changes - Click to close' : 'Close file'}
            >
              {file.unsavedChanges ? (
                <Circle size={14} fill="currentColor" />
              ) : (
                <X size={14} />
              )}
            </button>
          </div>
        )
      })}
    </div>
  )
}
