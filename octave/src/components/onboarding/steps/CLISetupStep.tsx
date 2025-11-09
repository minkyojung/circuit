/**
 * CLISetupStep - GitHub CLI setup (optional)
 *
 * Three possible states:
 * 1. Perfect (installed + authenticated) → Skip this step
 * 2. Needs login (installed but not authenticated) → Offer login
 * 3. Not installed → Show installation guide
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle2, ExternalLink, Terminal } from 'lucide-react';

interface CLIStatus {
  installed: boolean;
  version?: string;
  authenticated: boolean;
  username?: string;
  action: 'none' | 'login' | 'install';
  status: 'ok' | 'warning' | 'info';
  message?: string;
}

interface CLISetupStepProps {
  cliStatus: CLIStatus;
  onComplete: () => void;
  onSkip: () => void;
}

export function CLISetupStep({ cliStatus, onComplete, onSkip }: CLISetupStepProps) {
  const [loggingIn, setLoggingIn] = useState(false);
  const [completed, setCompleted] = useState(cliStatus.action === 'none');
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoggingIn(true);
    setError(null);

    try {
      const ipcRenderer = window.electron.ipcRenderer;
      const result = await ipcRenderer.invoke('onboarding:run-cli-login');

      if (!result.success) {
        throw new Error(result.error || 'GitHub CLI login failed');
      }

      setCompleted(true);

      // Auto-advance after short delay
      setTimeout(() => {
        onComplete();
      }, 1500);

    } catch (err: any) {
      setError(err.message || 'Failed to authenticate GitHub CLI');
    } finally {
      setLoggingIn(false);
    }
  };

  // Already authenticated - auto skip
  if (cliStatus.action === 'none' && completed) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <CheckCircle2 className="h-16 w-16 text-green-600" />
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold">GitHub CLI Ready!</h3>
          <p className="text-sm text-muted-foreground">
            GitHub CLI is already installed and authenticated
          </p>
        </div>
        <Button onClick={onComplete} className="mt-4">
          Continue
        </Button>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <CheckCircle2 className="h-16 w-16 text-green-600 animate-in fade-in duration-500" />
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold">GitHub CLI Configured!</h3>
          <p className="text-sm text-muted-foreground">
            You can now use GitHub CLI for advanced operations
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">GitHub CLI Setup (Optional)</h3>
        <p className="text-sm text-muted-foreground">
          GitHub CLI enables advanced features like creating PRs and managing issues from the terminal
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Status Display */}
      <div className="rounded-lg border p-4 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-medium flex items-center gap-2">
              <Terminal className="h-4 w-4" />
              GitHub CLI Status
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {cliStatus.message || 'Unknown status'}
            </div>
          </div>
          <div>
            {cliStatus.status === 'ok' && (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            )}
            {cliStatus.status === 'warning' && (
              <AlertCircle className="h-5 w-5 text-yellow-600" />
            )}
            {cliStatus.status === 'info' && (
              <AlertCircle className="h-5 w-5 text-blue-600" />
            )}
          </div>
        </div>

        {cliStatus.installed && cliStatus.version && (
          <div className="text-xs text-muted-foreground">
            Version: {cliStatus.version}
          </div>
        )}
      </div>

      {/* Action based on status */}
      {cliStatus.action === 'install' && (
        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              GitHub CLI is not installed. You can install it later from Settings if needed.
            </AlertDescription>
          </Alert>

          <div className="rounded-lg border p-4 space-y-3">
            <div className="font-medium text-sm">To install GitHub CLI:</div>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div>1. Visit the GitHub CLI website</div>
              <div>2. Download the installer for macOS</div>
              <div>3. Run the installer and follow instructions</div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open('https://cli.github.com/', '_blank')}
              className="w-full"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Visit GitHub CLI Website
            </Button>
          </div>
        </div>
      )}

      {cliStatus.action === 'login' && (
        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              GitHub CLI is installed but needs authentication
            </AlertDescription>
          </Alert>

          <div className="rounded-lg border p-4 space-y-3">
            <div className="font-medium text-sm">Authentication Process:</div>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div>1. Click "Login to GitHub CLI" below</div>
              <div>2. Follow the prompts in the terminal</div>
              <div>3. Choose your preferred authentication method</div>
              <div>4. Complete the authentication flow</div>
            </div>
          </div>

          <Button
            onClick={handleLogin}
            disabled={loggingIn}
            className="w-full"
          >
            {loggingIn ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Authenticating...
              </>
            ) : (
              <>
                <Terminal className="w-4 h-4 mr-2" />
                Login to GitHub CLI
              </>
            )}
          </Button>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t">
        <Button
          variant="outline"
          onClick={onSkip}
          disabled={loggingIn}
          className="flex-1"
        >
          Skip for Now
        </Button>
        {cliStatus.action === 'install' && (
          <Button
            onClick={onSkip}
            disabled={loggingIn}
            className="flex-1"
          >
            Continue
          </Button>
        )}
      </div>

      <p className="text-xs text-center text-muted-foreground">
        You can always set up GitHub CLI later in Settings
      </p>
    </div>
  );
}
