/**
 * AIRulesOverview - Main AI Rules configuration UI (Simplified)
 */

import React, { useState, useEffect } from 'react';
import { SettingsGroup } from '../SettingsItem';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getAIRules, saveAIRule, SYSTEM_AI_RULES } from '@/services/projectConfig';

interface AIRulesOverviewProps {
  workspacePath: string;
}

export const AIRulesOverview: React.FC<AIRulesOverviewProps> = ({ workspacePath }) => {
  const [selectedSystemRule, setSelectedSystemRule] = useState(SYSTEM_AI_RULES[0]?.id || '');
  const [codingRules, setCodingRules] = useState('');

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
    // Auto-save on change
    try {
      await saveAIRule(effectiveWorkspacePath, {
        id: 'coding-rules',
        title: 'Coding Rules',
        content: value,
        enabled: true,
      });
    } catch (error) {
      console.error('Failed to save coding rules:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* System Rules Dropdown */}
      <SettingsGroup title="System Rules">
        <div className="space-y-2">
          <Select value={selectedSystemRule} onValueChange={setSelectedSystemRule}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SYSTEM_AI_RULES.map((rule) => (
                <SelectItem key={rule.id} value={rule.id}>
                  {rule.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
