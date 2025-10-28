import React, { useState } from 'react';
import { Settings, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { ThemeToggle } from './ThemeToggle';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

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
        <ThemeToggle />

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

      {/* Settings Modal */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>
              Manage your preferences and application settings
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="editor">Editor</TabsTrigger>
              <TabsTrigger value="git">Git</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4">
              <div className="space-y-4">
                <h4 className="text-sm font-medium">General Settings</h4>

                <div className="space-y-2">
                  <Label htmlFor="workspace-path">Default Workspace Path</Label>
                  <Input
                    id="workspace-path"
                    placeholder="/Users/you/projects"
                    className="font-mono text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="auto-save">Auto-save</Label>
                  <select
                    id="auto-save"
                    className="w-full px-3 py-2 rounded-md border border-input bg-background"
                  >
                    <option value="off">Off</option>
                    <option value="afterDelay">After Delay</option>
                    <option value="onFocusChange">On Focus Change</option>
                  </select>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Show line numbers</Label>
                    <p className="text-sm text-muted-foreground">Display line numbers in editor</p>
                  </div>
                  <input type="checkbox" defaultChecked className="h-4 w-4" />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Word wrap</Label>
                    <p className="text-sm text-muted-foreground">Wrap long lines</p>
                  </div>
                  <input type="checkbox" className="h-4 w-4" />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="editor" className="space-y-4">
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Editor Settings</h4>

                <div className="space-y-2">
                  <Label htmlFor="font-size">Font Size</Label>
                  <Input
                    id="font-size"
                    type="number"
                    defaultValue="14"
                    min="10"
                    max="24"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tab-size">Tab Size</Label>
                  <Input
                    id="tab-size"
                    type="number"
                    defaultValue="2"
                    min="1"
                    max="8"
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Format on save</Label>
                    <p className="text-sm text-muted-foreground">Automatically format code when saving</p>
                  </div>
                  <input type="checkbox" defaultChecked className="h-4 w-4" />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto closing brackets</Label>
                    <p className="text-sm text-muted-foreground">Automatically close brackets and quotes</p>
                  </div>
                  <input type="checkbox" defaultChecked className="h-4 w-4" />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="git" className="space-y-4">
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Git Settings</h4>

                <div className="space-y-2">
                  <Label htmlFor="git-name">User Name</Label>
                  <Input
                    id="git-name"
                    placeholder="Your Name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="git-email">Email</Label>
                  <Input
                    id="git-email"
                    type="email"
                    placeholder="your.email@example.com"
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto fetch</Label>
                    <p className="text-sm text-muted-foreground">Automatically fetch from remote</p>
                  </div>
                  <input type="checkbox" defaultChecked className="h-4 w-4" />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Confirm before push</Label>
                    <p className="text-sm text-muted-foreground">Ask for confirmation before pushing</p>
                  </div>
                  <input type="checkbox" defaultChecked className="h-4 w-4" />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="advanced" className="space-y-4">
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Advanced Settings</h4>

                <div className="space-y-2">
                  <Label htmlFor="max-files">Maximum Files to Watch</Label>
                  <Input
                    id="max-files"
                    type="number"
                    defaultValue="10000"
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable telemetry</Label>
                    <p className="text-sm text-muted-foreground">Help improve Conductor by sending usage data</p>
                  </div>
                  <input type="checkbox" className="h-4 w-4" />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Developer mode</Label>
                    <p className="text-sm text-muted-foreground">Enable advanced debugging features</p>
                  </div>
                  <input type="checkbox" className="h-4 w-4" />
                </div>

                <Separator />

                <Button variant="outline" className="w-full">
                  Reset All Settings
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setIsSettingsOpen(false)}>
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
