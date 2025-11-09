/**
 * SuccessStep - Onboarding complete!
 *
 * Shows summary of what was configured and provides
 * quick start tips for using Octave.
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Sparkles, Keyboard, Terminal, GitCommit, Loader2 } from 'lucide-react';

interface GitHubUser {
  login: string;
  name: string;
  email: string;
  avatar_url: string;
}

interface Repository {
  id: number;
  name: string;
  fullName: string;
}

interface SuccessStepProps {
  githubUser: GitHubUser | null;
  clonedRepos: Repository[];
  workspaceId: string | null;
  onComplete: () => void;
}

export function SuccessStep({ githubUser, clonedRepos, workspaceId, onComplete }: SuccessStepProps) {
  const [completing, setCompleting] = useState(false);

  const handleComplete = async () => {
    setCompleting(true);
    try {
      await onComplete();
    } finally {
      // Don't reset completing state since we're transitioning away
    }
  };

  return (
    <div className="space-y-6">
      {/* Success Icon & Message */}
      <div className="flex flex-col items-center justify-center py-8 space-y-4">
        <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center animate-in zoom-in duration-500">
          <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
        </div>

        <div className="text-center space-y-2">
          <h3 className="text-2xl font-bold">You're All Set!</h3>
          <p className="text-muted-foreground max-w-md">
            Your development environment is configured and ready to use
          </p>
        </div>
      </div>

      {/* Summary of What Was Set Up */}
      <div className="space-y-4">
        <div className="rounded-lg border p-4 space-y-3">
          <div className="font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            What We Set Up
          </div>

          <div className="space-y-2 text-sm">
            {/* GitHub Connection */}
            {githubUser && (
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                <div>
                  <div className="font-medium">GitHub Connected</div>
                  <div className="text-muted-foreground">
                    Logged in as @{githubUser.login}
                  </div>
                </div>
              </div>
            )}

            {/* Repositories Cloned */}
            {clonedRepos.length > 0 && (
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                <div>
                  <div className="font-medium">Repositories Cloned</div>
                  <div className="text-muted-foreground">
                    {clonedRepos.length} {clonedRepos.length === 1 ? 'repository' : 'repositories'} ready to use
                  </div>
                </div>
              </div>
            )}

            {/* Workspace Created */}
            {workspaceId && (
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                <div>
                  <div className="font-medium">Workspace Created</div>
                  <div className="text-muted-foreground">
                    Your first workspace is ready
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Start Tips */}
        <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
          <div className="font-medium flex items-center gap-2">
            <Keyboard className="h-4 w-4" />
            Quick Start Tips
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-primary">1</span>
              </div>
              <div>
                <div className="font-medium mb-1">Quick File Search</div>
                <div className="text-muted-foreground">
                  Press <kbd className="px-1.5 py-0.5 bg-muted border rounded text-xs">Cmd+P</kbd> to quickly search and open files
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-primary">2</span>
              </div>
              <div>
                <div className="font-medium mb-1">AI-Powered Chat</div>
                <div className="text-muted-foreground">
                  Use the chat panel to ask Claude about your code, get explanations, or request changes
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-primary">3</span>
              </div>
              <div>
                <div className="font-medium mb-1">Commit Changes</div>
                <div className="text-muted-foreground">
                  Press <kbd className="px-1.5 py-0.5 bg-muted border rounded text-xs">Cmd+Enter</kbd> to commit your changes with AI-generated messages
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Start Using Octave Button */}
      <div className="flex justify-center pt-4">
        <Button onClick={handleComplete} disabled={completing} size="lg" className="min-w-[250px]">
          {completing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Setting up...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Start Using Octave
            </>
          )}
        </Button>
      </div>

      {/* Footer Note */}
      <div className="text-center text-xs text-muted-foreground pt-4 border-t">
        You can access Settings anytime by pressing <kbd className="px-1 py-0.5 bg-muted border rounded text-xs">Cmd+,</kbd>
      </div>
    </div>
  );
}
