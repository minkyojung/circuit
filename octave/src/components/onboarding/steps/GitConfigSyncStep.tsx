/**
 * GitConfigSyncStep - Sync Git config with GitHub account
 *
 * Optional step to set global Git user.name and user.email
 * from GitHub account information
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Loader2, AlertCircle, CheckCircle2, User, Mail } from 'lucide-react';

interface GitHubUser {
  login: string;
  name: string;
  email: string;
  avatar_url: string;
}

interface GitConfigSyncStepProps {
  user: GitHubUser;
  currentGitName?: string;
  currentGitEmail?: string;
  onComplete: () => void;
  onSkip: () => void;
}

export function GitConfigSyncStep({ user, currentGitName, currentGitEmail, onComplete, onSkip }: GitConfigSyncStepProps) {
  const [name, setName] = useState(user.name || user.login);
  const [email, setEmail] = useState(user.email);
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasCurrentConfig = currentGitName || currentGitEmail;
  const isDifferent = currentGitName !== (user.name || user.login) || currentGitEmail !== user.email;

  const handleSync = async () => {
    if (!name || !email) {
      setError('Name and email are required');
      return;
    }

    setSyncing(true);
    setError(null);

    try {
      const ipcRenderer = window.electron.ipcRenderer;
      const result = await ipcRenderer.invoke('onboarding:set-git-config', { name, email });

      if (!result.success) {
        throw new Error(result.error || 'Failed to set Git config');
      }

      setSynced(true);

      // Auto-advance after short delay
      setTimeout(() => {
        onComplete();
      }, 1500);

    } catch (err: any) {
      setError(err.message || 'Failed to set Git config');
    } finally {
      setSyncing(false);
    }
  };

  if (synced) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <CheckCircle2 className="h-16 w-16 text-green-600 animate-in fade-in duration-500" />
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold">Git Config Updated!</h3>
          <p className="text-sm text-muted-foreground">
            Your global Git config has been synced with your GitHub account
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Sync Git Configuration</h3>
        <p className="text-sm text-muted-foreground">
          {hasCurrentConfig && isDifferent
            ? 'Your current Git config differs from your GitHub account'
            : 'Set your global Git identity to match your GitHub account'}
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Show current config if it exists */}
      {hasCurrentConfig && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <div className="font-medium">Current Git Config:</div>
              <div className="font-mono text-xs space-y-0.5">
                {currentGitName && <div>user.name = {currentGitName}</div>}
                {currentGitEmail && <div>user.email = {currentGitEmail}</div>}
                {!currentGitName && <div className="text-muted-foreground">user.name = (not set)</div>}
                {!currentGitEmail && <div className="text-muted-foreground">user.email = (not set)</div>}
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          This will {hasCurrentConfig ? 'update' : 'set'} your global Git config using <code className="text-xs bg-muted px-1 py-0.5 rounded">git config --global</code>
        </AlertDescription>
      </Alert>

      {/* Form */}
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <User className="h-4 w-4" />
            Name
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your Name"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email
          </label>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            type="email"
          />
        </div>
      </div>

      {/* Preview */}
      <div className="rounded-lg border p-4 bg-muted/30 space-y-2">
        <div className="text-sm font-medium">Git Config Preview:</div>
        <div className="font-mono text-xs space-y-1">
          <div>user.name = {name}</div>
          <div>user.email = {email}</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <Button
          variant="outline"
          onClick={onSkip}
          disabled={syncing}
          className="flex-1"
        >
          Skip
        </Button>
        <Button
          onClick={handleSync}
          disabled={!name || !email || syncing}
          className="flex-1"
        >
          {syncing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Syncing...
            </>
          ) : (
            'Sync Git Config'
          )}
        </Button>
      </div>
    </div>
  );
}
