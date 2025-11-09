/**
 * UnifiedOnboardingDialog - Single unified onboarding flow
 *
 * Logical step progression:
 * 1. Welcome & Prerequisites Check (Git, macOS, Claude Code)
 * 2. GitHub OAuth Authentication
 * 3. Git Configuration Sync (Auto-populate from GitHub)
 * 4. Repository Selection & Clone
 * 5. GitHub CLI Setup (Auto-detect, skip if ready)
 * 6. Create First Workspace
 * 7. Success Summary (No reload!)
 */

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft } from 'lucide-react';

// Import step components (will be created)
import { WelcomeStep } from './steps/WelcomeStep';
import { GitHubAuthStep } from './steps/GitHubAuthStep';
import { GitConfigSyncStep } from './steps/GitConfigSyncStep';
import { GitHubRepoSelectStep } from './steps/GitHubRepoSelectStep';
import { GitHubCloneStep } from './steps/GitHubCloneStep';
import { CLISetupStep } from './steps/CLISetupStep';
import { FirstWorkspaceStep } from './steps/FirstWorkspaceStep';
import { SuccessStep } from './steps/SuccessStep';

// ============================================================================
// Type Definitions
// ============================================================================

export type OnboardingStep =
  | 'welcome'
  | 'github-auth'
  | 'git-config'
  | 'repo-select'
  | 'clone'
  | 'cli-setup'
  | 'first-workspace'
  | 'success';

interface SystemCheckResult {
  macOSVersion: string;
  gitInstalled: boolean;
  gitVersion?: string;
  gitConfigured: boolean;
  gitUserName?: string;
  gitUserEmail?: string;
  claudeCodeInstalled: boolean;
  claudeCodeVersion?: string;
}

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

interface CLIStatus {
  installed: boolean;
  version?: string;
  authenticated: boolean;
  username?: string;
  action: 'none' | 'login' | 'install';
  status: 'ok' | 'warning' | 'info';
  message?: string;
}

interface OnboardingState {
  currentStep: OnboardingStep;

  // Step 1: Welcome & Prerequisites
  systemCheck: SystemCheckResult | null;

  // Step 2: GitHub Auth
  accessToken: string | null;
  githubUser: GitHubUser | null;

  // Step 3: Git Config
  gitConfigSynced: boolean;

  // Step 4: Repository Selection
  selectedRepos: Repository[];

  // Step 5: Clone
  clonePath: string | null;

  // Step 6: CLI Setup
  cliStatus: CLIStatus | null;
  cliConfigured: boolean;

  // Step 7: First Workspace
  workspaceId: string | null;

  // Navigation
  canGoBack: boolean;
  canSkip: boolean;
}

interface UnifiedOnboardingDialogProps {
  open: boolean;
  onComplete: (registeredRepoIds?: string[]) => void;
}

// ============================================================================
// Step Configuration
// ============================================================================

const STEPS: { id: OnboardingStep; label: string; required: boolean }[] = [
  { id: 'welcome', label: 'Welcome', required: true },
  { id: 'github-auth', label: 'GitHub', required: true },
  { id: 'git-config', label: 'Git Config', required: false },
  { id: 'repo-select', label: 'Repositories', required: true },
  { id: 'clone', label: 'Clone', required: true },
  { id: 'cli-setup', label: 'CLI', required: false },
  { id: 'first-workspace', label: 'Workspace', required: true },
  { id: 'success', label: 'Done', required: true },
];

// ============================================================================
// Main Component
// ============================================================================

export function UnifiedOnboardingDialog({ open, onComplete }: UnifiedOnboardingDialogProps) {
  const [state, setState] = useState<OnboardingState>({
    currentStep: 'welcome',
    systemCheck: null,
    accessToken: null,
    githubUser: null,
    gitConfigSynced: false,
    selectedRepos: [],
    clonePath: null,
    cliStatus: null,
    cliConfigured: false,
    workspaceId: null,
    canGoBack: false,
    canSkip: false,
  });

  const currentStepIndex = STEPS.findIndex(s => s.id === state.currentStep);
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100;

  // ============================================================================
  // Step Navigation Logic
  // ============================================================================

  const advanceToStep = (nextStep: OnboardingStep) => {
    setState(prev => ({
      ...prev,
      currentStep: nextStep,
      canGoBack: canGoBackFrom(nextStep),
      canSkip: canSkipFrom(nextStep),
    }));
  };

  const goBack = () => {
    const currentIndex = STEPS.findIndex(s => s.id === state.currentStep);
    if (currentIndex > 0) {
      const prevStep = STEPS[currentIndex - 1].id;
      advanceToStep(prevStep);
    }
  };

  const canGoBackFrom = (step: OnboardingStep): boolean => {
    // Cannot go back from welcome or during async operations
    return step !== 'welcome' && step !== 'clone' && step !== 'success';
  };

  const canSkipFrom = (step: OnboardingStep): boolean => {
    // Only optional steps can be skipped
    const stepConfig = STEPS.find(s => s.id === step);
    return stepConfig?.required === false;
  };

  // ============================================================================
  // Auto-Skip Logic (Smart Skip)
  // ============================================================================

  const shouldAutoSkip = (step: OnboardingStep): boolean => {
    switch (step) {
      case 'git-config':
        // Auto-skip if Git is already configured with matching GitHub email
        if (!state.systemCheck || !state.githubUser) return false;
        return (
          state.systemCheck.gitConfigured &&
          state.systemCheck.gitUserEmail === state.githubUser.email
        );

      case 'cli-setup':
        // Auto-skip if CLI is installed and authenticated
        if (!state.cliStatus) return false;
        return state.cliStatus.installed && state.cliStatus.authenticated;

      default:
        return false;
    }
  };

  // ============================================================================
  // Step Completion Handlers
  // ============================================================================

  const handleWelcomeComplete = (systemCheck: SystemCheckResult) => {
    setState(prev => ({
      ...prev,
      systemCheck,
    }));
    advanceToStep('github-auth');
  };

  const handleGitHubAuthComplete = (accessToken: string, user: GitHubUser) => {
    setState(prev => ({
      ...prev,
      accessToken,
      githubUser: user,
    }));

    // Check if we should auto-skip git-config
    const nextState = { ...state, githubUser: user };
    if (shouldAutoSkipGitConfig(nextState)) {
      advanceToStep('repo-select');
    } else {
      advanceToStep('git-config');
    }
  };

  const handleGitConfigComplete = () => {
    setState(prev => ({
      ...prev,
      gitConfigSynced: true,
    }));
    advanceToStep('repo-select');
  };

  const handleGitConfigSkip = () => {
    advanceToStep('repo-select');
  };

  const handleRepoSelectComplete = (repos: Repository[]) => {
    setState(prev => ({
      ...prev,
      selectedRepos: repos,
    }));
    advanceToStep('clone');
  };

  const handleCloneComplete = async (clonePath: string) => {
    setState(prev => ({
      ...prev,
      clonePath,
    }));

    // Check CLI status
    const cliStatus = await checkCLIStatus();
    setState(prev => ({
      ...prev,
      cliStatus,
    }));

    // Auto-skip CLI setup if already ready
    if (cliStatus.installed && cliStatus.authenticated) {
      advanceToStep('first-workspace');
    } else {
      advanceToStep('cli-setup');
    }
  };

  const handleCLISetupComplete = () => {
    setState(prev => ({
      ...prev,
      cliConfigured: true,
    }));
    advanceToStep('first-workspace');
  };

  const handleCLISetupSkip = () => {
    advanceToStep('first-workspace');
  };

  const handleFirstWorkspaceComplete = (workspaceId: string) => {
    setState(prev => ({
      ...prev,
      workspaceId,
    }));
    advanceToStep('success');
  };

  const handleSuccessComplete = async () => {
    console.log('[UnifiedOnboarding] Completing onboarding and registering repositories...');

    try {
      const ipcRenderer = window.electron.ipcRenderer;
      const registeredRepoIds: string[] = [];

      // Register each cloned repository to electron-store
      if (state.selectedRepos.length > 0 && state.clonePath) {
        for (const repo of state.selectedRepos) {
          const repoPath = `${state.clonePath}/${repo.name}`;
          console.log(`[UnifiedOnboarding] Registering repository: ${repo.name} at ${repoPath}`);

          const result = await ipcRenderer.invoke('repository:add', repoPath);

          if (result.success) {
            console.log(`[UnifiedOnboarding] ✅ Repository registered: ${repo.name}`);
            if (result.repository && result.repository.id) {
              registeredRepoIds.push(result.repository.id);
            }
          } else {
            console.error(`[UnifiedOnboarding] ❌ Failed to register repository: ${repo.name}`, result.error);
          }
        }
      }

      // Mark onboarding as complete in localStorage
      completeOnboarding();

      // NO RELOAD - smooth transition
      // Pass registered repo IDs to App so it can switch to the new repo
      console.log('[UnifiedOnboarding] Registered repository IDs:', registeredRepoIds);
      onComplete(registeredRepoIds);
    } catch (error) {
      console.error('[UnifiedOnboarding] Error registering repositories:', error);
      // Still complete onboarding even if registration fails
      completeOnboarding();
      onComplete();
    }
  };

  // ============================================================================
  // Helper Functions
  // ============================================================================

  const shouldAutoSkipGitConfig = (currentState: typeof state): boolean => {
    if (!currentState.systemCheck || !currentState.githubUser) return false;
    return (
      currentState.systemCheck.gitConfigured &&
      currentState.systemCheck.gitUserEmail === currentState.githubUser.email
    );
  };

  const checkCLIStatus = async (): Promise<CLIStatus> => {
    try {
      const ipcRenderer = window.electron.ipcRenderer;
      const result = await ipcRenderer.invoke('check-github-cli');

      if (!result.installed) {
        return {
          installed: false,
          authenticated: false,
          action: 'install',
          status: 'info',
          message: 'GitHub CLI is not installed',
        };
      }

      if (!result.authenticated) {
        return {
          installed: true,
          version: result.version,
          authenticated: false,
          action: 'login',
          status: 'warning',
          message: 'GitHub CLI needs authentication',
        };
      }

      return {
        installed: true,
        version: result.version,
        authenticated: true,
        username: result.username,
        action: 'none',
        status: 'ok',
        message: 'GitHub CLI is ready',
      };
    } catch (error) {
      console.error('[UnifiedOnboarding] Error checking CLI status:', error);
      return {
        installed: false,
        authenticated: false,
        action: 'install',
        status: 'info',
        message: 'Could not check GitHub CLI status',
      };
    }
  };

  const completeOnboarding = () => {
    const onboardingData = {
      version: 1,
      completedAt: Date.now(),
      githubUser: state.githubUser?.login,
      clonedRepos: state.selectedRepos.map(r => r.fullName),
      workspaceId: state.workspaceId,
    };
    localStorage.setItem('octave-onboarding', JSON.stringify(onboardingData));
  };

  // ============================================================================
  // Render
  // ============================================================================

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
                {state.currentStep === 'welcome' && "Let's get your development environment ready"}
                {state.currentStep === 'github-auth' && "Connect your GitHub account"}
                {state.currentStep === 'git-config' && "Sync your Git configuration"}
                {state.currentStep === 'repo-select' && "Choose repositories to work with"}
                {state.currentStep === 'clone' && "Cloning your repositories"}
                {state.currentStep === 'cli-setup' && "Optional: Set up GitHub CLI"}
                {state.currentStep === 'first-workspace' && "Create your first workspace"}
                {state.currentStep === 'success' && "You're all set!"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            {STEPS.map((step, index) => (
              <div
                key={step.id}
                className={`flex items-center gap-1 ${
                  index <= currentStepIndex ? 'text-foreground font-medium' : ''
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    index < currentStepIndex
                      ? 'bg-primary'
                      : index === currentStepIndex
                      ? 'bg-primary animate-pulse'
                      : 'bg-muted-foreground/30'
                  }`}
                />
                {step.label}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto py-6">
          {state.currentStep === 'welcome' && (
            <WelcomeStep onComplete={handleWelcomeComplete} />
          )}

          {state.currentStep === 'github-auth' && (
            <GitHubAuthStep onComplete={handleGitHubAuthComplete} />
          )}

          {state.currentStep === 'git-config' && state.githubUser && state.systemCheck && (
            <GitConfigSyncStep
              user={state.githubUser}
              currentGitName={state.systemCheck.gitUserName}
              currentGitEmail={state.systemCheck.gitUserEmail}
              onComplete={handleGitConfigComplete}
              onSkip={handleGitConfigSkip}
            />
          )}

          {state.currentStep === 'repo-select' && state.accessToken && (
            <GitHubRepoSelectStep
              accessToken={state.accessToken}
              onSelect={handleRepoSelectComplete}
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

          {state.currentStep === 'cli-setup' && state.cliStatus && (
            <CLISetupStep
              cliStatus={state.cliStatus}
              onComplete={handleCLISetupComplete}
              onSkip={handleCLISetupSkip}
            />
          )}

          {state.currentStep === 'first-workspace' && (
            <FirstWorkspaceStep
              clonedRepos={state.selectedRepos}
              clonePath={state.clonePath || ''}
              onComplete={handleFirstWorkspaceComplete}
            />
          )}

          {state.currentStep === 'success' && (
            <SuccessStep
              githubUser={state.githubUser}
              clonedRepos={state.selectedRepos}
              workspaceId={state.workspaceId}
              onComplete={handleSuccessComplete}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {state.canSkip && <span>Optional step - you can skip this</span>}
          </div>

          <div className="flex gap-2">
            {state.canGoBack && (
              <Button variant="outline" onClick={goBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
