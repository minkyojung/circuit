/**
 * File Tabs Only Component
 *
 * Displays only file tabs (without conversation tabs)
 * Used in split view mode to show tabs inside EditorPanel
 */

import { useState } from 'react'
import { X, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getFileName } from '@/lib/fileUtils'
import { getIconForFile } from 'vscode-material-icon-theme-js'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

// Import Material Icon Theme SVGs
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

// Icon map
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

const getFileIconComponent = (filename: string): React.ComponentType<React.SVGProps<SVGSVGElement>> => {
  const iconName = getIconForFile(filename)
  if (!iconName) return DefaultIcon
  return iconComponentMap[iconName] || DefaultIcon
}

export interface OpenFile {
  path: string
  unsavedChanges?: boolean
}

interface FileTabsOnlyProps {
  openFiles: OpenFile[]
  activeFilePath: string | null
  onFileChange: (filePath: string) => void
  onCloseFile: (filePath: string) => void
}

export function FileTabsOnly({
  openFiles,
  activeFilePath,
  onFileChange,
  onCloseFile
}: FileTabsOnlyProps) {
  const [closeFileDialogOpen, setCloseFileDialogOpen] = useState(false)
  const [fileToClose, setFileToClose] = useState<string | null>(null)

  const handleCloseFileClick = (filePath: string, hasUnsavedChanges: boolean) => {
    if (hasUnsavedChanges) {
      setFileToClose(filePath)
      setCloseFileDialogOpen(true)
    } else {
      onCloseFile(filePath)
    }
  }

  const handleConfirmCloseFile = () => {
    if (fileToClose) {
      onCloseFile(fileToClose)
      setFileToClose(null)
    }
    setCloseFileDialogOpen(false)
  }

  if (openFiles.length === 0) {
    return null
  }

  return (
    <>
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin border-b border-border bg-card px-2 py-1">
        {/* File Tabs */}
        {openFiles.map((file) => {
          const isActive = file.path === activeFilePath
          const fileName = getFileName(file.path)
          const FileIconComponent = getFileIconComponent(fileName)

          return (
            <div
              key={file.path}
              className={cn(
                'group relative flex items-center gap-2 px-2 py-[7px] transition-colors',
                'text-sm font-medium whitespace-nowrap cursor-pointer',
                'rounded-md',
                isActive
                  ? 'bg-secondary text-secondary-foreground'
                  : 'bg-transparent text-muted-foreground hover:bg-secondary/50 hover:text-secondary-foreground'
              )}
              onClick={() => onFileChange(file.path)}
            >
              {/* File Icon */}
              <FileIconComponent className="shrink-0 w-4 h-4" />

              {/* File Name */}
              <span className="max-w-[300px] truncate">
                {fileName}
              </span>

              {/* Close button or unsaved indicator */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleCloseFileClick(file.path, file.unsavedChanges || false)
                }}
                className={cn(
                  'ml-1 w-4 h-4 flex items-center justify-center rounded transition-all flex-shrink-0',
                  file.unsavedChanges
                    ? 'text-foreground hover:bg-secondary'
                    : 'hover:bg-destructive/20 hover:text-destructive',
                  isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                )}
                title={file.unsavedChanges ? 'Unsaved changes - Click to close' : 'Close file'}
              >
                {file.unsavedChanges ? (
                  <Circle size={8} fill="currentColor" />
                ) : (
                  <X size={14} />
                )}
              </button>
            </div>
          )
        })}
      </div>

      {/* Unsaved file changes confirmation dialog */}
      <AlertDialog open={closeFileDialogOpen} onOpenChange={setCloseFileDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              This file has unsaved changes. Closing it will discard all changes. Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCloseFile} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Close File
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
