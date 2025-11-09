/**
 * GitHubAuthStep - GitHub OAuth authentication
 *
 * Uses GitHub OAuth to authenticate the user
 * This is a MANDATORY step
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Github, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

interface GitHubUser {
  login: string;
  name: string;
  email: string;
  avatar_url: string;
}

interface GitHubAuthStepProps {
  onComplete: (accessToken: string, user: GitHubUser) => void;
}

export function GitHubAuthStep({ onComplete }: GitHubAuthStepProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<GitHubUser | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);

    try {
      const ipcRenderer = window.electron.ipcRenderer;

      // Start OAuth flow
      const authResult = await ipcRenderer.invoke('github:oauth:start');

      if (!authResult.success) {
        throw new Error(authResult.error || 'Authentication failed');
      }

      const accessToken = authResult.accessToken;

      // Fetch user info
      const userResult = await ipcRenderer.invoke('github:oauth:fetch-user');

      if (!userResult.success) {
        throw new Error(userResult.error || 'Failed to fetch user info');
      }

      setUser(userResult.user);

      // Auto-advance after short delay to show success
      setTimeout(() => {
        onComplete(accessToken, userResult.user);
      }, 1500);

    } catch (err: any) {
      setError(err.message || 'Authentication failed');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h3 className="text-lg font-semibold">Connect GitHub Account</h3>
        <p className="text-sm text-muted-foreground">
          Octave requires GitHub authentication to access your repositories
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!user ? (
        <div className="flex flex-col items-center justify-center py-8 space-y-4">
          <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center">
            <Github className="w-12 h-12 text-muted-foreground" />
          </div>

          <Button
            onClick={handleLogin}
            disabled={loading}
            size="lg"
            className="w-full max-w-sm"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Authenticating...
              </>
            ) : (
              <>
                <Github className="w-5 h-5 mr-2" />
                Login with GitHub
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center max-w-md">
            We'll open GitHub in a new window. After granting access,
            you'll be automatically redirected back to Octave.
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 space-y-4">
          <CheckCircle2 className="w-16 h-16 text-green-600 animate-in fade-in duration-500" />

          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-3">
              <img
                src={user.avatar_url}
                alt={user.name}
                className="w-12 h-12 rounded-full"
              />
              <div className="text-left">
                <div className="font-semibold">{user.name}</div>
                <div className="text-sm text-muted-foreground">@{user.login}</div>
              </div>
            </div>
            <p className="text-sm text-green-600">Successfully authenticated!</p>
          </div>
        </div>
      )}

      <div className="bg-muted/30 rounded-lg p-4 space-y-2">
        <h4 className="font-medium text-sm">What we'll access:</h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">•</span>
            <span>Your public and private repositories</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-0.5">•</span>
            <span>Your profile information (name, email, avatar)</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
