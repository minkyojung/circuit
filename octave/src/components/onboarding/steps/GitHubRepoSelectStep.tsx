/**
 * GitHubRepoSelectStep - Select repositories to clone
 *
 * Fetches user's GitHub repositories and allows selection
 * Minimum 1 repository required
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle, Search, Star, Lock, GitBranch } from 'lucide-react';

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

interface GitHubRepoSelectStepProps {
  accessToken: string;
  onSelect: (repos: Repository[]) => void;
  selectedRepos: Repository[];
}

export function GitHubRepoSelectStep({ accessToken, onSelect, selectedRepos: initialSelection }: GitHubRepoSelectStepProps) {
  const [loading, setLoading] = useState(false);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [filteredRepos, setFilteredRepos] = useState<Repository[]>([]);
  const [selectedRepos, setSelectedRepos] = useState<Set<number>>(
    new Set(initialSelection.map(r => r.id))
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRepositories();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredRepos(repositories);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredRepos(
        repositories.filter(repo =>
          repo.name.toLowerCase().includes(query) ||
          repo.fullName.toLowerCase().includes(query) ||
          repo.description?.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, repositories]);

  const fetchRepositories = async () => {
    setLoading(true);
    setError(null);

    try {
      const ipcRenderer = window.electron.ipcRenderer;
      const result = await ipcRenderer.invoke('github:oauth:fetch-repos');

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch repositories');
      }

      setRepositories(result.repos);
      setFilteredRepos(result.repos);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch repositories');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRepo = (repo: Repository) => {
    setSelectedRepos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(repo.id)) {
        newSet.delete(repo.id);
      } else {
        newSet.add(repo.id);
      }
      return newSet;
    });
  };

  const handleContinue = () => {
    const selected = repositories.filter(r => selectedRepos.has(r.id));
    onSelect(selected);
  };

  const canContinue = selectedRepos.size > 0;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground font-medium">Fetching your repositories...</p>
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
        <Button onClick={fetchRepositories} className="w-full">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Select Repositories</h3>
        <p className="text-sm text-muted-foreground">
          Choose at least one repository to clone and start working with
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search repositories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Repository List */}
      <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
        {filteredRepos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchQuery ? 'No repositories match your search' : 'No repositories found'}
          </div>
        ) : (
          filteredRepos.map((repo) => (
            <div
              key={repo.id}
              className={`rounded-lg border p-4 cursor-pointer transition-colors ${
                selectedRepos.has(repo.id)
                  ? 'border-primary bg-primary/5'
                  : 'hover:bg-muted/30'
              }`}
              onClick={() => handleToggleRepo(repo)}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={selectedRepos.has(repo.id)}
                  onCheckedChange={() => handleToggleRepo(repo)}
                  className="mt-1"
                />

                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {repo.fullName}
                        {repo.private && (
                          <Lock className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                      {repo.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {repo.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    {repo.language && (
                      <Badge variant="secondary" className="text-xs">
                        {repo.language}
                      </Badge>
                    )}
                    {repo.stars > 0 && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Star className="h-3 w-3" />
                        {repo.stars}
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <GitBranch className="h-3 w-3" />
                      {repo.defaultBranch}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Selection Summary */}
      <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
        <div className="text-sm">
          <span className="font-medium">{selectedRepos.size}</span> repositories selected
          {selectedRepos.size === 0 && (
            <span className="text-destructive ml-2">(minimum 1 required)</span>
          )}
        </div>
        {selectedRepos.size > 0 && (
          <Badge variant="default">{selectedRepos.size}</Badge>
        )}
      </div>

      {/* Continue Button */}
      <div className="pt-4">
        <Button
          onClick={handleContinue}
          disabled={!canContinue}
          className="w-full"
          size="lg"
        >
          Continue with {selectedRepos.size} {selectedRepos.size === 1 ? 'repository' : 'repositories'}
        </Button>
      </div>
    </div>
  );
}
