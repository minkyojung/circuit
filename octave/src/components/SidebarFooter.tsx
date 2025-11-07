import React, { useState } from 'react';
import { Settings, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { ThemeToggle } from './ThemeToggle';
import { SettingsDialog } from './SettingsDialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

interface SidebarFooterProps {
  className?: string;
}

export const SidebarFooter: React.FC<SidebarFooterProps> = ({ className }) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'bug' | 'feature' | 'question'>('bug');
  const [feedbackTitle, setFeedbackTitle] = useState('');
  const [feedbackBody, setFeedbackBody] = useState('');

  const handleSubmitFeedback = () => {
    // TODO: Implement feedback submission

    // Clear form
    setFeedbackTitle('');
    setFeedbackBody('');
    setIsFeedbackOpen(false);
  };

  return (
    <>
      <div className={cn("flex items-center justify-between gap-2 p-2", className)}>
        {/* Settings Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsSettingsOpen(true)}
          className={cn(
            "flex items-center justify-center p-2 rounded-md",
            "h-9 w-9",
            "transition-all duration-200",
            "hover:bg-sidebar-hover",
            "text-sidebar-foreground-muted hover:text-sidebar-foreground"
          )}
          title="Settings"
        >
          <Settings size={18} strokeWidth={1.5} />
        </motion.button>

        {/* Theme Toggle */}
        <ThemeToggle className="p-2 h-9 w-9 hover:bg-sidebar-hover text-sidebar-foreground-muted hover:text-sidebar-foreground" />

        {/* Feedback Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsFeedbackOpen(true)}
          className={cn(
            "flex items-center justify-center p-2 rounded-md",
            "h-9 w-9",
            "transition-all duration-200",
            "hover:bg-sidebar-hover",
            "text-sidebar-foreground-muted hover:text-sidebar-foreground"
          )}
          title="Send Feedback"
        >
          <MessageSquare size={18} strokeWidth={1.5} />
        </motion.button>
      </div>

      {/* Settings Dialog - New Comprehensive Settings */}
      <SettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Feedback Modal */}
      <Dialog open={isFeedbackOpen} onOpenChange={setIsFeedbackOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Send Feedback</DialogTitle>
            <DialogDescription>
              Help us improve Conductor by sharing your feedback
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Feedback Type */}
            <div className="space-y-2">
              <Label>Feedback Type</Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setFeedbackType('bug')}
                  className={cn(
                    "px-3 py-2 text-sm rounded-md border transition-colors",
                    feedbackType === 'bug'
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-accent"
                  )}
                >
                  🐛 Bug Report
                </button>
                <button
                  onClick={() => setFeedbackType('feature')}
                  className={cn(
                    "px-3 py-2 text-sm rounded-md border transition-colors",
                    feedbackType === 'feature'
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-accent"
                  )}
                >
                  💡 Feature Request
                </button>
                <button
                  onClick={() => setFeedbackType('question')}
                  className={cn(
                    "px-3 py-2 text-sm rounded-md border transition-colors",
                    feedbackType === 'question'
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-accent"
                  )}
                >
                  ❓ Question
                </button>
              </div>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="feedback-title">Title</Label>
              <Input
                id="feedback-title"
                placeholder="Brief description of your feedback"
                value={feedbackTitle}
                onChange={(e) => setFeedbackTitle(e.target.value)}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="feedback-body">Description</Label>
              <Textarea
                id="feedback-body"
                placeholder="Provide more details about your feedback..."
                rows={6}
                value={feedbackBody}
                onChange={(e) => setFeedbackBody(e.target.value)}
              />
            </div>

            {/* System Info */}
            <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
              <p className="font-medium mb-1">System Information (automatically included)</p>
              <p>OS: macOS 14.5</p>
              <p>Conductor Version: 1.0.0</p>
              <p>Electron: 38.3.0</p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsFeedbackOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitFeedback}
              disabled={!feedbackTitle.trim() || !feedbackBody.trim()}
            >
              Submit Feedback
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
