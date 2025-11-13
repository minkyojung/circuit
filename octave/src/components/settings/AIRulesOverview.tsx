/**
 * AIRulesOverview - Main AI Rules configuration UI (Simplified)
 */

import React, { useState, useEffect } from 'react';
import { SettingsGroup } from './SettingsItem';
import { Textarea } from '@/components/ui/textarea';
import { getAIRules, addAIRule, updateAIRule, deleteAIRule, SYSTEM_AI_RULES } from '@/services/projectConfig';

interface AIRulesOverviewProps {
  workspacePath: string;
}

export const AIRulesOverview: React.FC<AIRulesOverviewProps> = ({ workspacePath }) => {
  const [codingRules, setCodingRules] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const effectiveWorkspacePath = workspacePath || 'default-workspace';

  useEffect(() => {
    loadCodingRules();
  }, [effectiveWorkspacePath]);

  const loadCodingRules = async () => {
    try {
      const rules = await getAIRules(effectiveWorkspacePath);
      const enabledRules = rules.filter((r) => r.enabled);
      const rulesText = enabledRules.map((r) => r.content).join('\n\n');
      setCodingRules(rulesText);
    } catch (error) {
      console.error('Failed to load coding rules:', error);
    }
  };

  const handleCodingRulesChange = async (value: string) => {
    setCodingRules(value);

    if (isLoading) return;
    setIsLoading(true);

    try {
      // Delete all existing rules
      const existingRules = await getAIRules(effectiveWorkspacePath);
      for (const rule of existingRules) {
        await deleteAIRule(effectiveWorkspacePath, rule.id);
      }

      // Add new rules (split by double newline)
      const ruleLines = value.split('\n\n').filter(line => line.trim());
      for (const ruleContent of ruleLines) {
        await addAIRule(effectiveWorkspacePath, {
          content: ruleContent.trim(),
          enabled: true,
          category: 'general',
        });
      }
    } catch (error) {
      console.error('Failed to save coding rules:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* System Rules - Read-only display */}
      <SettingsGroup title="System Rules">
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground bg-muted/30 rounded-md p-3 space-y-2 max-h-[200px] overflow-y-auto">
            {SYSTEM_AI_RULES.map((rule, index) => (
              <div key={index} className="leading-relaxed">
                {index + 1}. {rule}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Core principles applied to every AI conversation
          </p>
        </div>
      </SettingsGroup>

      {/* Coding Rules Direct Input */}
      <SettingsGroup title="Coding Rules">
        <div className="space-y-2">
          <Textarea
            value={codingRules}
            onChange={(e) => handleCodingRulesChange(e.target.value)}
            placeholder="Add project-specific coding rules here..."
            className="min-h-[200px] font-mono text-xs resize-y"
          />
          <p className="text-xs text-muted-foreground">
            Project-specific rules added on top of system rules
          </p>
        </div>
      </SettingsGroup>

      {/* Cursor Integration - Commented out */}
      {/*
      <SettingsGroup title="Cursor Integration">
        <div className="flex gap-2">
          <Button size="sm" variant="outline">Import from .cursorrules</Button>
          <Button size="sm" variant="outline">Export to .cursorrules</Button>
        </div>
      </SettingsGroup>
      */}
    </div>
  );
};
