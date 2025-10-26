import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ContextChip } from './ContextChip';
import { cn } from '@/lib/utils';

type ChatMode = 'sonnet' | 'think' | 'agent';

interface ChatInputBoxProps {
  onSubmit: (message: string, mode: ChatMode) => void;
  placeholder?: string;
  prefillMessage?: string | null;
  onPrefillCleared?: () => void;
}

export const ChatInputBox: React.FC<ChatInputBoxProps> = ({
  onSubmit,
  placeholder = "Make something wonderful...",
  prefillMessage,
  onPrefillCleared,
}) => {
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState<ChatMode>('sonnet');
  const [contextChips, setContextChips] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Handle prefill message
  useEffect(() => {
    if (prefillMessage) {
      setMessage(prefillMessage);
      onPrefillCleared?.();
      // Focus textarea after prefill
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }, [prefillMessage, onPrefillCleared]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [message]);

  const handleSubmit = () => {
    if (message.trim()) {
      onSubmit(message, mode);
      setMessage('');
      setContextChips([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const removeContextChip = (index: number) => {
    setContextChips(chips => chips.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-[640px] px-4 z-50">
      <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Context Chips Area */}
        {contextChips.length > 0 && (
          <div className="px-4 pt-3 pb-2 border-b border-border">
            <div className="flex flex-wrap gap-2">
              {contextChips.map((chip, index) => (
                <ContextChip
                  key={index}
                  label={chip}
                  onRemove={() => removeContextChip(index)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Main Input Area */}
        <div className="p-4">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={cn(
              "min-h-[60px] max-h-[200px] resize-none border-0 p-0",
              "text-base placeholder:text-muted-foreground",
              "focus-visible:ring-0 focus-visible:ring-offset-0",
              "bg-transparent"
            )}
          />
        </div>

        {/* Bottom Bar - Mode Buttons & Submit */}
        <div className="px-4 pb-4 flex items-center justify-between">
          {/* Mode Buttons */}
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMode('sonnet')}
              className={cn(
                "text-xs",
                mode === 'sonnet' && "bg-accent text-accent-foreground"
              )}
            >
              Sonnet
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMode('think')}
              className={cn(
                "text-xs",
                mode === 'think' && "bg-accent text-accent-foreground"
              )}
            >
              Think
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMode('agent')}
              className={cn(
                "text-xs",
                mode === 'agent' && "bg-accent text-accent-foreground"
              )}
            >
              Agent
            </Button>
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={!message.trim()}
            size="icon"
            className={cn(
              "h-8 w-8 rounded-full",
              "bg-primary hover:bg-primary/90",
              "disabled:opacity-30"
            )}
          >
            <ArrowUp size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
};
