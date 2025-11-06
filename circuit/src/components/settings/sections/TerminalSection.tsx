/**
 * TerminalSection - Terminal mode and rendering settings
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
import type { TerminalMode, TerminalRenderer } from '@/types/settings';

interface TerminalSectionProps {
  settings: any;
  updateSettings: any;
}

const RENDERER_OPTIONS: { value: TerminalRenderer; label: string }[] = [
  { value: 'canvas', label: 'Canvas (Recommended)' },
  { value: 'webgl', label: 'WebGL (Faster, no transparency)' },
  { value: 'dom', label: 'DOM (Fallback)' },
];

export const TerminalSection: React.FC<TerminalSectionProps> = ({
  settings,
  updateSettings
}) => {
  const isModernMode = settings.terminal.mode === 'modern';

  return (
    <div className="space-y-8">
      {/* Terminal Mode */}
      <SettingsGroup title="Terminal Mode" description="Choose between classic xterm.js or modern Warp-style terminal">
        <SettingsItem
          type="custom"
          title="Mode"
          description={isModernMode
            ? 'Warp-inspired terminal with blocks, enhanced input, and AI integration'
            : 'Traditional terminal experience with xterm.js'}
        >
          <div className="flex gap-2">
            <button
              onClick={() => updateSettings('terminal', { ...settings.terminal, mode: 'classic' })}
              className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                !isModernMode
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border hover:bg-muted'
              }`}
            >
              Classic
            </button>
            <button
              onClick={() => updateSettings('terminal', { ...settings.terminal, mode: 'modern' })}
              className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                isModernMode
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border hover:bg-muted'
              }`}
            >
              Modern
            </button>
          </div>
        </SettingsItem>
      </SettingsGroup>

      {/* Rendering */}
      <SettingsGroup title="Rendering">
        <SettingsItem
          type="custom"
          title="Renderer"
          description="Choose rendering engine (Canvas recommended for transparency)"
        >
          <Select
            value={settings.terminal.renderer}
            onValueChange={(value) => updateSettings('terminal', { ...settings.terminal, renderer: value as TerminalRenderer })}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RENDERER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsItem>
      </SettingsGroup>

      {/* Modern Features */}
      {isModernMode && (
        <SettingsGroup title="Modern Features" description="Warp-style terminal enhancements">
          <SettingsItem
            type="toggle"
            title="Enable Blocks"
            description="Group commands and outputs as separate blocks"
            checked={settings.terminal.modernFeatures.enableBlocks}
            onCheckedChange={(checked) => updateSettings('terminal', {
              ...settings.terminal,
              modernFeatures: { ...settings.terminal.modernFeatures, enableBlocks: checked }
            })}
          />

          <SettingsItem
            type="toggle"
            title="Enhanced Input"
            description="Monaco-based editor with autocomplete and syntax highlighting"
            checked={settings.terminal.modernFeatures.enableEnhancedInput}
            onCheckedChange={(checked) => updateSettings('terminal', {
              ...settings.terminal,
              modernFeatures: { ...settings.terminal.modernFeatures, enableEnhancedInput: checked }
            })}
          />

          <SettingsItem
            type="toggle"
            title="Show Timestamps"
            description="Display timestamps for each command"
            checked={settings.terminal.modernFeatures.showTimestamps}
            onCheckedChange={(checked) => updateSettings('terminal', {
              ...settings.terminal,
              modernFeatures: { ...settings.terminal.modernFeatures, showTimestamps: checked }
            })}
          />

          <SettingsItem
            type="toggle"
            title="Highlight Failed Commands"
            description="Highlight commands that exit with non-zero status"
            checked={settings.terminal.modernFeatures.highlightFailed}
            onCheckedChange={(checked) => updateSettings('terminal', {
              ...settings.terminal,
              modernFeatures: { ...settings.terminal.modernFeatures, highlightFailed: checked }
            })}
          />

          <SettingsItem
            type="toggle"
            title="Enable Workflows"
            description="Save and replay command sequences"
            checked={settings.terminal.modernFeatures.enableWorkflows}
            onCheckedChange={(checked) => updateSettings('terminal', {
              ...settings.terminal,
              modernFeatures: { ...settings.terminal.modernFeatures, enableWorkflows: checked }
            })}
          />
        </SettingsGroup>
      )}

      {/* Classic Features */}
      {!isModernMode && (
        <SettingsGroup title="Classic Features" description="Traditional terminal settings">
          <SettingsItem
            type="custom"
            title="Scrollback Lines"
            description={`${settings.terminal.classicFeatures.scrollbackLines} lines`}
          >
            <div className="w-[180px]">
              <Slider
                value={[settings.terminal.classicFeatures.scrollbackLines]}
                onValueChange={(value) => updateSettings('terminal', {
                  ...settings.terminal,
                  classicFeatures: { ...settings.terminal.classicFeatures, scrollbackLines: value[0] }
                })}
                min={1000}
                max={10000}
                step={500}
              />
            </div>
          </SettingsItem>

          <SettingsItem
            type="toggle"
            title="Cursor Blink"
            description="Enable cursor blinking"
            checked={settings.terminal.classicFeatures.cursorBlink}
            onCheckedChange={(checked) => updateSettings('terminal', {
              ...settings.terminal,
              classicFeatures: { ...settings.terminal.classicFeatures, cursorBlink: checked }
            })}
          />

          <SettingsItem
            type="custom"
            title="Font Size"
            description={`${settings.terminal.classicFeatures.fontSize}px`}
          >
            <div className="w-[180px]">
              <Slider
                value={[settings.terminal.classicFeatures.fontSize]}
                onValueChange={(value) => updateSettings('terminal', {
                  ...settings.terminal,
                  classicFeatures: { ...settings.terminal.classicFeatures, fontSize: value[0] }
                })}
                min={10}
                max={24}
                step={1}
              />
            </div>
          </SettingsItem>
        </SettingsGroup>
      )}
    </div>
  );
};
