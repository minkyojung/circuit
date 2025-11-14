/**
 * ChatInputControls Component
 *
 * Control bar for chat input with buttons and controls:
 * - Attach file button
 * - Model selector
 * - Thinking mode dropdown
 * - Architect mode toggle
 * - Plan mode toggle (feature flag controlled)
 * - Context gauge
 * - Send/Cancel button
 */

import React from 'react';
import { ArrowUp, Paperclip, X, ListChecks, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ContextGauge } from '../ContextGauge';
import { FEATURES } from '@/config/features';
import type { ClaudeModel } from '@/types/settings';
import type { ThinkingMode } from '../ChatInput';

interface ChatInputControlsProps {
  // Control visibility
  showControls?: boolean;

  // State
  disabled?: boolean;
  isSending?: boolean;
  isCancelling?: boolean;

  // Input state
  value: string;
  hasAttachments: boolean;

  // Callbacks
  onAttachFile: () => void;
  onCycleModel: () => void;
  onSend: () => void;
  onCancel?: () => void;
  onCompact: () => Promise<void>;

  // Model state
  currentModel: ClaudeModel;
  modelLabels: Record<ClaudeModel, string>;

  // Thinking mode state
  thinkingMode: ThinkingMode;
  thinkingModeLabels: Record<ThinkingMode, string>;
  onThinkingModeChange: (mode: ThinkingMode) => void;

  // Architect mode state
  architectMode: boolean;
  onArchitectModeToggle: () => void;
  workspacePath?: string;

  // Plan mode state
  isPlanMode: boolean;
  onPlanModeToggle: () => void;

  // Context metrics
  contextMetrics?: {
    context: {
      percentage: number;
      current?: number;
      limit?: number;
    };
  };

  // Styling constants
  INPUT_STYLES: {
    controls: {
      gap: string;
      attachButton: string;
      attachIconSize: number;
      modelButton: string;
      modelIconSize: number;
      sourcesButton: string;
      sourcesIconSize: number;
    };
    sendButton: {
      size: string;
      borderRadius: string;
      iconSize: number;
    };
  };
}

export const ChatInputControls: React.FC<ChatInputControlsProps> = ({
  showControls = true,
  disabled = false,
  isSending = false,
  isCancelling = false,
  value,
  hasAttachments,
  onAttachFile,
  onCycleModel,
  onSend,
  onCancel,
  onCompact,
  currentModel,
  modelLabels,
  thinkingMode,
  thinkingModeLabels,
  onThinkingModeChange,
  architectMode,
  onArchitectModeToggle,
  workspacePath,
  isPlanMode,
  onPlanModeToggle,
  contextMetrics,
  INPUT_STYLES,
}) => {
  return (
    <div className="flex items-center justify-between">
      {/* Left: Control buttons */}
      {showControls && (
        <div className={`flex ${INPUT_STYLES.controls.gap} items-center`}>
          {/* Model Selector - Cycle through models on click */}
          <button
            onClick={onCycleModel}
            disabled={disabled}
            className={`inline-flex items-center ${INPUT_STYLES.controls.modelButton} bg-white/5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50`}
            title={`Current: ${modelLabels[currentModel]} (click to cycle)`}
          >
            <span className="font-light">{modelLabels[currentModel]}</span>
          </button>

          {/* Thinking Mode Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={`inline-flex items-center gap-1 ${INPUT_STYLES.controls.modelButton} text-muted-foreground hover:text-foreground transition-colors`}
                disabled={disabled}
              >
                <span className="font-light">{thinkingModeLabels[thinkingMode]}</span>
                <ChevronDown size={12} strokeWidth={1.5} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40 p-1">
              <DropdownMenuItem
                onClick={() => onThinkingModeChange('normal')}
                className={`py-2 px-3 cursor-pointer hover:bg-secondary/50 focus:bg-secondary/50 ${thinkingMode === 'normal' ? 'bg-secondary' : ''}`}
              >
                <span className="text-sm font-light">Normal</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onThinkingModeChange('think')}
                className={`py-2 px-3 cursor-pointer hover:bg-secondary/50 focus:bg-secondary/50 ${thinkingMode === 'think' ? 'bg-secondary' : ''}`}
              >
                <span className="text-sm font-light">Think</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onThinkingModeChange('megathink')}
                className={`py-2 px-3 cursor-pointer hover:bg-secondary/50 focus:bg-secondary/50 ${thinkingMode === 'megathink' ? 'bg-secondary' : ''}`}
              >
                <span className="text-sm font-light">Megathink</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onThinkingModeChange('ultrathink')}
                className={`py-2 px-3 cursor-pointer hover:bg-secondary/50 focus:bg-secondary/50 ${thinkingMode === 'ultrathink' ? 'bg-secondary' : ''}`}
              >
                <span className="text-sm font-light">Ultrathink</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Multi-Plan Mode Toggle Button - Feature Flag Controlled */}
          {FEATURES.PLAN_MODE && (
            <button
              onClick={onPlanModeToggle}
              className={`inline-flex items-center justify-center ${INPUT_STYLES.controls.sourcesButton} transition-colors ${
                isPlanMode
                  ? 'text-primary hover:text-primary/80'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Toggle Multi-Conversation Plan Mode (⌘⇧P)"
            >
              <ListChecks size={INPUT_STYLES.controls.sourcesIconSize} strokeWidth={1.5} />
            </button>
          )}
        </div>
      )}

      {/* Right: Attach File, Context Gauge and Send or Cancel button */}
      <div className="flex items-center gap-2">
        {showControls && (
          <>
            {/* Attach File Button */}
            <button
              onClick={onAttachFile}
              disabled={disabled}
              className={`inline-flex items-center ${INPUT_STYLES.controls.attachButton} text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50`}
              title="Attach files"
            >
              <Paperclip size={INPUT_STYLES.controls.attachIconSize} strokeWidth={1.5} />
            </button>
            {/* Context Gauge */}
            <ContextGauge
              percentage={contextMetrics?.context.percentage ?? 0}
              current={contextMetrics?.context.current}
              limit={contextMetrics?.context.limit}
              onCompact={onCompact}
              disabled={disabled}
            />
          </>
        )}
        {isSending && onCancel ? (
          /* Cancel button when sending */
          <button
            onClick={onCancel}
            disabled={isCancelling}
            className={`${INPUT_STYLES.sendButton.size} ${INPUT_STYLES.sendButton.borderRadius} flex items-center justify-center transition-all shrink-0 ${
              isCancelling
                ? 'bg-muted/50 text-muted-foreground/40 cursor-not-allowed'
                : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
            }`}
            title={isCancelling ? "Cancelling..." : "Cancel message"}
          >
            <X size={INPUT_STYLES.sendButton.iconSize} strokeWidth={2} />
          </button>
        ) : (
          /* Send button */
          <button
            onClick={onSend}
            disabled={(!value.trim() && !hasAttachments) || disabled}
            className={`${INPUT_STYLES.sendButton.size} ${INPUT_STYLES.sendButton.borderRadius} flex items-center justify-center transition-all shrink-0 ${
              (!value.trim() && !hasAttachments) || disabled
                ? 'bg-muted/50 text-muted-foreground/40 cursor-not-allowed'
                : 'bg-primary text-primary-foreground hover:bg-primary/90 border border-primary/30'
            }`}
            title="Send message (Cmd/Ctrl+Enter)"
          >
            <ArrowUp size={INPUT_STYLES.sendButton.iconSize} strokeWidth={2} />
          </button>
        )}
      </div>
    </div>
  );
};
