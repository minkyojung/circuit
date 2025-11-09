/**
 * GitHubSection - GitHub OAuth and repository management
 */

import React, { useState, useEffect } from 'react';
import { SettingsItem, SettingsGroup } from '../SettingsItem';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Github, LogOut, RefreshCw } from 'lucide-react';

interface GitHubUser {
  login: string;
  name: string;
  avatar_url: string;
  email: string;
}

interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  description: string;
  private: boolean;
  stars: number;
  language: string;
  htmlUrl: string;
}

export const GitHubSection: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if already authenticated on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const result = await window.electron.ipcRenderer.invoke('github:oauth:get-token');
      if (result.success && result.accessToken) {
        setIsAuthenticated(true);
        fetchUserData();
      }
    } catch (err) {
      console.error('Failed to check auth status:', err);
    }
  };

  const fetchUserData = async () => {
    try {
      const result = await window.electron.ipcRenderer.invoke('github:oauth:fetch-user');
      if (result.success) {
        setUser(result.user);
      }
    } catch (err) {
      console.error('Failed to fetch user data:', err);
    }
  };

  const handleLogin = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await window.electron.ipcRenderer.invoke('github:oauth:start');

      if (result.success) {
        setIsAuthenticated(true);
        await fetchUserData();
      } else {
        setError(result.error || 'Authentication failed');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await window.electron.ipcRenderer.invoke('github:oauth:logout');
      setIsAuthenticated(false);
      setUser(null);
      setRepos([]);
    } catch (err) {
      console.error('Failed to logout:', err);
    }
  };

  const handleFetchRepos = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await window.electron.ipcRenderer.invoke('github:oauth:fetch-repos');

      if (result.success) {
        setRepos(result.repos);
      } else {
        setError(result.error || 'Failed to fetch repositories');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch repositories');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Authentication */}
      <SettingsGroup title="GitHub Authentication">
        <SettingsItem
          type="custom"
          title="Account Status"
          description={
            isAuthenticated
              ? `Logged in as ${user?.login || 'GitHub user'}`
              : 'Connect your GitHub account to access repositories'
          }
        >
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                <Badge variant="default" className="bg-green-600">
                  Connected
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleLogout}
                  disabled={isLoading}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={handleLogin}
                disabled={isLoading}
              >
                <Github className="w-4 h-4 mr-2" />
                {isLoading ? 'Connecting...' : 'Login with GitHub'}
              </Button>
            )}
          </div>
        </SettingsItem>

        {user && (
          <SettingsItem
            type="custom"
            title="User Info"
            description={user.email || 'No email provided'}
          >
            <div className="flex items-center gap-3">
              <img
                src={user.avatar_url}
                alt={user.name}
                className="w-10 h-10 rounded-full"
              />
              <div>
                <div className="font-medium">{user.name}</div>
                <div className="text-sm text-muted-foreground">@{user.login}</div>
              </div>
            </div>
          </SettingsItem>
        )}

        {error && (
          <div className="text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}
      </SettingsGroup>

      {/* Repositories */}
      {isAuthenticated && (
        <SettingsGroup title="Repositories">
          <SettingsItem
            type="custom"
            title="Your Repositories"
            description={`${repos.length} repositories loaded`}
          >
            <Button
              size="sm"
              variant="outline"
              onClick={handleFetchRepos}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Loading...' : 'Fetch Repositories'}
            </Button>
          </SettingsItem>

          {repos.length > 0 && (
            <div className="mt-4 space-y-2">
              {repos.slice(0, 5).map((repo) => (
                <div
                  key={repo.id}
                  className="p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{repo.fullName}</div>
                      {repo.description && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {repo.description}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        {repo.language && (
                          <Badge variant="secondary" className="text-xs">
                            {repo.language}
                          </Badge>
                        )}
                        {repo.private && (
                          <Badge variant="outline" className="text-xs">
                            Private
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          ⭐ {repo.stars}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {repos.length > 5 && (
                <div className="text-sm text-muted-foreground text-center">
                  And {repos.length - 5} more...
                </div>
              )}
            </div>
          )}
        </SettingsGroup>
      )}
    </div>
  );
};
