/**
 * AdvancedSection - Context management and advanced settings
 */

import React from 'react';
import { SettingsItem, SettingsGroup } from '../SettingsItem';
import { Slider } from '@/components/ui/slider';

interface AdvancedSectionProps {
  settings: any;
  updateSettings: any;
}

export const AdvancedSection: React.FC<AdvancedSectionProps> = ({
  settings,
  updateSettings
}) => {
  return (
    <div className="space-y-8">
      {/* Context Management */}
      <SettingsGroup title="Context Management" description="Auto-compact warnings and behavior">
        <SettingsItem
          type="toggle"
          title="Enable Auto-Compact"
          description="Automatically compact sessions when context reaches threshold"
          checked={settings.context.enabled}
          onCheckedChange={(checked) => updateSettings('context', {
            ...settings.context,
            enabled: checked
          })}
        />

        <SettingsItem
          type="custom"
          title="Warning Threshold"
          description={`${settings.context.warningThreshold}% - Show subtle warning`}
        >
          <div className="w-[180px]">
            <Slider
              value={[settings.context.warningThreshold]}
              onValueChange={(value) => updateSettings('context', {
                ...settings.context,
                warningThreshold: value[0]
              })}
              min={50}
              max={100}
              step={5}
            />
          </div>
        </SettingsItem>

        <SettingsItem
          type="custom"
          title="Recommend Threshold"
          description={`${settings.context.recommendThreshold}% - Recommend compacting`}
        >
          <div className="w-[180px]">
            <Slider
              value={[settings.context.recommendThreshold]}
              onValueChange={(value) => updateSettings('context', {
                ...settings.context,
                recommendThreshold: value[0]
              })}
              min={50}
              max={100}
              step={5}
            />
          </div>
        </SettingsItem>

        <SettingsItem
          type="custom"
          title="Urgent Threshold"
          description={`${settings.context.urgentThreshold}% - Urgent compact warning`}
        >
          <div className="w-[180px]">
            <Slider
              value={[settings.context.urgentThreshold]}
              onValueChange={(value) => updateSettings('context', {
                ...settings.context,
                urgentThreshold: value[0]
              })}
              min={50}
              max={100}
              step={5}
            />
          </div>
        </SettingsItem>

        <SettingsItem
          type="toggle"
          title="Show Banners"
          description="Display compact suggestion banners"
          checked={settings.context.showBanners}
          onCheckedChange={(checked) => updateSettings('context', {
            ...settings.context,
            showBanners: checked
          })}
        />

        <SettingsItem
          type="toggle"
          title="Show Modals"
          description="Display compact suggestion modals"
          checked={settings.context.showModals}
          onCheckedChange={(checked) => updateSettings('context', {
            ...settings.context,
            showModals: checked
          })}
        />

        <SettingsItem
          type="toggle"
          title="Auto-Prompt When Idle"
          description="Auto-suggest compact when idle at high context"
          checked={settings.context.autoPromptWhenIdle}
          onCheckedChange={(checked) => updateSettings('context', {
            ...settings.context,
            autoPromptWhenIdle: checked
          })}
        />

        <SettingsItem
          type="custom"
          title="Idle Time"
          description={`${settings.context.idleTimeMinutes} minutes`}
          className={!settings.context.autoPromptWhenIdle ? 'opacity-50' : ''}
        >
          <div className="w-[180px]">
            <Slider
              value={[settings.context.idleTimeMinutes]}
              onValueChange={(value) => updateSettings('context', {
                ...settings.context,
                idleTimeMinutes: value[0]
              })}
              min={1}
              max={15}
              step={1}
              disabled={!settings.context.autoPromptWhenIdle}
            />
          </div>
        </SettingsItem>

        <SettingsItem
          type="custom"
          title="Notification Cooldown"
          description={`${settings.context.cooldownMinutes} minutes between notifications`}
        >
          <div className="w-[180px]">
            <Slider
              value={[settings.context.cooldownMinutes]}
              onValueChange={(value) => updateSettings('context', {
                ...settings.context,
                cooldownMinutes: value[0]
              })}
              min={5}
              max={60}
              step={5}
            />
          </div>
        </SettingsItem>

        <SettingsItem
          type="toggle"
          title="Auto-Copy Command"
          description="Automatically copy /compact command to clipboard"
          checked={settings.context.copyCommandToClipboard}
          onCheckedChange={(checked) => updateSettings('context', {
            ...settings.context,
            copyCommandToClipboard: checked
          })}
        />

        <SettingsItem
          type="toggle"
          title="Auto-Open Claude Code"
          description="Automatically open Claude Code when suggesting compact"
          checked={settings.context.openClaudeCodeAutomatically}
          onCheckedChange={(checked) => updateSettings('context', {
            ...settings.context,
            openClaudeCodeAutomatically: checked
          })}
        />
      </SettingsGroup>
    </div>
  );
};
