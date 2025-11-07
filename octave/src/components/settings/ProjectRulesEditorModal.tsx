/**
 * ProjectRulesEditorModal - Edit project-specific AI coding rules
 */

import React, { useState, useEffect } from 'react';
import { X, FileEdit, Save } from 'lucide-react';
import { getAIRules, addAIRule, deleteAIRule } from '@/services/projectConfig';

interface ProjectRulesEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspacePath: string;
  onSave?: () => void;
}

export const ProjectRulesEditorModal: React.FC<ProjectRulesEditorModalProps> = ({
  isOpen,
  onClose,
  workspacePath,
  onSave,
}) => {
  const [rulesText, setRulesText] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadRules();
    }
  }, [isOpen, workspacePath]);

  const loadRules = async () => {
    setLoading(true);
    try {
      const rules = await getAIRules(workspacePath);
      const text = rules
        .filter((r) => r.enabled)
        .map((r) => r.content)
        .join('\n');
      setRulesText(text);
    } catch (error) {
      console.error('Failed to load rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Clear existing rules
      const existingRules = await getAIRules(workspacePath);
      for (const rule of existingRules) {
        await deleteAIRule(workspacePath, rule.id);
      }

      // Add new rules
      const lines = rulesText
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      for (const line of lines) {
        await addAIRule(workspacePath, {
          content: line,
          enabled: true,
          category: 'general',
        });
      }

      console.log(`Saved ${lines.length} project rules`);
      onSave?.();
      onClose();
    } catch (error) {
      console.error('Failed to save rules:', error);
      alert('Failed to save rules');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const ruleCount = rulesText.split('\n').filter((line) => line.trim()).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-3xl max-h-[85vh] m-4 bg-background border border-border rounded-lg shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <FileEdit size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Edit Project Rules</h2>
              <p className="text-xs text-muted-foreground">One rule per line</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden px-6 py-4 flex flex-col">
          {loading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Loading rules...
            </div>
          ) : (
            <>
              <textarea
                value={rulesText}
                onChange={(e) => setRulesText(e.target.value)}
                placeholder="Always use TypeScript strict mode
Prefer functional components over class components
Use named exports instead of default exports
Extract complex logic into custom hooks
..."
                className="flex-1 w-full px-4 py-3 text-sm bg-muted/30 border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono"
                spellCheck={false}
              />
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>{ruleCount} {ruleCount === 1 ? 'rule' : 'rules'}</span>
                <span className="italic">Press Enter to add a new rule</span>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            💡 These rules are added on top of system rules
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted/50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
            >
              <Save size={14} />
              {saving ? 'Saving...' : 'Save Rules'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
