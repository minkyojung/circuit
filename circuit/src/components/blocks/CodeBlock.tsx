/**
 * CodeBlock - Renders code with syntax highlighting
 *
 * Uses Shiki for VS Code-quality syntax highlighting
 * Supports light/dark themes with automatic switching
 * Minimal design with hover-activated pill for actions
 */

import React, { useState, useEffect } from 'react'
import type { Block } from '../../types/conversation'
import { Copy, Check, Bookmark, BookmarkCheck } from 'lucide-react'
import { toast } from 'sonner'
import { type BundledLanguage } from 'shiki'
import { highlightCode } from '@/components/ai-elements/code-block'

const { ipcRenderer } = window.require('electron')

interface CodeBlockProps {
  block: Block
  onCopy: (content: string) => void
  onBookmark: (blockId: string) => void
}

// Language mapping for common aliases
const languageMap: Record<string, BundledLanguage> = {
  js: 'javascript',
  ts: 'typescript',
  jsx: 'jsx',
  tsx: 'tsx',
  py: 'python',
  sh: 'bash',
  shell: 'bash',
  yml: 'yaml',
  md: 'markdown',
  rs: 'rust',
}

// Get display name for language
const getLanguageDisplay = (lang: string, fileName?: string): string => {
  if (fileName) {
    return fileName
  }
  return lang.toLowerCase()
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ block, onCopy }) => {
  const [copied, setCopied] = useState(false)
  const [bookmarked, setBookmarked] = useState(false)
  const [lightHtml, setLightHtml] = useState<string>('')
  const [darkHtml, setDarkHtml] = useState<string>('')
  const [isHighlighting, setIsHighlighting] = useState(true)

  const language = block.metadata.language || 'plaintext'
  const fileName = block.metadata.fileName
  const displayLabel = getLanguageDisplay(language, fileName)

  // Highlight code on mount and when content/language changes
  useEffect(() => {
    const highlight = async () => {
      try {
        setIsHighlighting(true)

        // Map language aliases to Shiki language identifiers
        const mappedLang = languageMap[language.toLowerCase()] || language.toLowerCase()

        // Validate if it's a valid BundledLanguage
        let shikiLang: BundledLanguage
        try {
          shikiLang = mappedLang as BundledLanguage
        } catch {
          // Fallback to plaintext for unsupported languages
          shikiLang = 'plaintext' as BundledLanguage
        }

        const [light, dark] = await highlightCode(block.content, shikiLang, false)
        setLightHtml(light)
        setDarkHtml(dark)
      } catch (error) {
        console.error('[CodeBlock] Highlight error:', error)
        // Fallback to plain text
        const escaped = block.content
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
        setLightHtml(`<pre><code>${escaped}</code></pre>`)
        setDarkHtml(`<pre><code>${escaped}</code></pre>`)
      } finally {
        setIsHighlighting(false)
      }
    }

    highlight()
  }, [block.content, language])

  const handleCopy = () => {
    onCopy(block.content)
    setCopied(true)
    toast.success('Code copied to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleBookmark = async () => {
    try {
      if (bookmarked) {
        // TODO: Implement unbookmark - need to track bookmark ID
        console.log('[CodeBlock] Unbookmark not yet implemented')
      } else {
        const bookmark = {
          id: `bookmark-${Date.now()}`,
          blockId: block.id,
          title: `${language} code`,
          createdAt: new Date().toISOString(),
        }
        await ipcRenderer.invoke('block:bookmark', bookmark)
        setBookmarked(true)
        console.log('[CodeBlock] Bookmarked:', block.id)
      }
    } catch (error) {
      console.error('[CodeBlock] Bookmark error:', error)
    }
  }

  return (
    <div className="group relative overflow-hidden rounded-lg border border-[var(--code-border)] bg-[var(--code-bg)]">
      {/* Code content with syntax highlighting */}
      {isHighlighting ? (
        <div className="p-3 text-sm text-muted-foreground">
          Loading...
        </div>
      ) : (
        <div className="overflow-x-auto">
          {/* Light theme */}
          <div
            className="dark:hidden [&>pre]:m-0 [&>pre]:bg-transparent [&>pre]:p-4 [&>pre]:text-sm [&_code]:font-mono [&_code]:text-sm"
            dangerouslySetInnerHTML={{ __html: lightHtml }}
          />
          {/* Dark theme */}
          <div
            className="hidden dark:block [&>pre]:m-0 [&>pre]:bg-transparent [&>pre]:p-4 [&>pre]:text-sm [&_code]:font-mono [&_code]:text-sm"
            dangerouslySetInnerHTML={{ __html: darkHtml }}
          />
        </div>
      )}

      {/* Hover pill - compact actions */}
      <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <div className="flex items-center gap-0.5 rounded-full bg-background/90 backdrop-blur-sm border border-border shadow-lg px-2 py-1">
          {/* Language label */}
          <span className="text-[10px] font-medium text-muted-foreground px-1.5 font-mono">
            {displayLabel}
            {block.metadata.lineStart && `:${block.metadata.lineStart}`}
          </span>

          {/* Divider */}
          <div className="h-3 w-[1px] bg-border mx-0.5" />

          {/* Copy button */}
          <button
            onClick={handleCopy}
            className="flex items-center justify-center rounded-full p-1 transition-colors hover:bg-accent"
            title="Copy code"
          >
            {copied ? (
              <Check className="h-3 w-3 text-success" />
            ) : (
              <Copy className="h-3 w-3 text-muted-foreground" />
            )}
          </button>

          {/* Bookmark button */}
          <button
            onClick={handleBookmark}
            className="flex items-center justify-center rounded-full p-1 transition-colors hover:bg-accent"
            title={bookmarked ? 'Bookmarked' : 'Bookmark'}
          >
            {bookmarked ? (
              <BookmarkCheck className="h-3 w-3 text-warning" />
            ) : (
              <Bookmark className="h-3 w-3 text-muted-foreground" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
