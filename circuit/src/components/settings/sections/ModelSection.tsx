/**
 * ModelSection - Model selection settings
 */

import React from 'react';
import { SettingsItem, SettingsGroup } from '../SettingsItem';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ClaudeModel } from '@/types/settings';

interface ModelSectionProps {
  settings: any;
  updateSettings: any;
}

const MODEL_OPTIONS: { value: ClaudeModel; label: string; description: string }[] = [
  {
    value: 'claude-sonnet-4-5-20250929',
    label: 'Claude Sonnet 4.5',
    description: 'Latest model - Best balance of speed and capability'
  },
  {
    value: 'claude-opus-4-20250514',
    label: 'Claude Opus 4',
    description: 'Most capable - Best for complex tasks'
  },
  {
    value: 'claude-haiku-4-20250918',
    label: 'Claude Haiku 4',
    description: 'Fastest - Best for simple tasks'
  },
];

export const ModelSection: React.FC<ModelSectionProps> = ({
  settings,
  updateSettings
}) => {
  const selectedModel = MODEL_OPTIONS.find(m => m.value === settings.model.default);

  return (
    <div className="space-y-8">
      <SettingsGroup
        title="Default Model"
        description="Model used for new conversations"
      >
        <SettingsItem
          type="custom"
          title="Model"
          description={selectedModel?.description}
        >
          <Select
            value={settings.model.default}
            onValueChange={(value) => updateSettings('model', { default: value as ClaudeModel })}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODEL_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsItem>
      </SettingsGroup>
    </div>
  );
};
