/**
 * CodeBlock - Renders code with syntax highlighting
 *
 * Uses Shiki for VS Code-quality syntax highlighting.
 * Refactored to use unified block architecture.
 *
 * Features:
 * - Syntax highlighting (light/dark themes)
 * - Minimal design with hover pill
 * - Copy and bookmark actions
 * - Unified padding and typography
 */

import React, { useState, useEffect } from 'react';
import type { Block } from '../../types/conversation';
import { type BundledLanguage } from 'shiki';
import { highlightCode } from '@/components/ai-elements/code-block';
import { BlockContainer, BlockLabel, BlockDivider, CopyButton, BookmarkButton } from './shared';

interface CodeBlockProps {
  block: Block;
  onCopy: (content: string) => void;
  onBookmark: (blockId: string) => void;
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
};

// Get display name for language
const getLanguageDisplay = (lang: string, fileName?: string): string => {
  if (fileName) return fileName;
  return lang.toLowerCase();
};

export const CodeBlock: React.FC<CodeBlockProps> = ({ block, onCopy }) => {
  const [lightHtml, setLightHtml] = useState<string>('');
  const [darkHtml, setDarkHtml] = useState<string>('');
  const [isHighlighting, setIsHighlighting] = useState(true);

  const language = block.metadata.language || 'plaintext';
  const fileName = block.metadata.fileName;
  const displayLabel = getLanguageDisplay(language, fileName);

  // Highlight code on mount and when content/language changes
  useEffect(() => {
    const highlight = async () => {
      try {
        setIsHighlighting(true);

        // Map language aliases to Shiki language identifiers
        const mappedLang = languageMap[language.toLowerCase()] || language.toLowerCase();

        // Validate if it's a valid BundledLanguage
        let shikiLang: BundledLanguage;
        try {
          shikiLang = mappedLang as BundledLanguage;
        } catch {
          // Fallback to plaintext for unsupported languages
          shikiLang = 'plaintext' as BundledLanguage;
        }

        const [light, dark] = await highlightCode(block.content, shikiLang, false);
        setLightHtml(light);
        setDarkHtml(dark);
      } catch (error) {
        console.error('[CodeBlock] Highlight error:', error);
        // Fallback to plain text
        const escaped = block.content
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        setLightHtml(`<pre><code>${escaped}</code></pre>`);
        setDarkHtml(`<pre><code>${escaped}</code></pre>`);
      } finally {
        setIsHighlighting(false);
      }
    };

    highlight();
  }, [block.content, language]);

  // Hover actions pill content
  const hoverActions = (
    <>
      <BlockLabel>
        {displayLabel}
        {block.metadata.lineStart && `:${block.metadata.lineStart}`}
      </BlockLabel>

      <BlockDivider />

      <CopyButton content={block.content} label="code" />

      <BookmarkButton blockId={block.id} title={`${language} code`} />
    </>
  );

  return (
    <BlockContainer
      blockType="code"
      hoverActions={hoverActions}
      data-block-type="code"
    >
      {/* Code content with syntax highlighting */}
      {isHighlighting ? (
        <div className="p-4 text-sm text-muted-foreground font-mono">
          Loading...
        </div>
      ) : (
        <div className="overflow-x-auto">
          {/* Light theme */}
          <div
            className="dark:hidden [&>pre]:m-0 [&>pre]:bg-transparent [&>pre]:p-4 [&>pre]:text-sm [&_code]:text-sm"
            style={{ fontFamily: 'var(--font-mono)' }}
            dangerouslySetInnerHTML={{ __html: lightHtml }}
          />
          {/* Dark theme */}
          <div
            className="hidden dark:block [&>pre]:m-0 [&>pre]:bg-transparent [&>pre]:p-4 [&>pre]:text-sm [&_code]:text-sm"
            style={{ fontFamily: 'var(--font-mono)' }}
            dangerouslySetInnerHTML={{ __html: darkHtml }}
          />
        </div>
      )}
    </BlockContainer>
  );
};
