/**
 * OnboardingDialog - First-time user onboarding flow
 *
 * Guides users through:
 * 1. System Check (Claude Code, Git)
 * 2. Repository Selection
 * 3. First Workspace Creation
 */

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { X } from 'lucide-react';
import type { OnboardingStep, OnboardingState, SystemCheckResult, RepositoryInfo } from '@/types/onboarding';
import { completeOnboarding, skipOnboarding } from '@/lib/onboarding';

// Import step components
import { SystemCheckStep } from './steps/SystemCheckStep';
import { RepositoryStep } from './steps/RepositoryStep';
import { CompleteStep } from './steps/CompleteStep';

interface OnboardingDialogProps {
  open: boolean;
  onComplete: (repository?: string, workspaceId?: string) => void;
  onSkip: () => void;
}

const STEPS: { id: OnboardingStep; label: string }[] = [
  { id: 'system-check', label: 'System Check' },
  { id: 'repository', label: 'Repository' },
  { id: 'complete', label: 'Complete' },
];

export function OnboardingDialog({ open, onComplete, onSkip }: OnboardingDialogProps) {
  const [state, setState] = useState<OnboardingState>({
    currentStep: 'system-check',
    systemCheck: null,
    repository: null,
    workspaceId: null,
    skipped: false,
  });

  const currentStepIndex = STEPS.findIndex(s => s.id === state.currentStep);
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100;

  const handleSystemCheckComplete = (result: SystemCheckResult) => {
    setState(prev => ({
      ...prev,
      systemCheck: result,
      currentStep: 'repository',
    }));
  };

  const handleRepositorySelect = async (repo: RepositoryInfo) => {
    setState(prev => ({
      ...prev,
      repository: repo,
    }));

    // Auto-create first workspace
    try {
      const ipcRenderer = window.electron.ipcRenderer;
      const result = await ipcRenderer.invoke('workspace:create', repo.path);

      if (result.success && result.workspace) {
        setState(prev => ({
          ...prev,
          workspaceId: result.workspace.id,
          currentStep: 'complete',
        }));
      } else {
        console.error('Failed to create workspace:', result.error);
        // TODO: Show error message
      }
    } catch (error) {
      console.error('Failed to create workspace:', error);
      // TODO: Show error message
    }
  };

  const handleComplete = () => {
    completeOnboarding(state.repository?.path);
    onComplete(state.repository?.path, state.workspaceId || undefined);
  };

  const handleSkip = () => {
    skipOnboarding();
    onSkip();
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

  const canGoBack = currentStepIndex > 0 && state.currentStep !== 'complete';

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Header */}
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl font-bold">Welcome to Circuit</DialogTitle>
              <DialogDescription className="mt-1">
                Let's get you set up in just a few steps
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSkip}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
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
          {state.currentStep === 'system-check' && (
            <SystemCheckStep
              onComplete={handleSystemCheckComplete}
              systemCheck={state.systemCheck}
            />
          )}

          {state.currentStep === 'repository' && (
            <RepositoryStep
              onSelect={handleRepositorySelect}
              selectedRepository={state.repository}
            />
          )}

          {state.currentStep === 'complete' && (
            <CompleteStep
              repository={state.repository}
              workspaceId={state.workspaceId}
              onComplete={handleComplete}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="ghost"
            onClick={handleSkip}
            className="text-muted-foreground"
          >
            Skip Setup
          </Button>

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
