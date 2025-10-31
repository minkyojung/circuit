import React, { useState, useEffect } from 'react';
import type { Workspace } from '@/types/workspace';
import { X, AlertTriangle, Loader2, Check } from 'lucide-react';

// @ts-ignore - Electron IPC
const { ipcRenderer } = window.require('electron');

interface ConflictAnalysis {
  explanation: string;
  options: ConflictOption[];
}

interface ConflictOption {
  id: number;
  title: string;
  preview: string | null;
  badge: string | null;
}

interface Conflict {
  file: string;
  analysis: ConflictAnalysis;
}

interface ConflictResolverDialogProps {
  workspace: Workspace;
  onClose: () => void;
  onResolved: () => void;
  onRequestDirectEdit: (message: string) => void;
}

export const ConflictResolverDialog: React.FC<ConflictResolverDialogProps> = ({
  workspace,
  onClose,
  onResolved,
  onRequestDirectEdit,
}) => {
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, number>>({});
  const [isResolving, setIsResolving] = useState(false);
  const [totalFiles, setTotalFiles] = useState(0);
  const [analyzedFiles, setAnalyzedFiles] = useState(0);
  const [currentFile, setCurrentFile] = useState<string>('');

  const handleClose = async () => {
    // Abort merge if closing without resolving
    console.log('[ConflictResolver] Aborting merge...');
    await ipcRenderer.invoke('workspace:abort-merge', workspace.path);
    onClose();
  };

  useEffect(() => {
    const analyzeConflicts = async () => {
      try {
        console.log('[ConflictResolver] Getting conflict files...');

        // Step 1: Get list of conflicted files
        const filesResult = await ipcRenderer.invoke('workspace:get-conflict-files', workspace.path);

        if (!filesResult.success) {
          setError(filesResult.error);
          setIsLoading(false);
          return;
        }

        const files = filesResult.files;
        if (files.length === 0) {
          setError('No conflicts found');
          setIsLoading(false);
          return;
        }

        setTotalFiles(files.length);
        console.log(`[ConflictResolver] Found ${files.length} conflicted files`);

        // Step 2: Analyze each file individually (with progress)
        const analyzedConflicts: Conflict[] = [];

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          setCurrentFile(file);
          setAnalyzedFiles(i);

          console.log(`[ConflictResolver] Analyzing ${i + 1}/${files.length}: ${file}`);

          const result = await ipcRenderer.invoke('workspace:analyze-file-conflict', workspace.path, file);

          if (result.success) {
            analyzedConflicts.push({
              file: result.file,
              analysis: result.analysis
            });
          } else {
            console.error(`[ConflictResolver] Failed to analyze ${file}:`, result.error);

            // Fallback: Provide "직접 수정" option only
            analyzedConflicts.push({
              file,
              analysis: {
                explanation: `⚠️ Claude 분석 실패. Chat에서 직접 해결해주세요.`,
                options: [
                  {
                    id: 5,
                    title: "직접 수정",
                    preview: null,
                    badge: "필수"
                  }
                ]
              }
            });
          }

          setAnalyzedFiles(i + 1);
        }

        setConflicts(analyzedConflicts);
      } catch (err) {
        console.error('[ConflictResolver] Error:', err);
        setError(String(err));
      } finally {
        setIsLoading(false);
      }
    };

    analyzeConflicts();
  }, [workspace.path]);

  const handleSelectOption = (file: string, optionId: number, conflict?: Conflict) => {
    if (optionId === 5) {
      // "직접 수정" - 채팅으로 이동
      if (conflict) {
        const message = `${file} 파일의 merge conflict를 해결해줘:\n\n${conflict.analysis.explanation}\n\n어떻게 해결할지 구체적으로 설명해줘.`;
        onRequestDirectEdit(message);
      }
      return;
    }

    setSelectedOptions({
      ...selectedOptions,
      [file]: optionId,
    });
  };

  const handleResolve = async () => {
    setIsResolving(true);
    setError(null);

    try {
      // Resolve each conflict
      for (const conflict of conflicts) {
        const optionId = selectedOptions[conflict.file];
        if (!optionId) {
          throw new Error(`${conflict.file}에 대한 선택을 해주세요`);
        }

        const option = conflict.analysis.options.find(o => o.id === optionId);
        if (!option || !option.preview) {
          throw new Error('Invalid option');
        }

        console.log('[ConflictResolver] Resolving:', conflict.file);
        const result = await ipcRenderer.invoke(
          'workspace:resolve-conflict',
          workspace.path,
          conflict.file,
          option.preview
        );

        if (!result.success) {
          throw new Error(`Failed to resolve ${conflict.file}: ${result.error}`);
        }
      }

      // All resolved - commit
      await ipcRenderer.invoke(
        'workspace:commit-and-push',
        workspace.path,
        'resolve: Merge conflicts'
      );

      console.log('[ConflictResolver] All conflicts resolved');
      onResolved();
    } catch (err) {
      console.error('[ConflictResolver] Resolve error:', err);
      setError(String(err));
    } finally {
      setIsResolving(false);
    }
  };

  const allSelected = conflicts.length > 0 && conflicts.every(c => selectedOptions[c.file]);

  if (isLoading) {
    const progress = totalFiles > 0 ? (analyzedFiles / totalFiles) * 100 : 0;

    return (
      <div className="fixed inset-0 bg-[var(--overlay-backdrop)] flex items-center justify-center z-50">
        <div className="bg-card border border-border rounded-lg p-8 w-[500px] shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <Loader2 className="animate-spin text-primary" size={24} />
            <span className="text-lg text-foreground">Claude가 conflict를 분석 중...</span>
          </div>

          {totalFiles > 0 && (
            <>
              {/* Progress bar */}
              <div className="mb-3">
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Progress text */}
              <div className="text-sm text-muted-foreground space-y-1">
                <div className="flex justify-between">
                  <span>진행률</span>
                  <span className="text-primary font-medium">{analyzedFiles} / {totalFiles} 파일</span>
                </div>
                {currentFile && (
                  <div className="text-xs text-muted-foreground truncate">
                    분석 중: {currentFile}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[var(--overlay-backdrop)] flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-status-working" size={20} />
            <h2 className="text-lg font-semibold text-foreground">Merge Conflict 해결</h2>
          </div>
          <button onClick={handleClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 bg-background">
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 rounded p-3 mb-4 text-sm text-destructive">
              {error}
            </div>
          )}

          {conflicts.map((conflict) => (
            <div key={conflict.file} className="mb-6 last:mb-0">
              {/* File header */}
              <div className="bg-card border border-border rounded-t p-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-primary">{conflict.file}</span>
                  {selectedOptions[conflict.file] && (
                    <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-md flex items-center gap-1">
                      <Check size={12} />
                      선택됨
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-2">{conflict.analysis.explanation}</p>
              </div>

              {/* Options grid */}
              <div className="grid grid-cols-2 gap-2 p-3 bg-muted border border-t-0 border-border rounded-b">
                {conflict.analysis.options.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => handleSelectOption(conflict.file, option.id, conflict)}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      selectedOptions[conflict.file] === option.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50 bg-card'
                    }`}
                  >
                    {/* Title */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-foreground">{option.title}</span>
                      {option.badge && (
                        <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-md">
                          {option.badge}
                        </span>
                      )}
                    </div>

                    {/* Preview */}
                    {option.preview && (
                      <pre className="text-xs text-muted-foreground font-mono bg-background p-2 rounded overflow-auto max-h-24">
                        {option.preview.length > 150
                          ? option.preview.substring(0, 150) + '...'
                          : option.preview}
                      </pre>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border bg-card">
          <div className="text-xs text-muted-foreground">
            {conflicts.length}개 파일 • {Object.keys(selectedOptions).length}개 선택됨
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleClose}
              disabled={isResolving}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              취소
            </button>
            <button
              onClick={handleResolve}
              disabled={!allSelected || isResolving}
              className="px-4 py-2 bg-primary hover:bg-primary/90 disabled:bg-secondary disabled:cursor-not-allowed text-primary-foreground text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              {isResolving ? (
                <>
                  <Loader2 className="animate-spin" size={14} />
                  해결 중...
                </>
              ) : (
                <>
                  <Check size={14} />
                  Conflict 해결
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
