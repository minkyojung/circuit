/**
 * Unified Tabs Component
 *
 * Combines ConversationTabs and FileTabs into a single tab bar
 * to save vertical space and provide consistent UX
 */

import { useState, useEffect } from 'react'
import { Plus, X, Circle, CircleCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'
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
import { getFileName } from '@/lib/fileUtils'
import { getIconForFile } from 'vscode-material-icon-theme-js'

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

// @ts-ignore
const { ipcRenderer } = window.require('electron')

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

interface Conversation {
  id: string
  workspaceId: string
  title: string
  createdAt: number
  updatedAt: number
  lastViewedAt?: number
}

export interface OpenFile {
  path: string
  unsavedChanges?: boolean
}

interface UnifiedTabsProps {
  // Conversation props
  workspaceId: string | null
  workspaceName?: string
  activeConversationId: string | null
  onConversationChange: (conversationId: string) => void

  // File props
  openFiles: OpenFile[]
  activeFilePath: string | null
  onFileChange: (filePath: string) => void
  onCloseFile: (filePath: string) => void
}

export function UnifiedTabs({
  workspaceId,
  workspaceName,
  activeConversationId,
  onConversationChange,
  openFiles,
  activeFilePath,
  onFileChange,
  onCloseFile
}: UnifiedTabsProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [closeFileDialogOpen, setCloseFileDialogOpen] = useState(false)
  const [fileToClose, setFileToClose] = useState<string | null>(null)

  useEffect(() => {
    if (!workspaceId) {
      setConversations([])
      return
    }

    loadConversations()
  }, [workspaceId])

  const loadConversations = async () => {
    if (!workspaceId) return

    try {
      const result = await ipcRenderer.invoke('conversation:list', workspaceId)
      if (result.success && result.conversations) {
        setConversations(result.conversations)

        // Auto-select oldest conversation if none is active
        if (!activeConversationId && result.conversations.length > 0) {
          const sortedConversations = [...result.conversations].sort(
            (a, b) => a.createdAt - b.createdAt
          )
          const oldestConversation = sortedConversations[0]
          console.log('[UnifiedTabs] Auto-selecting oldest conversation:', oldestConversation.id)
          onConversationChange(oldestConversation.id)
        }
      }
    } catch (error) {
      console.error('[UnifiedTabs] Error loading conversations:', error)
    }
  }

  const handleCloseConversation = (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation()
    setDeletingId(conversationId)
  }

  const confirmDelete = async () => {
    if (!deletingId) return

    try {
      const result = await ipcRenderer.invoke('conversation:delete', deletingId)
      if (result.success) {
        if (deletingId === activeConversationId && conversations.length > 1) {
          const otherConversation = conversations.find(c => c.id !== deletingId)
          if (otherConversation) {
            onConversationChange(otherConversation.id)
          }
        }

        await loadConversations()
      } else {
        console.error('[UnifiedTabs] Failed to delete:', result.error)
        alert(`Failed to delete conversation: ${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('[UnifiedTabs] Error deleting conversation:', error)
      alert(`Error deleting conversation: ${error}`)
    } finally {
      setDeletingId(null)
    }
  }

  const handleCreateConversation = async () => {
    if (!workspaceId || !workspaceName) return

    try {
      const result = await ipcRenderer.invoke('conversation:create', workspaceId)

      if (result.success && result.conversation) {
        console.log('[UnifiedTabs] Created conversation:', result.conversation.id)
        await loadConversations()
        onConversationChange(result.conversation.id)
      } else {
        console.error('[UnifiedTabs] Failed to create:', result.error)
        alert(`Failed to create conversation: ${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('[UnifiedTabs] Error creating conversation:', error)
      alert(`Error creating conversation: ${error}`)
    }
  }

  const handleDoubleClick = (conversation: Conversation) => {
    setEditingId(conversation.id)
    setEditingTitle(conversation.title || '')
  }

  const handleRenameSubmit = async () => {
    if (!editingId || !editingTitle.trim()) {
      setEditingId(null)
      setEditingTitle('')
      return
    }

    try {
      const result = await ipcRenderer.invoke('conversation:update-title', editingId, editingTitle.trim())

      if (result.success) {
        await loadConversations()
      } else {
        console.error('[UnifiedTabs] Failed to rename:', result.error)
        alert(`Failed to rename conversation: ${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('[UnifiedTabs] Error renaming conversation:', error)
      alert(`Error renaming conversation: ${error}`)
    } finally {
      setEditingId(null)
      setEditingTitle('')
    }
  }

  const handleRenameCancel = () => {
    setEditingId(null)
    setEditingTitle('')
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleRenameSubmit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleRenameCancel()
    }
  }

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

  if (!workspaceId) {
    return null
  }

  return (
    <>
      <div className="flex items-center gap-1">
        {/* Conversation Tabs */}
        {conversations.map((conversation) => {
          const isActive = conversation.id === activeConversationId
          const isRead = isActive || (conversation.lastViewedAt && conversation.lastViewedAt >= conversation.updatedAt)
          const isEditing = editingId === conversation.id

          return (
            <div
              key={conversation.id}
              className={cn(
                'group relative flex items-center gap-2 px-2 py-[7px] transition-colors',
                'text-sm font-medium whitespace-nowrap',
                'rounded-md',
                isActive
                  ? 'bg-secondary text-secondary-foreground'
                  : 'bg-transparent text-muted-foreground hover:bg-secondary/50 hover:text-secondary-foreground'
              )}
            >
              {/* Icon - read/unread indicator */}
              {isRead ? (
                <CircleCheck size={14} className="opacity-70 shrink-0" />
              ) : (
                <Circle size={14} className="opacity-70 shrink-0" />
              )}

              {/* Conversation title - editable on double click */}
              {isEditing ? (
                <input
                  type="text"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={handleRenameSubmit}
                  onKeyDown={handleRenameKeyDown}
                  autoFocus
                  className={cn(
                    'bg-background border border-primary rounded px-1 py-0',
                    'text-sm font-medium text-foreground',
                    'max-w-[120px] outline-none'
                  )}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  className="cursor-pointer whitespace-nowrap"
                  onClick={() => onConversationChange(conversation.id)}
                  onDoubleClick={() => handleDoubleClick(conversation)}
                >
                  {conversation.title || `${workspaceName || 'Chat'} ${conversations.indexOf(conversation) + 1}`}
                </span>
              )}

              {/* Close button - only show on hover */}
              {conversations.length > 1 && !isEditing && (
                <button
                  onClick={(e) => handleCloseConversation(e, conversation.id)}
                  className={cn(
                    'ml-1 p-0.5 rounded hover:bg-destructive/20 hover:text-destructive transition-all',
                    'opacity-0 group-hover:opacity-100'
                  )}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          )
        })}

        {/* New conversation button */}
        <button
          onClick={handleCreateConversation}
          className={cn(
            'flex items-center justify-center px-3 py-[7px] transition-colors rounded-md',
            'text-muted-foreground hover:bg-secondary/50 hover:text-secondary-foreground'
          )}
          title="New Conversation"
        >
          <Plus size={16} />
        </button>

        {/* Separator between conversations and files */}
        {openFiles.length > 0 && (
          <Separator orientation="vertical" className="h-6 mx-1" />
        )}

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

      {/* Delete confirmation dialog */}
      <AlertDialog open={deletingId !== null} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this conversation and all its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
