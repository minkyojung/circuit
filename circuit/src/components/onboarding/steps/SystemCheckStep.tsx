/**
 * SystemCheckStep - Verify system requirements
 *
 * Checks:
 * - macOS version
 * - Claude Code CLI
 * - Git
 * - Node.js (optional)
 */

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import type { SystemCheckResult } from '@/types/onboarding';
import { runSystemCheck } from '@/lib/onboarding';

interface SystemCheckStepProps {
  onComplete: (result: SystemCheckResult) => void;
  systemCheck: SystemCheckResult | null;
}

export function SystemCheckStep({ onComplete, systemCheck: initialCheck }: SystemCheckStepProps) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<SystemCheckResult | null>(initialCheck);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!result && !checking) {
      runCheck();
    }
  }, []);

  const runCheck = async () => {
    setChecking(true);
    setError(null);

    try {
      const checkResult = await runSystemCheck();
      setResult(checkResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'System check failed');
    } finally {
      setChecking(false);
    }
  };

  const handleContinue = () => {
    if (result) {
      onComplete(result);
    }
  };

  const canContinue = result && result.claudeCodeInstalled && result.gitInstalled;

  if (checking) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Checking system requirements...</p>
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

  if (!result) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">System Requirements</h3>
        <p className="text-sm text-muted-foreground">
          Circuit needs a few tools to work properly. Let's make sure everything is installed.
        </p>
      </div>

      {/* Check Results */}
      <div className="space-y-3">
        {/* macOS */}
        <CheckItem
          label="macOS"
          passed={true}
          detail={result.macOSVersion}
        />

        {/* Claude Code */}
        <CheckItem
          label="Claude Code CLI"
          passed={result.claudeCodeInstalled}
          detail={result.claudeCodeVersion}
          required={true}
          helpText={
            !result.claudeCodeInstalled ? (
              <div className="mt-2 space-y-2">
                <p className="text-sm text-muted-foreground">
                  Circuit uses Claude Code CLI for AI features.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open('https://claude.ai/download', '_blank')}
                  className="w-full"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Download Claude Code
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={runCheck}
                  className="w-full"
                >
                  I've installed it - Check Again
                </Button>
              </div>
            ) : undefined
          }
        />

        {/* Git */}
        <CheckItem
          label="Git"
          passed={result.gitInstalled}
          detail={result.gitVersion}
          required={true}
          helpText={
            !result.gitInstalled ? (
              <div className="mt-2 space-y-2">
                <p className="text-sm text-muted-foreground">
                  Git is required for workspace management.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open('https://git-scm.com/download/mac', '_blank')}
                  className="w-full"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Install Git
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={runCheck}
                  className="w-full"
                >
                  I've installed it - Check Again
                </Button>
              </div>
            ) : undefined
          }
        />

        {/* Node.js (optional) */}
        <CheckItem
          label="Node.js"
          passed={result.nodeInstalled}
          detail={result.nodeVersion}
          required={false}
          helpText={
            !result.nodeInstalled ? (
              <p className="text-xs text-muted-foreground mt-1">
                Optional - Only needed if you want to use MCP servers
              </p>
            ) : undefined
          }
        />
      </div>

      {/* Continue Button */}
      <div className="pt-4">
        {canContinue ? (
          <Button onClick={handleContinue} className="w-full" size="lg">
            Continue
          </Button>
        ) : (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please install the required tools above to continue.
            </AlertDescription>
          </Alert>
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
          ) : (
            <XCircle className="h-5 w-5 text-destructive" />
          )}
        </div>
      </div>
      {helpText && <div>{helpText}</div>}
    </div>
  );
}
