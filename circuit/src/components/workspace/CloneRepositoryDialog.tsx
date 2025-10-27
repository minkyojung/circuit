import React, { useState } from 'react';
import { GitBranch, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface CloneRepositoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onClone: (gitUrl: string) => void;
}

export const CloneRepositoryDialog: React.FC<CloneRepositoryDialogProps> = ({
  isOpen,
  onClose,
  onClone,
}) => {
  const [gitUrl, setGitUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (gitUrl.trim()) {
      onClone(gitUrl.trim());
      setGitUrl('');
      onClose();
    }
  };

  const handleCancel = () => {
    setGitUrl('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={handleCancel}
      />

      {/* Dialog */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[450px]">
        <div className="bg-card border border-border rounded-lg shadow-lg">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <GitBranch size={20} className="text-muted-foreground" />
              <h2 className="text-lg font-semibold text-foreground">Clone Repository</h2>
            </div>
            <button
              onClick={handleCancel}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="git-url" className="text-sm font-medium text-foreground">
                Repository URL
              </Label>
              <Input
                id="git-url"
                type="url"
                placeholder="https://github.com/username/repository.git"
                value={gitUrl}
                onChange={(e) => setGitUrl(e.target.value)}
                className="w-full"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Enter the Git repository URL (HTTPS or SSH)
              </p>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={handleCancel}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!gitUrl.trim()}
              >
                Clone Repository
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};
