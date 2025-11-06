/**
 * AI Rules Section Component
 * Manages project-specific AI coding rules in Settings (Cursor-style)
 */

import React, { useState, useEffect } from 'react';
import { FileDown, FileUp, Sparkles, ChevronDown, ChevronRight } from 'lucide-react';
import { SettingSection } from './SettingPrimitives';
import {
  getAIRules,
  addAIRule,
  deleteAIRule,
  importCursorRules,
  exportCursorRules,
  SYSTEM_AI_RULES,
} from '@/services/projectConfig';

// Import templates
import reactTypescriptTemplate from '@/templates/aiRules/react-typescript.json';
import nextjsTemplate from '@/templates/aiRules/nextjs.json';
import nodejsApiTemplate from '@/templates/aiRules/nodejs-api.json';
import pythonFastapiTemplate from '@/templates/aiRules/python-fastapi.json';
import rustTemplate from '@/templates/aiRules/rust.json';
import goTemplate from '@/templates/aiRules/go.json';
import typescriptTemplate from '@/templates/aiRules/typescript.json';

interface AIRulesSectionProps {
  workspacePath: string;
}

const TEMPLATES = {
  'react-typescript': reactTypescriptTemplate,
  'nextjs': nextjsTemplate,
  'nodejs-api': nodejsApiTemplate,
  'python-fastapi': pythonFastapiTemplate,
  'rust': rustTemplate,
  'go': goTemplate,
  'typescript': typescriptTemplate,
};

export const AIRulesSection: React.FC<AIRulesSectionProps> = ({ workspacePath }) => {
  const [rulesText, setRulesText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [showSystemRules, setShowSystemRules] = useState(false);

  // Use fallback workspace path if not provided
  const effectiveWorkspacePath = workspacePath || 'default-workspace';

  // Load rules on mount
  useEffect(() => {
    loadRules();
  }, [effectiveWorkspacePath]);

  const loadRules = async () => {
    setLoading(true);
    try {
      const loadedRules = await getAIRules(effectiveWorkspacePath);
      // Convert rules array to text (one rule per line)
      const text = loadedRules
        .filter((r) => r.enabled)
        .map((r) => r.content)
        .join('\n');
      setRulesText(text);
    } catch (error) {
      console.error('Failed to load AI rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // First, get existing rules to clear them
      const existingRules = await getAIRules(effectiveWorkspacePath);
      for (const rule of existingRules) {
        await deleteAIRule(effectiveWorkspacePath, rule.id);
      }

      // Parse text into individual rules (one per line, skip empty lines)
      const lines = rulesText
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      // Add new rules
      for (let i = 0; i < lines.length; i++) {
        await addAIRule(effectiveWorkspacePath, {
          content: lines[i],
          enabled: true,
          category: 'general',
        });
      }

      console.log(`Saved ${lines.length} AI coding rules`);
    } catch (error) {
      console.error('Failed to save rules:', error);
      alert('Failed to save rules');
    } finally {
      setSaving(false);
    }
  };

  const handleApplyTemplate = async (templateKey: string) => {
    if (!templateKey) return;

    const template = TEMPLATES[templateKey as keyof typeof TEMPLATES];
    if (!template) return;

    // Join template rules with newlines
    const templateText = template.rules.join('\n');

    // Append to existing rules (or replace if empty)
    if (rulesText.trim()) {
      setRulesText(rulesText + '\n' + templateText);
    } else {
      setRulesText(templateText);
    }

    setSelectedTemplate(''); // Reset dropdown
  };

  const handleImportCursorRules = async () => {
    try {
      const count = await importCursorRules(effectiveWorkspacePath);
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
      await handleSave(); // Save current rules first
      const success = await exportCursorRules(effectiveWorkspacePath);
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
      description="Define how AI should write code for this project (one rule per line)"
    >
      {/* System Rules (Collapsible) */}
      <div className="mb-4 border border-primary/20 rounded-md overflow-hidden bg-primary/5">
        <button
          onClick={() => setShowSystemRules(!showSystemRules)}
          className="w-full px-3 py-2 flex items-center justify-between text-sm font-medium text-foreground hover:bg-primary/10 transition-colors"
        >
          <div className="flex items-center gap-2">
            {showSystemRules ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <span>System Rules (Always Applied)</span>
          </div>
          <span className="text-xs text-muted-foreground">{SYSTEM_AI_RULES.length} rules</span>
        </button>
        {showSystemRules && (
          <div className="px-3 py-2 bg-muted/30 border-t border-primary/10">
            <div className="space-y-2">
              {SYSTEM_AI_RULES.map((rule, index) => (
                <div key={index} className="flex gap-2 text-xs">
                  <span className="text-muted-foreground font-mono">{index + 1}.</span>
                  <p className="text-foreground/80 leading-relaxed">{rule}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-border/50">
              <p className="text-xs text-muted-foreground italic">
                💡 These system rules are always applied to guide AI behavior. They are based on "The Architect" philosophy.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Template Selection */}
      <div className="mb-3">
        <label className="block text-xs font-medium text-foreground mb-1.5">
          Apply Template
        </label>
        <div className="flex gap-2">
          <select
            value={selectedTemplate}
            onChange={(e) => handleApplyTemplate(e.target.value)}
            className="flex-1 px-3 py-1.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Select a template...</option>
            <option value="react-typescript">React + TypeScript</option>
            <option value="nextjs">Next.js</option>
            <option value="nodejs-api">Node.js API</option>
            <option value="python-fastapi">Python FastAPI</option>
            <option value="rust">Rust</option>
            <option value="go">Go</option>
            <option value="typescript">TypeScript</option>
          </select>
          <button
            onClick={() => handleApplyTemplate(selectedTemplate)}
            disabled={!selectedTemplate}
            className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <Sparkles size={12} />
            Apply
          </button>
        </div>
      </div>

      {/* Rules Textarea */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-foreground">
          Project-Specific Rules (one per line)
        </label>
        <textarea
          value={rulesText}
          onChange={(e) => setRulesText(e.target.value)}
          placeholder="Always use TypeScript strict mode
Prefer functional components over class components
Use named exports instead of default exports
Extract complex logic into custom hooks
..."
          className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-primary font-mono"
          rows={12}
          spellCheck={false}
        />
        <p className="text-xs text-muted-foreground">
          {rulesText.split('\n').filter((line) => line.trim()).length} project rules
        </p>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-3 px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 font-medium"
      >
        {saving ? 'Saving...' : 'Save Rules'}
      </button>

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
          disabled={!rulesText.trim()}
        >
          <FileUp size={12} />
          Export to .cursorrules
        </button>
      </div>

      {/* Info Box */}
      <div className="mt-4 p-3 bg-muted/30 rounded-md border border-border/50">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground">How it works:</span> System rules (above) are
          always applied to every AI conversation. Your project-specific rules are added on top to
          customize behavior for this workspace.
        </p>
      </div>
    </SettingSection>
  );
};
