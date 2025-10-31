/**
 * CodeBlock - Renders code with syntax highlighting
 *
 * Uses Shiki for VS Code-quality syntax highlighting
 * Supports light/dark themes with automatic switching
 */

import React, { useState, useEffect } from 'react'
import type { Block } from '../../types/conversation'
import { Copy, Check, Bookmark, BookmarkCheck, ChevronDown } from 'lucide-react'
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

export const CodeBlock: React.FC<CodeBlockProps> = ({ block, onCopy }) => {
  const [copied, setCopied] = useState(false)
  const [bookmarked, setBookmarked] = useState(false)
  const [lightHtml, setLightHtml] = useState<string>('')
  const [darkHtml, setDarkHtml] = useState<string>('')
  const [isExpanded, setIsExpanded] = useState(false)
  const [isHighlighting, setIsHighlighting] = useState(true)

  const language = block.metadata.language || 'plaintext'
  const fileName = block.metadata.fileName

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
      {/* Header with file info and actions */}
      <div className="group/header relative">
        <div
          className="flex items-center justify-between border-b border-[var(--code-border)] bg-[var(--code-header)] px-3 py-2 cursor-pointer hover:bg-[var(--code-header)]/80 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2 text-xs max-w-[300px] truncate">
            <span className="text-muted-foreground truncate">
              {fileName ? (
                <>
                  <span className="font-mono">{fileName}</span>
                  {block.metadata.lineStart && (
                    <span className="ml-1 opacity-60">
                      :{block.metadata.lineStart}
                    </span>
                  )}
                </>
              ) : (
                <span>{language}</span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Hover actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover/header:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={handleBookmark}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors hover:bg-[var(--code-header)] bg-[var(--code-header)]/50"
                title={bookmarked ? 'Bookmarked' : 'Bookmark this code'}
              >
                {bookmarked ? (
                  <BookmarkCheck className="h-3 w-3 text-yellow-500" />
                ) : (
                  <Bookmark className="h-3 w-3 text-muted-foreground/60 hover:text-muted-foreground" />
                )}
              </button>

              <button
                onClick={handleCopy}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors hover:bg-[var(--code-header)] bg-[var(--code-header)]/50"
                title="Copy code"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 text-green-500" />
                    <span className="text-green-500">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 text-muted-foreground/60 hover:text-muted-foreground" />
                    <span className="text-muted-foreground/80 hover:text-muted-foreground">Copy</span>
                  </>
                )}
              </button>
            </div>

            <ChevronDown
              className={`h-3 w-3 text-muted-foreground/60 transition-transform duration-300 ${
                isExpanded ? 'rotate-180' : ''
              }`}
            />
          </div>
        </div>
      </div>

      {/* Code content with syntax highlighting */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        {isHighlighting ? (
          <div className="p-3 text-sm text-muted-foreground">
            Loading...
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Light theme */}
            <div
              className="dark:hidden [&>pre]:m-0 [&>pre]:bg-transparent [&>pre]:p-3 [&>pre]:text-sm [&_code]:font-mono [&_code]:text-sm"
              dangerouslySetInnerHTML={{ __html: lightHtml }}
            />
            {/* Dark theme */}
            <div
              className="hidden dark:block [&>pre]:m-0 [&>pre]:bg-transparent [&>pre]:p-3 [&>pre]:text-sm [&_code]:font-mono [&_code]:text-sm"
              dangerouslySetInnerHTML={{ __html: darkHtml }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
