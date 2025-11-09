/**
 * GitHubEnvCheckStep - Check environment requirements
 *
 * Checks:
 * - Git installation and version
 * - Git configuration (user.name, user.email)
 * - GitHub CLI (optional, but shows status)
 */

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, Loader2, AlertCircle, AlertTriangle } from 'lucide-react';

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

interface GitHubEnvCheckStepProps {
  onComplete: (environment: EnvironmentStatus) => void;
  environment: EnvironmentStatus | null;
}

export function GitHubEnvCheckStep({ onComplete, environment: initialEnv }: GitHubEnvCheckStepProps) {
  const [checking, setChecking] = useState(false);
  const [environment, setEnvironment] = useState<EnvironmentStatus | null>(initialEnv);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!environment && !checking) {
      runCheck();
    }
  }, []);

  const runCheck = async () => {
    setChecking(true);
    setError(null);

    try {
      const ipcRenderer = window.electron.ipcRenderer;
      const result = await ipcRenderer.invoke('onboarding:check-environment');

      if (!result.success) {
        throw new Error(result.error || 'Environment check failed');
      }

      setEnvironment(result.environment);
    } catch (err: any) {
      setError(err.message || 'Environment check failed');
    } finally {
      setChecking(false);
    }
  };

  const handleContinue = () => {
    if (environment) {
      onComplete(environment);
    }
  };

  // Can continue if Git is installed and configured
  const canContinue = environment &&
    environment.git.installed &&
    environment.git.status === 'ok' &&
    environment.gitConfig.configured;

  if (checking) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground font-medium">Checking your environment...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={runCheck} className="w-full">
          Try Again
        </Button>
      </div>
    );
  }

  if (!environment) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Environment Check</h3>
        <p className="text-sm text-muted-foreground">
          Let's make sure everything is set up correctly
        </p>
      </div>

      <div className="space-y-3">
        {/* Git Installation */}
        <CheckItem
          label="Git"
          passed={environment.git.installed && environment.git.status === 'ok'}
          detail={environment.git.version}
          required={true}
          helpText={
            !environment.git.installed ? (
              <p className="text-sm text-muted-foreground mt-2">
                Git is required. Please install Git and restart Octave.
              </p>
            ) : undefined
          }
        />

        {/* Git Configuration */}
        <CheckItem
          label="Git Configuration"
          passed={environment.gitConfig.configured}
          detail={
            environment.gitConfig.configured
              ? `${environment.gitConfig.name} <${environment.gitConfig.email}>`
              : environment.gitConfig.message
          }
          required={true}
          helpText={
            !environment.gitConfig.configured ? (
              <p className="text-sm text-muted-foreground mt-2">
                Git config will be set automatically from your GitHub account in a later step
              </p>
            ) : undefined
          }
        />

        {/* GitHub CLI */}
        <CheckItem
          label="GitHub CLI"
          passed={environment.cli.action === 'none'}
          detail={
            environment.cli.installed
              ? environment.cli.authenticated
                ? `Authenticated as ${environment.cli.username || 'user'}`
                : `Installed (${environment.cli.version}) but not authenticated`
              : environment.cli.message
          }
          required={false}
          helpText={
            environment.cli.action !== 'none' ? (
              <div className="mt-2 space-y-2">
                {environment.cli.action === 'install' ? (
                  <p className="text-sm text-muted-foreground">
                    GitHub CLI is optional. You can set it up later in settings.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    CLI is installed but not authenticated. You can set it up later.
                  </p>
                )}
              </div>
            ) : undefined
          }
        />
      </div>

      {/* Warnings */}
      {!environment.gitConfig.configured && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Git is not configured yet. Don't worry - we'll sync your Git config with your GitHub account after selecting repositories.
          </AlertDescription>
        </Alert>
      )}

      {/* Continue Button */}
      <div className="pt-4">
        {canContinue ? (
          <Button onClick={handleContinue} className="w-full" size="lg">
            Continue
          </Button>
        ) : (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Git must be installed to continue. Please install Git and click "Check Again".
            </AlertDescription>
          </Alert>
        )}

        {!canContinue && (
          <Button onClick={runCheck} variant="outline" className="w-full mt-2">
            Check Again
          </Button>
        )}
      </div>
    </div>
  );
}

interface CheckItemProps {
  label: string;
  passed: boolean;
  detail?: string;
  required?: boolean;
  helpText?: React.ReactNode;
}

function CheckItem({ label, passed, detail, required = false, helpText }: CheckItemProps) {
  return (
    <div className="rounded-lg border p-4 space-y-2">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{label}</span>
            {required && !passed && (
              <span className="text-xs text-destructive font-medium">Required</span>
            )}
            {!required && (
              <span className="text-xs text-muted-foreground">Optional</span>
            )}
          </div>
          {detail && (
            <p className="text-sm text-muted-foreground mt-1">{detail}</p>
          )}
        </div>
        <div>
          {passed ? (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          ) : required ? (
            <XCircle className="h-5 w-5 text-destructive" />
          ) : (
            <AlertCircle className="h-5 w-5 text-yellow-600" />
          )}
        </div>
      </div>
      {helpText && <div>{helpText}</div>}
    </div>
  );
}
