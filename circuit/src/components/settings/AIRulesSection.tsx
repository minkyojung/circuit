/**
 * AI Rules Section Component
 * Manages project-specific AI coding rules in Settings
 */

import React, { useState, useEffect } from 'react';
import { Plus, GripVertical, Trash2, FileDown, FileUp, Check, X } from 'lucide-react';
import { SettingSection } from './SettingPrimitives';
import type { AIRule } from '@/types/project';
import {
  getAIRules,
  addAIRule,
  updateAIRule,
  deleteAIRule,
  reorderAIRules,
  importCursorRules,
  exportCursorRules,
} from '@/services/projectConfig';
import { cn } from '@/lib/utils';

interface AIRulesSectionProps {
  workspacePath: string;
}

export const AIRulesSection: React.FC<AIRulesSectionProps> = ({ workspacePath }) => {
  const [rules, setRules] = useState<AIRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [newRuleContent, setNewRuleContent] = useState('');
  const [showNewRule, setShowNewRule] = useState(false);

  // Load rules on mount
  useEffect(() => {
    loadRules();
  }, [workspacePath]);

  const loadRules = async () => {
    setLoading(true);
    try {
      const loadedRules = await getAIRules(workspacePath);
      setRules(loadedRules);
    } catch (error) {
      console.error('Failed to load AI rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRule = async () => {
    if (!newRuleContent.trim()) return;

    try {
      const newRule = await addAIRule(workspacePath, {
        content: newRuleContent.trim(),
        enabled: true,
        category: 'general',
      });

      if (newRule) {
        setRules([...rules, newRule]);
        setNewRuleContent('');
        setShowNewRule(false);
      }
    } catch (error) {
      console.error('Failed to add rule:', error);
    }
  };

  const handleUpdateRule = async (ruleId: string) => {
    if (!editContent.trim()) return;

    try {
      const success = await updateAIRule(workspacePath, ruleId, {
        content: editContent.trim(),
      });

      if (success) {
        setRules(rules.map((r) => (r.id === ruleId ? { ...r, content: editContent.trim() } : r)));
        setEditingId(null);
        setEditContent('');
      }
    } catch (error) {
      console.error('Failed to update rule:', error);
    }
  };

  const handleToggleRule = async (ruleId: string, enabled: boolean) => {
    try {
      await updateAIRule(workspacePath, ruleId, { enabled });
      setRules(rules.map((r) => (r.id === ruleId ? { ...r, enabled } : r)));
    } catch (error) {
      console.error('Failed to toggle rule:', error);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      const success = await deleteAIRule(workspacePath, ruleId);
      if (success) {
        setRules(rules.filter((r) => r.id !== ruleId));
      }
    } catch (error) {
      console.error('Failed to delete rule:', error);
    }
  };

  const handleImportCursorRules = async () => {
    try {
      const count = await importCursorRules(workspacePath);
      if (count > 0) {
        alert(`Successfully imported ${count} rules from .cursorrules`);
        loadRules();
      } else {
        alert('No .cursorrules file found or no rules to import');
      }
    } catch (error) {
      console.error('Failed to import Cursor rules:', error);
      alert('Failed to import Cursor rules');
    }
  };

  const handleExportCursorRules = async () => {
    try {
      const success = await exportCursorRules(workspacePath);
      if (success) {
        alert('Successfully exported rules to .cursorrules');
      } else {
        alert('No rules to export');
      }
    } catch (error) {
      console.error('Failed to export Cursor rules:', error);
      alert('Failed to export Cursor rules');
    }
  };

  if (loading) {
    return (
      <SettingSection title="AI Coding Rules" description="Define how AI should write code for this project">
        <div className="text-sm text-muted-foreground">Loading rules...</div>
      </SettingSection>
    );
  }

  return (
    <SettingSection
      title="AI Coding Rules"
      description="Define how AI should write code for this project (like Cursor's .cursorrules)"
    >
      {/* Rules List */}
      <div className="space-y-2">
        {rules.length === 0 && !showNewRule && (
          <div className="p-4 border border-dashed border-border rounded-md text-center">
            <p className="text-sm text-muted-foreground">No coding rules yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add rules to guide AI behavior for this project
            </p>
          </div>
        )}

        {rules.map((rule, index) => (
          <div
            key={rule.id}
            className={cn(
              'group flex items-start gap-2 p-3 rounded-md border transition-colors',
              rule.enabled
                ? 'bg-background border-border'
                : 'bg-muted/30 border-border/50 opacity-60'
            )}
          >
            {/* Drag Handle */}
            <div className="flex-shrink-0 pt-0.5 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity">
              <GripVertical size={16} className="text-muted-foreground" />
            </div>

            {/* Rule Number & Checkbox */}
            <div className="flex-shrink-0 pt-0.5">
              <input
                type="checkbox"
                checked={rule.enabled}
                onChange={(e) => handleToggleRule(rule.id, e.target.checked)}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
            </div>

            {/* Rule Content */}
            <div className="flex-1 min-w-0">
              {editingId === rule.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                    rows={2}
                    autoFocus
                  />
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleUpdateRule(rule.id)}
                      className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
                    >
                      <Check size={12} />
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(null);
                        setEditContent('');
                      }}
                      className="px-2 py-1 text-xs bg-muted text-foreground rounded hover:bg-muted/80"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              ) : (
                <p
                  className={cn(
                    'text-sm cursor-pointer',
                    rule.enabled ? 'text-foreground' : 'text-muted-foreground'
                  )}
                  onClick={() => {
                    setEditingId(rule.id);
                    setEditContent(rule.content);
                  }}
                >
                  {index + 1}. {rule.content}
                </p>
              )}
            </div>

            {/* Delete Button */}
            <button
              onClick={() => handleDeleteRule(rule.id)}
              className="flex-shrink-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}

        {/* New Rule Input */}
        {showNewRule && (
          <div className="p-3 border border-dashed border-primary/50 rounded-md space-y-2">
            <textarea
              value={newRuleContent}
              onChange={(e) => setNewRuleContent(e.target.value)}
              placeholder="E.g., Always use TypeScript strict mode"
              className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              rows={2}
              autoFocus
            />
            <div className="flex gap-1">
              <button
                onClick={handleAddRule}
                className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 font-medium"
              >
                Add Rule
              </button>
              <button
                onClick={() => {
                  setShowNewRule(false);
                  setNewRuleContent('');
                }}
                className="px-3 py-1.5 text-xs bg-muted text-foreground rounded hover:bg-muted/80"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Rule Button */}
      {!showNewRule && (
        <button
          onClick={() => setShowNewRule(true)}
          className="mt-3 flex items-center gap-1.5 px-3 py-1.5 text-sm text-primary hover:text-primary/80 hover:bg-primary/5 rounded-md transition-colors"
        >
          <Plus size={14} />
          Add Rule
        </button>
      )}

      {/* Import/Export Buttons */}
      <div className="mt-4 pt-4 border-t border-border flex gap-2">
        <button
          onClick={handleImportCursorRules}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-muted text-foreground rounded hover:bg-muted/80 transition-colors"
        >
          <FileDown size={12} />
          Import from .cursorrules
        </button>
        <button
          onClick={handleExportCursorRules}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-muted text-foreground rounded hover:bg-muted/80 transition-colors"
          disabled={rules.length === 0}
        >
          <FileUp size={12} />
          Export to .cursorrules
        </button>
      </div>

      {/* Info Box */}
      <div className="mt-4 p-3 bg-muted/30 rounded-md border border-border/50">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground">How it works:</span> These rules are
          automatically included in AI conversations as system instructions. AI will follow these
          guidelines when writing code for your project.
        </p>
      </div>
    </SettingSection>
  );
};
