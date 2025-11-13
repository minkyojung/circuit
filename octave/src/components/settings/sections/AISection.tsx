/**
 * AISection - AI and Monaco Editor settings
 */

import React from 'react';
import { SettingsItem, SettingsGroup } from '../SettingsItem';
import { AIRulesOverview } from '@/components/settings/AIRulesOverview';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import type { AIMode } from '@/types/settings';

interface AISectionProps {
  settings: any;
  updateSettings: any;
  workspacePath?: string;
}

const AI_MODE_OPTIONS: { value: AIMode; label: string; description: string }[] = [
  { value: 'fast', label: 'Fast', description: '~300ms - Prioritizes speed with ~10-15% accuracy tradeoff' },
  { value: 'balanced', label: 'Balanced', description: '~500ms - Good balance between speed and accuracy' },
  { value: 'accurate', label: 'Accurate', description: '~800ms+ - Maximum accuracy, slower response' },
];

export const AISection: React.FC<AISectionProps> = ({
  settings,
  updateSettings,
  workspacePath
}) => {
  const selectedMode = AI_MODE_OPTIONS.find(m => m.value === settings.monaco.aiMode);

  return (
    <div className="space-y-8">
      {/* AI Coding Rules */}
      <div>
        <AIRulesOverview workspacePath={workspacePath || 'default-workspace'} />
      </div>

      {/* Monaco Editor AI - Temporarily hidden, functionality preserved */}
      {/* <SettingsGroup title="Monaco Editor AI" description="AI-powered code completion and assistance">
        <SettingsItem
          type="toggle"
          title="AI Autocompletion"
          description="Tab completion powered by Claude Code"
          checked={settings.monaco.enableAutocompletion}
          onCheckedChange={(checked) => updateSettings('monaco', { ...settings.monaco, enableAutocompletion: checked })}
        />

        <SettingsItem
          type="toggle"
          title="Hover Explanations"
          description="Show code explanations on hover"
          checked={settings.monaco.enableHover}
          onCheckedChange={(checked) => updateSettings('monaco', { ...settings.monaco, enableHover: checked })}
        />

        <SettingsItem
          type="toggle"
          title="Inline Suggestions"
          description="Display AI suggestions inline"
          checked={settings.monaco.enableInlineSuggestions}
          onCheckedChange={(checked) => updateSettings('monaco', { ...settings.monaco, enableInlineSuggestions: checked })}
        />

        <SettingsItem
          type="custom"
          title="AI Mode"
          description={selectedMode?.description}
        >
          <Select
            value={settings.monaco.aiMode}
            onValueChange={(value) => updateSettings('monaco', { ...settings.monaco, aiMode: value as AIMode })}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AI_MODE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsItem>

        <SettingsItem
          type="custom"
          title="Completion Delay"
          description={`${settings.monaco.completionDelay}ms - Delay before showing completion`}
          className={!settings.monaco.enableAutocompletion ? 'opacity-50' : ''}
        >
          <div className="w-[180px]">
            <Slider
              value={[settings.monaco.completionDelay]}
              onValueChange={(value) => updateSettings('monaco', { ...settings.monaco, completionDelay: value[0] })}
              min={100}
              max={1000}
              step={50}
              disabled={!settings.monaco.enableAutocompletion}
            />
          </div>
        </SettingsItem>

        <SettingsItem
          type="toggle"
          title="Cache Completions"
          description="Store frequent completions for faster response"
          checked={settings.monaco.cacheCompletions}
          onCheckedChange={(checked) => updateSettings('monaco', { ...settings.monaco, cacheCompletions: checked })}
        />
      </SettingsGroup> */}

      {/* Response Behavior - Temporarily hidden, functionality preserved */}
      {/* <SettingsGroup title="Response Behavior">
        <SettingsItem
          type="toggle"
          title="Strip Absolute Agreement"
          description={`Remove "You're absolutely right" phrases from responses`}
          checked={settings.aiBehavior.stripAbsoluteAgreement}
          onCheckedChange={(checked) => updateSettings('aiBehavior', { stripAbsoluteAgreement: checked })}
        />
      </SettingsGroup> */}

      {/* Attachments - Temporarily hidden, functionality preserved */}
      {/* <SettingsGroup title="Attachments">
        <SettingsItem
          type="toggle"
          title="Auto-Convert Long Text"
          description="Convert long pasted text to attachments"
          checked={settings.attachments.autoConvertLongText}
          onCheckedChange={(checked) => updateSettings('attachments', { autoConvertLongText: checked })}
        />

        <SettingsItem
          type="custom"
          title="Threshold"
          description={`${(settings.attachments.threshold / 1000).toFixed(1)}k chars`}
          className={!settings.attachments.autoConvertLongText ? 'opacity-50' : ''}
        >
          <div className="w-[180px]">
            <Slider
              value={[settings.attachments.threshold]}
              onValueChange={(value) => updateSettings('attachments', { threshold: value[0] })}
              min={1000}
              max={10000}
              step={500}
              disabled={!settings.attachments.autoConvertLongText}
            />
          </div>
        </SettingsItem>
      </SettingsGroup> */}
    </div>
  );
};
