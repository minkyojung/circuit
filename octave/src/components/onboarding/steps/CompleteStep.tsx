/**
 * CompleteStep - Onboarding completion screen
 *
 * Shows what was set up and next steps
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, MessageSquare, Package, Keyboard } from 'lucide-react';
import type { RepositoryInfo } from '@/types/onboarding';

interface CompleteStepProps {
  repository: RepositoryInfo | null;
  workspaceId: string | null;
  onComplete: () => void;
}

export function CompleteStep({ repository, workspaceId, onComplete }: CompleteStepProps) {
  return (
    <div className="space-y-8">
      {/* Success Icon */}
      <div className="flex flex-col items-center text-center space-y-4 py-6">
        <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-6">
          <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-500" />
        </div>
        <div>
          <h3 className="text-2xl font-bold">You're All Set!</h3>
          <p className="text-muted-foreground mt-2">
            Circuit is ready to use
          </p>
        </div>
      </div>

      {/* What We Set Up */}
      <div className="space-y-4">
        <h4 className="font-semibold flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          What we set up
        </h4>

        <div className="space-y-3">
          <SetupItem
            icon={<CheckCircle2 className="h-5 w-5" />}
            label="Claude Code Connected"
            description="AI-powered features are ready"
          />

          <SetupItem
            icon={<CheckCircle2 className="h-5 w-5" />}
            label="Git Configured"
            description="Workspace management enabled"
          />

          {repository && (
            <SetupItem
              icon={<CheckCircle2 className="h-5 w-5" />}
              label="Repository Connected"
              description={repository.name}
            />
          )}

          {workspaceId && (
            <SetupItem
              icon={<CheckCircle2 className="h-5 w-5" />}
              label="Workspace Created"
              description="Your first isolated workspace is ready"
            />
          )}
        </div>
      </div>

      {/* Next Steps */}
      <div className="space-y-4">
        <h4 className="font-semibold">Next steps</h4>

        <div className="grid gap-3">
          <NextStepCard
            icon={<MessageSquare className="h-5 w-5" />}
            title="Start a conversation with Claude"
            description="Ask questions, get help with code, or discuss ideas"
          />

          <NextStepCard
            icon={<Package className="h-5 w-5" />}
            title="Install MCP servers (optional)"
            description="Extend Claude's capabilities with tools and integrations"
          />

          <NextStepCard
            icon={<Keyboard className="h-5 w-5" />}
            title="Learn keyboard shortcuts"
            description="Press Cmd+? to see all available shortcuts"
          />
        </div>
      </div>

      {/* Start Button */}
      <Button
        onClick={onComplete}
        size="lg"
        className="w-full mt-6"
      >
        Start Using Circuit
      </Button>
    </div>
  );
}

interface SetupItemProps {
  icon: React.ReactNode;
  label: string;
  description: string;
}

function SetupItem({ icon, label, description }: SetupItemProps) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
      <div className="text-green-600 dark:text-green-500 mt-0.5">
        {icon}
      </div>
      <div>
        <div className="font-medium">{label}</div>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
    </div>
  );
}

interface NextStepCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function NextStepCard({ icon, title, description }: NextStepCardProps) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
      <div className="text-muted-foreground mt-0.5">
        {icon}
      </div>
      <div>
        <div className="font-medium">{title}</div>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
    </div>
  );
}
