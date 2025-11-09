/**
 * GitHubOnboardingDialog - GitHub OAuth onboarding flow
 *
 * Mandatory steps:
 * 1. GitHub OAuth authentication
 * 2. Environment check (Git, GitHub CLI)
 * 3. Repository selection (minimum 1 required)
 * 4. Repository cloning with progress
 * 5. Git config sync (optional)
 * 6. GitHub CLI setup (optional)
 */

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { X } from 'lucide-react';

// Import step components
import { GitHubAuthStep } from './steps/GitHubAuthStep';
import { GitHubEnvCheckStep } from './steps/GitHubEnvCheckStep';
import { GitHubRepoSelectStep } from './steps/GitHubRepoSelectStep';
import { GitHubCloneStep } from './steps/GitHubCloneStep';
import { GitConfigSyncStep } from './steps/GitConfigSyncStep';
import { CLISetupStep } from './steps/CLISetupStep';
import { GitHubCompleteStep } from './steps/GitHubCompleteStep';

type GitHubOnboardingStep =
  | 'auth'
  | 'env-check'
  | 'repo-select'
  | 'clone'
  | 'git-config'
  | 'cli-setup'
  | 'complete';

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
  description: string;
  cloneUrl: string;
  private: boolean;
  stars: number;
  language: string;
  defaultBranch: string;
}

interface EnvironmentStatus {
  git: {
    installed: boolean;
    version?: string;
    status: 'ok' | 'error';
    message?: string;
  };
  gitConfig: {
    configured: boolean;
    name?: string;
    email?: string;
    status: 'ok' | 'warning';
    message?: string;
  };
  cli: {
    installed: boolean;
    version?: string;
    authenticated: boolean;
    username?: string;
    action: 'none' | 'login' | 'install';
    status: 'ok' | 'warning' | 'info';
    message?: string;
  };
}

interface OnboardingState {
  currentStep: GitHubOnboardingStep;
  accessToken: string | null;
  user: GitHubUser | null;
  environment: EnvironmentStatus | null;
  selectedRepos: Repository[];
  clonePath: string | null;
  gitConfigSynced: boolean;
  cliConfigured: boolean;
}

interface ClonedRepoInfo {
  name: string;
  fullName: string;
  path: string;
  defaultBranch: string;
}

interface GitHubOnboardingDialogProps {
  open: boolean;
  onComplete: (clonedRepos: ClonedRepoInfo[]) => void;
}

const STEPS: { id: GitHubOnboardingStep; label: string; required: boolean }[] = [
  { id: 'auth', label: 'GitHub Login', required: true },
  { id: 'env-check', label: 'Environment', required: true },
  { id: 'repo-select', label: 'Select Repos', required: true },
  { id: 'clone', label: 'Clone', required: true },
  { id: 'git-config', label: 'Git Config', required: false },
  { id: 'cli-setup', label: 'CLI Setup', required: false },
  { id: 'complete', label: 'Done', required: true },
];

export function GitHubOnboardingDialog({ open, onComplete }: GitHubOnboardingDialogProps) {
  const [state, setState] = useState<OnboardingState>({
    currentStep: 'auth',
    accessToken: null,
    user: null,
    environment: null,
    selectedRepos: [],
    clonePath: null,
    gitConfigSynced: false,
    cliConfigured: false,
  });

  const currentStepIndex = STEPS.findIndex(s => s.id === state.currentStep);
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100;

  const handleAuthComplete = (accessToken: string, user: GitHubUser) => {
    setState(prev => ({
      ...prev,
      accessToken,
      user,
      currentStep: 'env-check',
    }));
  };

  const handleEnvCheckComplete = (environment: EnvironmentStatus) => {
    setState(prev => ({
      ...prev,
      environment,
      currentStep: 'repo-select',
    }));
  };

  const handleRepoSelect = (repos: Repository[]) => {
    setState(prev => ({
      ...prev,
      selectedRepos: repos,
      currentStep: 'clone',
    }));
  };

  const handleCloneComplete = (clonePath: string) => {
    setState(prev => ({
      ...prev,
      clonePath,
      // Skip git-config if already configured
      currentStep: prev.environment?.gitConfig.configured ? 'cli-setup' : 'git-config',
    }));
  };

  const handleGitConfigComplete = () => {
    setState(prev => ({
      ...prev,
      gitConfigSynced: true,
      currentStep: 'cli-setup',
    }));
  };

  const handleCLISetupComplete = () => {
    setState(prev => ({
      ...prev,
      cliConfigured: true,
      currentStep: 'complete',
    }));
  };

  const handleSkipGitConfig = () => {
    setState(prev => ({
      ...prev,
      currentStep: 'cli-setup',
    }));
  };

  const handleSkipCLISetup = () => {
    setState(prev => ({
      ...prev,
      currentStep: 'complete',
    }));
  };

  const handleComplete = () => {
    const clonedRepoInfo: ClonedRepoInfo[] = state.selectedRepos.map(repo => ({
      name: repo.name,
      fullName: repo.fullName,
      path: `${state.clonePath}/${repo.name}`,
      defaultBranch: repo.defaultBranch,
    }));
    onComplete(clonedRepoInfo);
  };

  const handleBack = () => {
    const currentIndex = STEPS.findIndex(s => s.id === state.currentStep);
    if (currentIndex > 0) {
      setState(prev => ({
        ...prev,
        currentStep: STEPS[currentIndex - 1].id,
      }));
    }
  };

  const canGoBack = currentStepIndex > 0 &&
    state.currentStep !== 'complete' &&
    state.currentStep !== 'clone';

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Header */}
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl font-bold">Welcome to Octave</DialogTitle>
              <DialogDescription className="mt-1">
                Connect your GitHub account and get started
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            {STEPS.filter(s => s.required || (
              // Show optional steps only if we've reached them
              (s.id === 'git-config' && currentStepIndex >= 4) ||
              (s.id === 'cli-setup' && currentStepIndex >= 5)
            )).map((step, index) => {
              const actualIndex = STEPS.findIndex(s => s.id === step.id);
              return (
                <div
                  key={step.id}
                  className={`flex items-center gap-1 ${
                    actualIndex <= currentStepIndex ? 'text-foreground font-medium' : ''
                  }`}
                >
                  <div
                    className={`w-2 h-2 rounded-full ${
                      actualIndex < currentStepIndex
                        ? 'bg-primary'
                        : actualIndex === currentStepIndex
                        ? 'bg-primary animate-pulse'
                        : 'bg-muted-foreground/30'
                    }`}
                  />
                  {step.label}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto py-6">
          {state.currentStep === 'auth' && (
            <GitHubAuthStep onComplete={handleAuthComplete} />
          )}

          {state.currentStep === 'env-check' && (
            <GitHubEnvCheckStep
              onComplete={handleEnvCheckComplete}
              environment={state.environment}
            />
          )}

          {state.currentStep === 'repo-select' && state.accessToken && (
            <GitHubRepoSelectStep
              accessToken={state.accessToken}
              onSelect={handleRepoSelect}
              selectedRepos={state.selectedRepos}
            />
          )}

          {state.currentStep === 'clone' && state.accessToken && (
            <GitHubCloneStep
              repositories={state.selectedRepos}
              accessToken={state.accessToken}
              onComplete={handleCloneComplete}
            />
          )}

          {state.currentStep === 'git-config' && state.user && (
            <GitConfigSyncStep
              user={state.user}
              onComplete={handleGitConfigComplete}
              onSkip={handleSkipGitConfig}
            />
          )}

          {state.currentStep === 'cli-setup' && state.environment && (
            <CLISetupStep
              cliStatus={state.environment.cli}
              onComplete={handleCLISetupComplete}
              onSkip={handleSkipCLISetup}
            />
          )}

          {state.currentStep === 'complete' && (
            <GitHubCompleteStep
              clonedRepos={state.selectedRepos}
              clonePath={state.clonePath || ''}
              onComplete={handleComplete}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {STEPS.find(s => s.id === state.currentStep)?.required === false && (
              <span>Optional step - you can skip this</span>
            )}
          </div>

          <div className="flex gap-2">
            {canGoBack && (
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
