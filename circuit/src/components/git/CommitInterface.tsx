/**
 * CommitInterface - Commit message input with AI generation
 */

import { useState } from 'react';
import { Sparkles, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// @ts-ignore - Electron IPC
const { ipcRenderer } = window.require('electron');

interface CommitInterfaceProps {
  workspacePath: string;
  stagedCount: number;
  onCommitSuccess: () => void;
}

export function CommitInterface({ workspacePath, stagedCount, onCommitSuccess }: CommitInterfaceProps) {
  const [message, setMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleGenerateMessage = async () => {
    if (stagedCount === 0) {
      setError('No staged changes to analyze');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setSuggestions([]);

    try {
      const result = await ipcRenderer.invoke('git:generate-commit-message', workspacePath);

      if (result.success) {
        setSuggestions(result.suggestions);
        // Auto-fill with first suggestion
        if (result.suggestions.length > 0) {
          setMessage(result.suggestions[0]);
        }
      } else {
        setError(result.error || 'Failed to generate commit message');
      }
    } catch (err) {
      console.error('Failed to generate commit message:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCommit = async (push: boolean = false) => {
    if (!message.trim()) {
      setError('Commit message is required');
      return;
    }

    if (stagedCount === 0) {
      setError('No staged changes to commit');
      return;
    }

    setIsCommitting(true);
    setError(null);

    try {
      const handler = push ? 'git:commit-and-push' : 'git:commit';
      const result = await ipcRenderer.invoke(handler, workspacePath, message);

      if (result.success) {
        // Success!
        setMessage('');
        setSuggestions([]);
        setShowSuccess(true);

        // Hide success message after 2s
        setTimeout(() => setShowSuccess(false), 2000);

        // Notify parent to refresh
        onCommitSuccess();
      } else {
        setError(result.error || 'Failed to commit');
      }
    } catch (err) {
      console.error('Failed to commit:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsCommitting(false);
    }
  };

  if (stagedCount === 0) {
    return (
      <div className="p-4 border-t border-border">
        <div className="text-center text-sm text-muted-foreground py-4">
          Stage changes to commit
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 border-t border-border space-y-3">
      <div className="text-xs font-semibold text-foreground">
        Commit ({stagedCount} file{stagedCount !== 1 ? 's' : ''})
      </div>

      {/* Success Message */}
      {showSuccess && (
        <div className="flex items-center gap-2 p-2 bg-green-500/10 border border-green-500/20 rounded-lg text-green-600 text-sm">
          <Check size={16} />
          <span>Committed successfully!</span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Message Input */}
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Commit message..."
        className="w-full px-3 py-2 text-sm bg-sidebar-accent border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground"
        rows={3}
        disabled={isCommitting}
      />

      {/* AI Suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">AI Suggestions:</div>
          {suggestions.map((suggestion, i) => (
            <button
              key={i}
              onClick={() => setMessage(suggestion)}
              disabled={isCommitting}
              className={cn(
                "w-full text-left px-2 py-1.5 text-xs rounded transition-colors",
                message === suggestion
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "bg-sidebar-accent hover:bg-sidebar-hover border border-transparent"
              )}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleGenerateMessage}
          disabled={isGenerating || isCommitting || stagedCount === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-sidebar-accent hover:bg-sidebar-hover rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Sparkles size={12} />
          )}
          {isGenerating ? 'Generating...' : 'AI Generate'}
        </button>

        <button
          onClick={() => handleCommit(false)}
          disabled={!message.trim() || isCommitting || stagedCount === 0}
          className="px-3 py-1.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isCommitting ? 'Committing...' : 'Commit'}
        </button>

        <button
          onClick={() => handleCommit(true)}
          disabled={!message.trim() || isCommitting || stagedCount === 0}
          className="flex-1 px-3 py-1.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isCommitting ? 'Pushing...' : 'Commit & Push'}
        </button>
      </div>

      {/* Helper text */}
      <div className="text-xs text-muted-foreground">
        💡 Tip: Click "AI Generate" for smart commit messages
      </div>
    </div>
  );
}
