/**
 * SystemCheckStep - Verify system requirements
 *
 * Checks:
 * - macOS version
 * - Claude Code CLI authentication
 * - Git configuration
 * - GitHub authentication (optional)
 * - Node.js (optional)
 */

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { CheckCircle2, XCircle, Loader2, AlertCircle, ExternalLink, Copy, Check } from 'lucide-react';
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
  const [checkingStep, setCheckingStep] = useState<string>('');

  // Git config form state
  const [gitName, setGitName] = useState('');
  const [gitEmail, setGitEmail] = useState('');
  const [configuringGit, setConfiguringGit] = useState(false);

  // SSH setup state
  const [sshPublicKey, setSshPublicKey] = useState<string | null>(null);
  const [generatingSSH, setGeneratingSSH] = useState(false);
  const [testingSSH, setTestingSSH] = useState(false);
  const [sshCopied, setSshCopied] = useState(false);

  useEffect(() => {
    if (!result && !checking) {
      runCheck();
    }
  }, []);

  const runCheck = async () => {
    setChecking(true);
    setError(null);

    try {
      setCheckingStep('Checking system requirements...');
      const checkResult = await runSystemCheck();
      setResult(checkResult);
      setCheckingStep('');

      // Pre-fill git config if available
      if (checkResult.gitUserName) setGitName(checkResult.gitUserName);
      if (checkResult.gitUserEmail) setGitEmail(checkResult.gitUserEmail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'System check failed');
    } finally {
      setChecking(false);
    }
  };

  const handleConfigureGit = async () => {
    if (!gitName || !gitEmail) return;

    setConfiguringGit(true);
    try {
      const ipcRenderer = window.electron.ipcRenderer;
      const configResult = await ipcRenderer.invoke('git:configure', { name: gitName, email: gitEmail });

      if (configResult.success) {
        // Re-run check to update status
        await runCheck();
      } else {
        setError(configResult.error || 'Failed to configure Git');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to configure Git');
    } finally {
      setConfiguringGit(false);
    }
  };

  const handleGenerateSSHKey = async () => {
    if (!gitEmail) {
      setError('Please configure Git with your email first');
      return;
    }

    setGeneratingSSH(true);
    try {
      const ipcRenderer = window.electron.ipcRenderer;
      const sshResult = await ipcRenderer.invoke('github:generate-ssh-key', gitEmail);

      if (sshResult.success && sshResult.publicKey) {
        setSshPublicKey(sshResult.publicKey);
      } else {
        setError(sshResult.error || 'Failed to generate SSH key');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate SSH key');
    } finally {
      setGeneratingSSH(false);
    }
  };

  const handleCopySSHKey = async () => {
    if (!sshPublicKey) return;

    try {
      await navigator.clipboard.writeText(sshPublicKey);
      setSshCopied(true);
      setTimeout(() => setSshCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy SSH key:', err);
    }
  };

  const handleTestSSHConnection = async () => {
    setTestingSSH(true);
    try {
      const ipcRenderer = window.electron.ipcRenderer;
      const testResult = await ipcRenderer.invoke('github:test-ssh');

      if (testResult.authenticated) {
        // Re-run check to update GitHub status
        await runCheck();
        setSshPublicKey(null); // Clear SSH setup UI
      } else {
        setError(testResult.error || 'SSH key not recognized by GitHub. Make sure you added it to your GitHub account.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to test SSH connection');
    } finally {
      setTestingSSH(false);
    }
  };

  const handleOpenClaudeApp = async () => {
    try {
      const ipcRenderer = window.electron.ipcRenderer;
      await ipcRenderer.invoke('claude:open-app');
      // Wait a bit for user to log in, then re-check
      setTimeout(() => runCheck(), 3000);
    } catch (err) {
      console.error('Failed to open Claude app:', err);
    }
  };

  const handleContinue = () => {
    if (result) {
      onComplete(result);
    }
  };

  // Required: Claude Code authenticated + Git configured
  // Optional: GitHub (warning only)
  const canContinue = result
    && result.claudeCodeInstalled
    && result.claudeCodeAuthenticated
    && result.gitInstalled
    && result.gitConfigured;

  if (checking) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground font-medium">Checking system requirements...</p>
        {checkingStep && (
          <p className="text-sm text-muted-foreground/80 animate-pulse">{checkingStep}</p>
        )}
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
          Octave needs a few tools to work properly. Let's set everything up.
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
          label="Claude Code"
          passed={result.claudeCodeAuthenticated}
          detail={
            result.claudeCodeAuthenticated
              ? `Authenticated${result.claudeCodeSubscription ? ` (${result.claudeCodeSubscription})` : ''}`
              : result.claudeCodeInstalled
              ? 'Installed but not authenticated'
              : undefined
          }
          required={true}
          helpText={
            !result.claudeCodeInstalled ? (
              <div className="mt-2 space-y-2">
                <p className="text-sm text-muted-foreground">
                  Octave uses Claude Code for AI-powered features.
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
            ) : !result.claudeCodeAuthenticated ? (
              <div className="mt-2 space-y-2">
                <p className="text-sm text-muted-foreground">
                  {result.claudeCodeError || 'Please log in to Claude Code desktop app'}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenClaudeApp}
                  className="w-full"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Claude App to Login
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={runCheck}
                  className="w-full"
                >
                  I've logged in - Check Again
                </Button>
              </div>
            ) : undefined
          }
        />

        {/* Git Configuration */}
        <CheckItem
          label="Git Configuration"
          passed={result.gitConfigured}
          detail={
            result.gitConfigured
              ? `${result.gitUserName} <${result.gitUserEmail}>`
              : result.gitInstalled
              ? 'Not configured'
              : 'Not installed'
          }
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
            ) : !result.gitConfigured ? (
              <div className="mt-2 space-y-2">
                <p className="text-sm text-muted-foreground mb-2">
                  Configure your Git identity for commits
                </p>
                <div className="space-y-2">
                  <Input
                    placeholder="Your Name"
                    value={gitName}
                    onChange={(e) => setGitName(e.target.value)}
                  />
                  <Input
                    placeholder="your@email.com"
                    type="email"
                    value={gitEmail}
                    onChange={(e) => setGitEmail(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleConfigureGit}
                    disabled={!gitName || !gitEmail || configuringGit}
                    className="w-full"
                  >
                    {configuringGit ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Configuring...
                      </>
                    ) : (
                      'Auto-Configure Git'
                    )}
                  </Button>
                </div>
              </div>
            ) : undefined
          }
        />

        {/* GitHub Authentication */}
        <CheckItem
          label="GitHub"
          passed={result.githubAuthenticated}
          detail={
            result.githubAuthenticated
              ? `Connected via ${result.githubMethod}${result.githubUsername ? ` as ${result.githubUsername}` : ''}`
              : 'Not connected'
          }
          required={false}
          helpText={
            !result.githubAuthenticated ? (
              <div className="mt-2 space-y-2">
                <p className="text-sm text-muted-foreground">
                  Optional - Needed for creating pull requests and managing issues
                </p>
                {!sshPublicKey ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateSSHKey}
                    disabled={!gitEmail || generatingSSH}
                    className="w-full"
                  >
                    {generatingSSH ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      'Generate SSH Key'
                    )}
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-medium">Your SSH Public Key:</p>
                    <div className="relative">
                      <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                        {sshPublicKey}
                      </pre>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCopySSHKey}
                        className="absolute top-1 right-1"
                      >
                        {sshCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      1. Copy the key above
                      <br />
                      2. Add it to GitHub Settings → SSH Keys
                      <br />
                      3. Test the connection
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open('https://github.com/settings/ssh/new', '_blank')}
                      className="w-full"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Add to GitHub
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleTestSSHConnection}
                      disabled={testingSSH}
                      className="w-full"
                    >
                      {testingSSH ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        'Test Connection'
                      )}
                    </Button>
                  </div>
                )}
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
                Optional - Only needed for MCP servers
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
              Please complete the required setup steps above to continue.
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
