/**
 * GitHubCompleteStep - Onboarding complete
 *
 * Shows summary of what was set up and provides
 * next steps for the user
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Folder, Rocket } from 'lucide-react';

interface Repository {
  id: number;
  name: string;
  fullName: string;
  description: string;
}

interface GitHubCompleteStepProps {
  clonedRepos: Repository[];
  clonePath: string;
  onComplete: () => void;
}

export function GitHubCompleteStep({ clonedRepos, clonePath, onComplete }: GitHubCompleteStepProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center justify-center py-8 space-y-4">
        <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
        </div>

        <div className="text-center space-y-2">
          <h3 className="text-2xl font-bold">You're All Set!</h3>
          <p className="text-muted-foreground max-w-md">
            Your GitHub account is connected and your repositories are ready to use
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="space-y-4">
        <div className="rounded-lg border p-4 space-y-3">
          <div className="font-medium flex items-center gap-2">
            <Folder className="h-4 w-4" />
            Cloned Repositories ({clonedRepos.length})
          </div>

          <div className="space-y-2">
            {clonedRepos.map((repo) => (
              <div
                key={repo.id}
                className="text-sm text-muted-foreground pl-6 flex items-start"
              >
                <span className="text-primary mr-2">•</span>
                <div>
                  <div className="font-medium text-foreground">{repo.fullName}</div>
                  <div className="font-mono text-xs mt-1">
                    {clonePath}/{repo.name}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Next Steps */}
        <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
          <div className="font-medium flex items-center gap-2">
            <Rocket className="h-4 w-4" />
            What's Next?
          </div>

          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <span className="text-primary mt-0.5">1.</span>
              <span>Create a new workspace to start working with your code</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-primary mt-0.5">2.</span>
              <span>Use AI-powered features to explore and understand your codebase</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-primary mt-0.5">3.</span>
              <span>Make changes, commit, and push to GitHub - all from Octave</span>
            </div>
          </div>
        </div>
      </div>

      {/* Complete Button */}
      <Button onClick={onComplete} className="w-full" size="lg">
        Start Using Octave
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        You can access Settings anytime to configure additional features
      </p>
    </div>
  );
}
