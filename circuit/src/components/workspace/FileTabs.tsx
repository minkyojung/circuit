/**
 * File Tabs Component
 *
 * Tab-based interface for managing multiple open files in the editor
 * Similar to IDE file tabs (VS Code, WebStorm, etc.)
 */

import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getFileIcon, getFileName } from '@/lib/fileUtils'

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
        const FileIcon = getFileIcon(file.path)

        return (
          <div
            key={file.path}
            className={cn(
              'group relative flex items-center gap-1.5 px-2 py-1.5 transition-colors',
              'text-xs font-medium whitespace-nowrap cursor-pointer',
              'border-r border-border',
              isActive
                ? 'bg-background text-foreground'
                : 'bg-card text-muted-foreground hover:bg-secondary/30 hover:text-foreground'
            )}
            onClick={() => onFileChange(file.path)}
          >
            {/* File Icon */}
            <FileIcon size={14} className="shrink-0 opacity-70" />

            {/* File Name */}
            <span className="max-w-[120px] truncate">
              {fileName}
            </span>

            {/* Unsaved Changes Indicator */}
            {file.unsavedChanges && (
              <div className="w-1.5 h-1.5 rounded-full bg-warning shrink-0" title="Unsaved changes" />
            )}

            {/* Close button - show on hover or if active */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onCloseFile(file.path)
              }}
              className={cn(
                'ml-0.5 p-0.5 rounded hover:bg-destructive/20 hover:text-destructive transition-all',
                isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              )}
              title="Close file"
            >
              <X size={12} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
