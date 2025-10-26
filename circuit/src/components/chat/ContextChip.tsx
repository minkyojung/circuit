import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContextChipProps {
  label: string;
  onRemove: () => void;
}

export const ContextChip: React.FC<ContextChipProps> = ({ label, onRemove }) => {
  return (
    <div className={cn(
      "inline-flex items-center gap-2 px-3 py-1.5",
      "bg-card border border-border rounded-lg",
      "text-xs text-foreground",
      "group hover:border-ring transition-colors"
    )}>
      <span>{label}</span>
      <button
        onClick={onRemove}
        className="text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Remove context"
      >
        <X size={12} />
      </button>
    </div>
  );
};
