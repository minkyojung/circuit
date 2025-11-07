/**
 * SystemRulesModal - Display system AI rules (The Architect philosophy)
 */

import React from 'react';
import { X, Building2 } from 'lucide-react';
import { SYSTEM_AI_RULES } from '@/services/projectConfig';

interface SystemRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SystemRulesModal: React.FC<SystemRulesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[80vh] m-4 bg-background border border-border rounded-lg shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
              <Building2 size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">System Rules</h2>
              <p className="text-xs text-muted-foreground">The Architect Philosophy</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-4">
            {SYSTEM_AI_RULES.map((rule, index) => (
              <div key={index} className="flex gap-3">
                <div className="flex-shrink-0">
                  <div className="w-6 h-6 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center text-xs font-medium">
                    {index + 1}
                  </div>
                </div>
                <p className="text-sm text-foreground/90 leading-relaxed pt-0.5">
                  {rule}
                </p>
              </div>
            ))}
          </div>

          {/* Info box */}
          <div className="mt-6 p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground">💡 About these rules:</span><br />
              These system-level rules are always applied to every AI conversation in Circuit.
              They embody "The Architect" philosophy—a Principal Software Engineer mindset focused
              on clarity, pragmatism, and building antifragile systems. Your project-specific rules
              are added on top of these foundational principles.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
