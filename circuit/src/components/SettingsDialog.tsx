/**
 * Settings Dialog Component
 *
 * Comprehensive settings interface for Circuit
 * Organized into 8 categories with unified settings system
 */

import React from 'react';
import { X, Palette, Cpu, Bell, Volume2, Keyboard, Sparkles, Paperclip, Activity } from 'lucide-react';
import { useSettingsContext } from '@/contexts/SettingsContext';
import {
  SettingSection,
  ToggleSetting,
  SelectSetting,
  SliderSetting,
  RadioGroupSetting,
} from './settings/SettingPrimitives';
import { useTheme } from '@/hooks/useTheme';
import type { ClaudeModel, CompletionSound, SendKeyCombo } from '@/types/settings';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ isOpen, onClose }) => {
  const { settings, updateSettings, resetSettings } = useSettingsContext();
  const { theme, setTheme } = useTheme();

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[var(--overlay-backdrop)] z-50 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-card border border-border rounded-lg shadow-2xl w-full max-w-2xl max-h-[85vh] pointer-events-auto animate-in zoom-in-95 duration-200 flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
            <h2 className="text-lg font-semibold text-foreground">Settings</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-sidebar-accent rounded transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Close settings"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content - Scrollable */}
          <div className="px-6 py-6 space-y-8 overflow-y-auto flex-1">
            {/* 1. Appearance */}
            <SettingSection
              title="Appearance"
              description="Customize the visual theme"
              icon={Palette}
            >
              <RadioGroupSetting
                label="Theme Mode"
                description="Choose your preferred color scheme"
                value={theme}
                options={[
                  {
                    value: 'light',
                    label: 'Light',
                    description: 'Clean, bright interface',
                  },
                  {
                    value: 'dark',
                    label: 'Dark',
                    description: 'Easy on the eyes in low light',
                  },
                  {
                    value: 'system',
                    label: 'System',
                    description: 'Automatically match your OS preference',
                  },
                ]}
                onChange={(value) => setTheme(value as 'light' | 'dark' | 'system')}
              />
            </SettingSection>

            {/* 2. Model */}
            <SettingSection
              title="Model"
              description="Configure default AI model"
              icon={Cpu}
            >
              <SelectSetting
                label="Default Model"
                description="Model used for new conversations"
                value={settings.model.default}
                options={[
                  { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet (Latest)' },
                  { value: 'claude-3-5-sonnet-20240620', label: 'Claude 3.5 Sonnet (June)' },
                  { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
                  { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
                ]}
                onChange={(value) => updateSettings('model', { default: value as ClaudeModel })}
              />
            </SettingSection>

            {/* 3. Notifications */}
            <SettingSection
              title="Notifications"
              description="Manage notification preferences"
              icon={Bell}
            >
              <ToggleSetting
                label="Session Complete Notifications"
                description="Show desktop notification when Claude finishes responding"
                checked={settings.notifications.sessionComplete}
                onChange={(checked) =>
                  updateSettings('notifications', { sessionComplete: checked })
                }
              />
            </SettingSection>

            {/* 4. Sounds */}
            <SettingSection
              title="Sounds"
              description="Audio feedback settings"
              icon={Volume2}
            >
              <SelectSetting
                label="Completion Sound"
                description="Sound to play when response is complete"
                value={settings.sounds.completionSound}
                options={[
                  { value: 'none', label: 'None' },
                  { value: 'subtle', label: 'Subtle Ping' },
                  { value: 'classic', label: 'Classic Bell' },
                  { value: 'modern', label: 'Modern Chime' },
                ]}
                onChange={(value) =>
                  updateSettings('sounds', { completionSound: value as CompletionSound })
                }
              />
              <SliderSetting
                label="Sound Volume"
                description="Adjust notification sound volume"
                value={settings.sounds.volume}
                min={0}
                max={100}
                step={5}
                onChange={(value) => updateSettings('sounds', { volume: value })}
                formatValue={(v) => `${v}%`}
              />
            </SettingSection>

            {/* 5. Input */}
            <SettingSection
              title="Input"
              description="Keyboard shortcuts and input behavior"
              icon={Keyboard}
            >
              <RadioGroupSetting
                label="Send Messages With"
                description="Choose your preferred send shortcut"
                value={settings.input.sendWith}
                options={[
                  {
                    value: 'enter',
                    label: 'Enter',
                    description: 'Press Enter to send, Shift+Enter for new line',
                  },
                  {
                    value: 'cmd-enter',
                    label: 'Cmd+Enter',
                    description: 'Press Cmd+Enter to send, Enter for new line',
                  },
                ]}
                onChange={(value) => updateSettings('input', { sendWith: value as SendKeyCombo })}
              />
            </SettingSection>

            {/* 6. AI Behavior */}
            <SettingSection
              title="AI Behavior"
              description="Customize AI response patterns"
              icon={Sparkles}
            >
              <ToggleSetting
                label="Strip Absolute Agreement Phrases"
                description={`Remove phrases like "You're absolutely right" from responses`}
                checked={settings.aiBehavior.stripAbsoluteAgreement}
                onChange={(checked) =>
                  updateSettings('aiBehavior', { stripAbsoluteAgreement: checked })
                }
              />
            </SettingSection>

            {/* 7. Attachments */}
            <SettingSection
              title="Attachments"
              description="Configure attachment handling"
              icon={Paperclip}
            >
              <ToggleSetting
                label="Auto-Convert Long Text"
                description="Automatically convert long pasted text to attachments"
                checked={settings.attachments.autoConvertLongText}
                onChange={(checked) =>
                  updateSettings('attachments', { autoConvertLongText: checked })
                }
              />
              <SliderSetting
                label="Conversion Threshold"
                description="Character count threshold for auto-conversion"
                value={settings.attachments.threshold}
                min={1000}
                max={10000}
                step={500}
                onChange={(value) => updateSettings('attachments', { threshold: value })}
                formatValue={(v) => `${(v / 1000).toFixed(1)}k`}
                disabled={!settings.attachments.autoConvertLongText}
              />
            </SettingSection>

            {/* 8. Context Management - Most Important */}
            <SettingSection
              title="Context Management"
              description="Auto-compact settings for managing context window"
              icon={Activity}
            >
              <ToggleSetting
                label="Enable Auto-Compact Warnings"
                description="Show warnings when context usage reaches thresholds"
                checked={settings.context.enabled}
                onChange={(checked) => updateSettings('context', { enabled: checked })}
              />

              <div className="space-y-3 pl-4 border-l-2 border-border">
                <SliderSetting
                  label="Warning Threshold"
                  description="Show subtle warning in status bar"
                  value={settings.context.warningThreshold}
                  min={50}
                  max={90}
                  step={5}
                  onChange={(value) => updateSettings('context', { warningThreshold: value })}
                  formatValue={(v) => `${v}%`}
                  disabled={!settings.context.enabled}
                />

                <SliderSetting
                  label="Recommend Threshold"
                  description="Show banner recommending compact"
                  value={settings.context.recommendThreshold}
                  min={60}
                  max={95}
                  step={5}
                  onChange={(value) => updateSettings('context', { recommendThreshold: value })}
                  formatValue={(v) => `${v}%`}
                  disabled={!settings.context.enabled}
                />

                <SliderSetting
                  label="Urgent Threshold"
                  description="Show critical modal requiring action"
                  value={settings.context.urgentThreshold}
                  min={70}
                  max={100}
                  step={5}
                  onChange={(value) => updateSettings('context', { urgentThreshold: value })}
                  formatValue={(v) => `${v}%`}
                  disabled={!settings.context.enabled}
                />
              </div>

              <ToggleSetting
                label="Show Banner Warnings"
                description="Display full-width banner with quick actions"
                checked={settings.context.showBanners}
                onChange={(checked) => updateSettings('context', { showBanners: checked })}
                disabled={!settings.context.enabled}
              />

              <ToggleSetting
                label="Show Modal at Urgent Level"
                description="Display blocking modal at critical usage"
                checked={settings.context.showModals}
                onChange={(checked) => updateSettings('context', { showModals: checked })}
                disabled={!settings.context.enabled}
              />

              <ToggleSetting
                label="Auto-Prompt When Idle"
                description="Only show warnings when user is idle"
                checked={settings.context.autoPromptWhenIdle}
                onChange={(checked) => updateSettings('context', { autoPromptWhenIdle: checked })}
                disabled={!settings.context.enabled}
              />

              <SliderSetting
                label="Idle Time"
                description="Minutes of inactivity before considered idle"
                value={settings.context.idleTimeMinutes}
                min={1}
                max={30}
                step={1}
                onChange={(value) => updateSettings('context', { idleTimeMinutes: value })}
                formatValue={(v) => `${v} min`}
                disabled={!settings.context.enabled || !settings.context.autoPromptWhenIdle}
              />

              <SliderSetting
                label="Notification Cooldown"
                description="Minutes between repeat notifications"
                value={settings.context.cooldownMinutes}
                min={5}
                max={60}
                step={5}
                onChange={(value) => updateSettings('context', { cooldownMinutes: value })}
                formatValue={(v) => `${v} min`}
                disabled={!settings.context.enabled}
              />

              <ToggleSetting
                label="Auto-Copy Compact Command"
                description="Automatically copy /compact to clipboard"
                checked={settings.context.copyCommandToClipboard}
                onChange={(checked) =>
                  updateSettings('context', { copyCommandToClipboard: checked })
                }
                disabled={!settings.context.enabled}
              />

              <ToggleSetting
                label="Auto-Open Claude Code"
                description="Automatically open Claude Code terminal"
                checked={settings.context.openClaudeCodeAutomatically}
                onChange={(checked) =>
                  updateSettings('context', { openClaudeCodeAutomatically: checked })
                }
                disabled={!settings.context.enabled}
              />
            </SettingSection>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border flex-shrink-0 flex gap-3">
            <button
              onClick={() => {
                if (confirm('Reset all settings to defaults? This cannot be undone.')) {
                  resetSettings();
                }
              }}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
            >
              Reset to Defaults
            </button>
            <div className="flex-1" />
            <button
              onClick={onClose}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium text-sm"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
