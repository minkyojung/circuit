/**
 * AIRulesOverview - Main AI Rules configuration UI (Cursor-style card layout)
 */

import React, { useState, useEffect } from 'react';
import { Building2, FileEdit, Sparkles, RefreshCw, FileDown, FileUp } from 'lucide-react';
import { SettingSection } from './SettingPrimitives';
import { SettingCard } from './SettingCard';
import { SystemRulesModal } from './SystemRulesModal';
import { ProjectRulesEditorModal } from './ProjectRulesEditorModal';
import { TemplatesModal } from './TemplatesModal';
import { Button } from '@/components/ui/button';
import { getAIRules, importCursorRules, exportCursorRules, SYSTEM_AI_RULES } from '@/services/projectConfig';

interface AIRulesOverviewProps {
  workspacePath: string;
}

export const AIRulesOverview: React.FC<AIRulesOverviewProps> = ({ workspacePath }) => {
  const [projectRuleCount, setProjectRuleCount] = useState(0);
  const [showSystemRulesModal, setShowSystemRulesModal] = useState(false);
  const [showProjectEditorModal, setShowProjectEditorModal] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);

  const effectiveWorkspacePath = workspacePath || 'default-workspace';

  useEffect(() => {
    loadProjectRuleCount();
  }, [effectiveWorkspacePath]);

  const loadProjectRuleCount = async () => {
    try {
      const rules = await getAIRules(effectiveWorkspacePath);
      const enabledCount = rules.filter((r) => r.enabled).length;
      setProjectRuleCount(enabledCount);
    } catch (error) {
      console.error('Failed to load project rules:', error);
    }
  };

  const handleImportCursorRules = async () => {
    try {
      const count = await importCursorRules(effectiveWorkspacePath);
      if (count > 0) {
        alert(`Successfully imported ${count} rules from .cursorrules`);
        loadProjectRuleCount();
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

  return (
    <>
      <SettingSection
        title="AI Configuration"
        description="Manage AI coding rules and behavior"
      >
        <div className="space-y-3">
          {/* System Rules Card */}
          <SettingCard
            icon={<Building2 size={18} />}
            title="System Rules (The Architect)"
            description="Core principles always applied to every AI conversation"
            stats={`${SYSTEM_AI_RULES.length} rules`}
            action={
              <Button size="sm" variant="outline">
                View
              </Button>
            }
            variant="primary"
            onClick={() => setShowSystemRulesModal(true)}
          />

          {/* Project Rules Card */}
          <SettingCard
            icon={<FileEdit size={18} />}
            title="Project Coding Rules"
            description="Project-specific rules added on top of system rules"
            stats={`${projectRuleCount} ${projectRuleCount === 1 ? 'rule' : 'rules'}`}
            action={
              <Button size="sm" variant="default">
                Edit
              </Button>
            }
            onClick={() => setShowProjectEditorModal(true)}
          />

          {/* Templates Card */}
          <SettingCard
            icon={<Sparkles size={18} />}
            title="Rule Templates"
            description="Apply pre-built rule sets for React, Next.js, Python, and more"
            stats="7 templates"
            action={
              <Button size="sm" variant="outline">
                Browse
              </Button>
            }
            variant="accent"
            onClick={() => setShowTemplatesModal(true)}
          />

          {/* Cursor Integration Card */}
          <SettingCard
            icon={<RefreshCw size={18} />}
            title="Cursor Integration"
            description="Import and export rules from/to .cursorrules file"
            action={
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleImportCursorRules();
                  }}
                >
                  <FileDown size={12} />
                  Import
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExportCursorRules();
                  }}
                >
                  <FileUp size={12} />
                  Export
                </Button>
              </div>
            }
            variant="muted"
          />
        </div>

        {/* Info Box */}
        <div className="mt-4 p-3 bg-muted/30 rounded-md border border-border/50">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">How it works:</span> System rules are
            always applied. Your project-specific rules are added on top. The AI follows both when
            generating or modifying code.
          </p>
        </div>
      </SettingSection>

      {/* Modals */}
      <SystemRulesModal
        isOpen={showSystemRulesModal}
        onClose={() => setShowSystemRulesModal(false)}
      />

      <ProjectRulesEditorModal
        isOpen={showProjectEditorModal}
        onClose={() => setShowProjectEditorModal(false)}
        workspacePath={effectiveWorkspacePath}
        onSave={loadProjectRuleCount}
      />

      <TemplatesModal
        isOpen={showTemplatesModal}
        onClose={() => setShowTemplatesModal(false)}
        workspacePath={effectiveWorkspacePath}
        onApply={loadProjectRuleCount}
      />
    </>
  );
};
