/**
 * GeneralSection - General settings (Appearance, Notifications, Sounds, Input)
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
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ThemeMode, CompletionSound, SendKeyCombo } from '@/types/settings';

interface GeneralSectionProps {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  settings: any;
  updateSettings: any;
}

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

const SOUND_OPTIONS: { value: CompletionSound; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'subtle', label: 'Subtle' },
  { value: 'classic', label: 'Classic' },
  { value: 'modern', label: 'Modern' },
];

export const GeneralSection: React.FC<GeneralSectionProps> = ({
  theme,
  setTheme,
  settings,
  updateSettings
}) => {
  return (
    <div className="space-y-6">
      {/* Appearance */}
      <SettingsGroup title="Appearance">
        <SettingsItem
          type="custom"
          title="Theme"
          description="Choose your preferred color theme"
        >
          <Select value={theme} onValueChange={(value) => setTheme(value as ThemeMode)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {THEME_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsItem>
      </SettingsGroup>

      {/* Notifications */}
      <SettingsGroup title="Notifications">
        <SettingsItem
          type="toggle"
          title="Session Complete"
          description="Show desktop notification when Claude finishes responding"
          checked={settings.notifications.sessionComplete}
          onCheckedChange={(checked) => updateSettings('notifications', { sessionComplete: checked })}
        />
      </SettingsGroup>

      {/* Sounds */}
      <SettingsGroup title="Sounds">
        <SettingsItem
          type="custom"
          title="Completion Sound"
          description="Play sound when Agent finishes responding"
        >
          <Select
            value={settings.sounds.completionSound}
            onValueChange={(value) => updateSettings('sounds', { completionSound: value as CompletionSound })}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SOUND_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsItem>

        <SettingsItem
          type="custom"
          title="Volume"
          description={`${settings.sounds.volume}%`}
        >
          <div className="w-[180px]">
            <Slider
              value={[settings.sounds.volume]}
              onValueChange={(value) => updateSettings('sounds', { volume: value[0] })}
              min={0}
              max={100}
              step={5}
              className="w-full"
            />
          </div>
        </SettingsItem>
      </SettingsGroup>

      {/* Input */}
      <SettingsGroup title="Input">
        <SettingsItem
          type="custom"
          title="Send messages with"
          description="Keyboard shortcut to send messages"
        >
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={settings.input.sendWith === 'enter' ? 'default' : 'outline'}
              onClick={() => updateSettings('input', { sendWith: 'enter' })}
            >
              Enter
            </Button>
            <Button
              size="sm"
              variant={settings.input.sendWith === 'cmd-enter' ? 'default' : 'outline'}
              onClick={() => updateSettings('input', { sendWith: 'cmd-enter' })}
            >
              ⌘ Enter
            </Button>
          </div>
        </SettingsItem>
      </SettingsGroup>
    </div>
  );
};
