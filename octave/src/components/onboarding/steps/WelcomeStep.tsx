/**
 * WelcomeStep - System Prerequisites Check
 *
 * Validates system requirements before proceeding:
 * - macOS version (informational)
 * - Git installation (REQUIRED - blocker)
 * - Claude Code installation (optional - warning only)
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, AlertCircle, Loader2, ExternalLink } from 'lucide-react';

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

interface WelcomeStepProps {
  onComplete: (systemCheck: SystemCheckResult) => void;
}

export function WelcomeStep({ onComplete }: WelcomeStepProps) {
  const [checking, setChecking] = useState(true);
  const [systemCheck, setSystemCheck] = useState<SystemCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkSystem();
  }, []);

  const checkSystem = async () => {
    setChecking(true);
    setError(null);

    try {
      const ipcRenderer = window.electron.ipcRenderer;

      // Get macOS version
      const macOSVersion = await ipcRenderer.invoke('get-macos-version');

      // Check Git
      const gitResult = await ipcRenderer.invoke('check-git-config');
      const gitInstalled = gitResult.success && gitResult.config?.installed;
      const gitVersion = gitResult.config?.version;
      const gitConfigured = gitResult.config?.configured || false;
      const gitUserName = gitResult.config?.userName;
      const gitUserEmail = gitResult.config?.userEmail;

      // Check Claude Code
      const claudeResult = await ipcRenderer.invoke('check-claude-auth');
      const claudeCodeInstalled = claudeResult.success && claudeResult.auth?.installed;
      const claudeCodeVersion = claudeResult.auth?.version;

      const result: SystemCheckResult = {
        macOSVersion,
        gitInstalled,
        gitVersion,
        gitConfigured,
        gitUserName,
        gitUserEmail,
        claudeCodeInstalled,
        claudeCodeVersion,
      };

      setSystemCheck(result);
    } catch (err: any) {
      console.error('[WelcomeStep] Error checking system:', err);
      setError(err.message || 'Failed to check system requirements');
    } finally {
      setChecking(false);
    }
  };

  const handleContinue = () => {
    if (systemCheck) {
      onComplete(systemCheck);
    }
  };

  const canContinue = systemCheck?.gitInstalled === true;

  return (
    <div className="space-y-6">
      {/* Welcome Message */}
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold">Welcome to Octave</h2>
        <p className="text-lg text-muted-foreground">
          Your AI-powered development workspace
        </p>
      </div>

      {/* System Check Results */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b">
          <h3 className="text-lg font-semibold">System Check</h3>
          {checking && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        {/* macOS Version */}
        <div className="flex items-start gap-3 p-3 rounded-lg border">
          <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
          <div className="flex-1">
            <div className="font-medium">macOS</div>
            <div className="text-sm text-muted-foreground">
              {checking ? 'Checking...' : systemCheck?.macOSVersion || 'Unknown'}
            </div>
          </div>
        </div>

        {/* Git Check */}
        {!checking && systemCheck && (
          <div className={`flex items-start gap-3 p-3 rounded-lg border ${
            systemCheck.gitInstalled ? 'border-green-200 bg-green-50 dark:bg-green-950/20' : 'border-red-200 bg-red-50 dark:bg-red-950/20'
          }`}>
            {systemCheck.gitInstalled ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
            )}
            <div className="flex-1">
              <div className="font-medium">Git</div>
              <div className="text-sm text-muted-foreground">
                {systemCheck.gitInstalled
                  ? `Installed (${systemCheck.gitVersion})`
                  : 'Not installed - Required to continue'}
              </div>
              {systemCheck.gitInstalled && systemCheck.gitConfigured && (
                <div className="text-xs text-muted-foreground mt-1">
                  Configured as {systemCheck.gitUserName} ({systemCheck.gitUserEmail})
                </div>
              )}
            </div>
          </div>
        )}

        {/* Git Installation Guide (if not installed) */}
        {!checking && systemCheck && !systemCheck.gitInstalled && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">Git is required to use Octave</p>
                <p className="text-sm">
                  Install Git using Homebrew or download from git-scm.com
                </p>
                <div className="flex gap-2 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open('https://git-scm.com/download/mac', '_blank')}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Download Git
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={checkSystem}
                  >
                    Recheck
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Claude Code Check */}
        {!checking && systemCheck && (
          <div className={`flex items-start gap-3 p-3 rounded-lg border ${
            systemCheck.claudeCodeInstalled ? 'border-green-200 bg-green-50 dark:bg-green-950/20' : 'border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20'
          }`}>
            {systemCheck.claudeCodeInstalled ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
            )}
            <div className="flex-1">
              <div className="font-medium">Claude Code</div>
              <div className="text-sm text-muted-foreground">
                {systemCheck.claudeCodeInstalled
                  ? `Installed (${systemCheck.claudeCodeVersion})`
                  : 'Not detected - Recommended but optional'}
              </div>
              {!systemCheck.claudeCodeInstalled && (
                <div className="text-xs text-muted-foreground mt-1">
                  You can install Claude Code later from Settings
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Continue Button */}
      <div className="flex justify-end pt-4">
        <Button
          onClick={handleContinue}
          disabled={!canContinue || checking}
          size="lg"
          className="min-w-[200px]"
        >
          {checking ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Checking...
            </>
          ) : (
            'Continue Setup'
          )}
        </Button>
      </div>

      {/* Info Footer */}
      <div className="text-center text-xs text-muted-foreground pt-4 border-t">
        Octave requires Git for version control and GitHub for code hosting
      </div>
    </div>
  );
}
