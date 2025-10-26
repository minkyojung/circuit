import React from 'react';
import { X } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-card border border-border rounded-lg shadow-lg w-full max-w-md pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">Settings</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-sidebar-accent rounded transition-colors text-muted-foreground hover:text-foreground"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 space-y-6">
            {/* Theme Setting */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-foreground">Theme</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Switch between light and dark mode
                </p>
              </div>
              <ThemeToggle />
            </div>

            {/* Future settings can go here */}
          </div>

          {/* Footer (optional) */}
          <div className="px-6 py-4 border-t border-border">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium text-sm"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
