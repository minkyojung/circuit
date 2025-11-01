/**
 * Settings Dialog Component
 *
 * macOS-style settings with sidebar navigation
 * Following Dieter Rams' principles and Apple HIG
 */

import React, { useState } from 'react';
import { X, Settings as SettingsIcon, Cpu, Sparkles, Sliders, Archive } from 'lucide-react';
import { useSettingsContext } from '@/contexts/SettingsContext';
import {
  SettingSection,
  ToggleSetting,
  SelectSetting,
  SliderSetting,
  SegmentedControl,
} from './settings/SettingPrimitives';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import type { ClaudeModel, CompletionSound, SendKeyCombo, ThemeMode } from '@/types/settings';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsCategory = 'general' | 'model' | 'ai' | 'advanced' | 'archive';

interface NavItem {
  id: SettingsCategory;
  label: string;
  icon: typeof SettingsIcon;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'general', label: 'General', icon: SettingsIcon },
  { id: 'model', label: 'Model', icon: Cpu },
  { id: 'ai', label: 'AI', icon: Sparkles },
  { id: 'advanced', label: 'Advanced', icon: Sliders },
  { id: 'archive', label: 'Archive', icon: Archive },
];

export const SettingsDialog: React.FC<SettingsDialogProps> = ({ isOpen, onClose }) => {
  const { settings, updateSettings, resetSettings } = useSettingsContext();
  const { theme, setTheme } = useTheme();
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('general');

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
          className="bg-card border border-border rounded-lg shadow-2xl w-full max-w-3xl h-[600px] pointer-events-auto animate-in zoom-in-95 duration-200 flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border flex-shrink-0">
            <h2 className="text-base font-semibold text-foreground">Settings</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-muted rounded transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Close settings"
            >
              <X size={18} />
            </button>
          </div>

          {/* Content: Sidebar + Panel */}
          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar Navigation */}
            <div className="w-40 border-r border-border bg-muted/30 flex-shrink-0">
              <nav className="p-2 space-y-0.5">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeCategory === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveCategory(item.id)}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left',
                        isActive
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      )}
                    >
                      <Icon size={16} strokeWidth={isActive ? 2 : 1.5} />
                      {item.label}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Settings Panel */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-5 space-y-5">
                {activeCategory === 'general' && <GeneralSettings theme={theme} setTheme={setTheme} settings={settings} updateSettings={updateSettings} />}
                {activeCategory === 'model' && <ModelSettings settings={settings} updateSettings={updateSettings} />}
                {activeCategory === 'ai' && <AISettings settings={settings} updateSettings={updateSettings} />}
                {activeCategory === 'advanced' && <AdvancedSettings settings={settings} updateSettings={updateSettings} />}
                {activeCategory === 'archive' && <ArchiveSettings />}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-border flex-shrink-0 flex gap-2.5">
            <button
              onClick={() => {
                if (confirm('Reset all settings to defaults? This cannot be undone.')) {
                  resetSettings();
                }
              }}
              className="px-3.5 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
            >
              Reset to Defaults
            </button>
            <div className="flex-1" />
            <button
              onClick={onClose}
              className="px-5 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium text-sm"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

// ============================================================================
// Category Panels
// ============================================================================

interface SettingsPanelProps {
  theme?: ThemeMode;
  setTheme?: (theme: ThemeMode) => void;
  settings: any;
  updateSettings: any;
}

const GeneralSettings: React.FC<SettingsPanelProps> = ({ theme, setTheme, settings, updateSettings }) => (
  <>
    <SettingSection title="Appearance">
      <div className="flex items-center justify-between">
        <label className="text-sm text-foreground">Theme</label>
        <SegmentedControl
          value={theme!}
          options={[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
            { value: 'green-light', label: 'Sage' },
            { value: 'green-dark', label: 'Forest' },
            { value: 'system', label: 'System' },
          ]}
          onChange={(value) => setTheme!(value as ThemeMode)}
        />
      </div>
    </SettingSection>

    <SettingSection title="Notifications">
      <ToggleSetting
        label="Session Complete"
        description="Desktop notification when Claude finishes"
        checked={settings.notifications.sessionComplete}
        onChange={(checked) => updateSettings('notifications', { sessionComplete: checked })}
      />
    </SettingSection>

    <SettingSection title="Sounds">
      <SelectSetting
        label="Completion Sound"
        description="Play sound when response completes"
        value={settings.sounds.completionSound}
        options={[
          { value: 'none', label: 'None' },
          { value: 'subtle', label: 'Subtle' },
          { value: 'classic', label: 'Classic' },
          { value: 'modern', label: 'Modern' },
        ]}
        onChange={(value) => updateSettings('sounds', { completionSound: value as CompletionSound })}
      />
      <SliderSetting
        label="Volume"
        value={settings.sounds.volume}
        min={0}
        max={100}
        step={5}
        onChange={(value) => updateSettings('sounds', { volume: value })}
        formatValue={(v) => `${v}%`}
      />
    </SettingSection>

    <SettingSection title="Input">
      <div className="flex items-center justify-between">
        <label className="text-sm text-foreground">Send messages with</label>
        <SegmentedControl
          value={settings.input.sendWith}
          options={[
            { value: 'enter', label: 'Enter' },
            { value: 'cmd-enter', label: '⌘ Enter' },
          ]}
          onChange={(value) => updateSettings('input', { sendWith: value as SendKeyCombo })}
        />
      </div>
    </SettingSection>
  </>
);

const ModelSettings: React.FC<SettingsPanelProps> = ({ settings, updateSettings }) => (
  <SettingSection title="Default Model" description="Model used for new conversations">
    <SelectSetting
      label="Model"
      value={settings.model.default}
      options={[
        { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5 (Latest)' },
        { value: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
        { value: 'claude-haiku-4-20250918', label: 'Claude Haiku 4' },
      ]}
      onChange={(value) => updateSettings('model', { default: value as ClaudeModel })}
    />
  </SettingSection>
);

const AISettings: React.FC<SettingsPanelProps> = ({ settings, updateSettings }) => (
  <>
    <SettingSection title="Response Behavior">
      <ToggleSetting
        label="Strip Absolute Agreement"
        description={`Remove "You're absolutely right" phrases`}
        checked={settings.aiBehavior.stripAbsoluteAgreement}
        onChange={(checked) => updateSettings('aiBehavior', { stripAbsoluteAgreement: checked })}
      />
    </SettingSection>

    <SettingSection title="Attachments">
      <ToggleSetting
        label="Auto-Convert Long Text"
        description="Convert long pasted text to attachments"
        checked={settings.attachments.autoConvertLongText}
        onChange={(checked) => updateSettings('attachments', { autoConvertLongText: checked })}
      />
      <SliderSetting
        label="Threshold"
        value={settings.attachments.threshold}
        min={1000}
        max={10000}
        step={500}
        onChange={(value) => updateSettings('attachments', { threshold: value })}
        formatValue={(v) => `${(v / 1000).toFixed(1)}k chars`}
        disabled={!settings.attachments.autoConvertLongText}
      />
    </SettingSection>
  </>
);

const AdvancedSettings: React.FC<SettingsPanelProps> = ({ settings, updateSettings }) => (
  <SettingSection title="Context Management" description="Auto-compact warnings and behavior">
    <ToggleSetting
      label="Enable Auto-Compact"
      description="Show warnings when context reaches thresholds"
      checked={settings.context.enabled}
      onChange={(checked) => updateSettings('context', { enabled: checked })}
    />

    <div className="pl-4 space-y-2.5 border-l-2 border-border/50">
      <SliderSetting
        label="Warning Threshold"
        description="Subtle status bar warning"
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
        description="Show banner with actions"
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
        description="Show critical modal"
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
      label="Show Banners"
      checked={settings.context.showBanners}
      onChange={(checked) => updateSettings('context', { showBanners: checked })}
      disabled={!settings.context.enabled}
    />

    <ToggleSetting
      label="Show Modals"
      checked={settings.context.showModals}
      onChange={(checked) => updateSettings('context', { showModals: checked })}
      disabled={!settings.context.enabled}
    />

    <ToggleSetting
      label="Auto-Prompt When Idle"
      description="Only show warnings during idle time"
      checked={settings.context.autoPromptWhenIdle}
      onChange={(checked) => updateSettings('context', { autoPromptWhenIdle: checked })}
      disabled={!settings.context.enabled}
    />

    <SliderSetting
      label="Idle Time"
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
      value={settings.context.cooldownMinutes}
      min={5}
      max={60}
      step={5}
      onChange={(value) => updateSettings('context', { cooldownMinutes: value })}
      formatValue={(v) => `${v} min`}
      disabled={!settings.context.enabled}
    />

    <ToggleSetting
      label="Auto-Copy Command"
      description="Copy /compact to clipboard"
      checked={settings.context.copyCommandToClipboard}
      onChange={(checked) => updateSettings('context', { copyCommandToClipboard: checked })}
      disabled={!settings.context.enabled}
    />

    <ToggleSetting
      label="Auto-Open Claude Code"
      checked={settings.context.openClaudeCodeAutomatically}
      onChange={(checked) => updateSettings('context', { openClaudeCodeAutomatically: checked })}
      disabled={!settings.context.enabled}
    />
  </SettingSection>
);

const ArchiveSettings: React.FC = () => {
  const [workspaces, setWorkspaces] = React.useState<any[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState('')

  // @ts-ignore - Electron IPC
  const { ipcRenderer } = window.require('electron')

  React.useEffect(() => {
    loadWorkspaces()
  }, [])

  const loadWorkspaces = async () => {
    try {
      setIsLoading(true)
      const result = await ipcRenderer.invoke('workspace:list')

      console.log('[ArchiveSettings] Loaded workspaces:', result)

      if (result.success && result.workspaces) {
        console.log('[ArchiveSettings] All workspaces:', result.workspaces.map((w: any) => ({ id: w.id, archived: w.archived })))
        const archived = result.workspaces.filter((w: any) => w.archived)
        console.log('[ArchiveSettings] Archived workspaces:', archived)
        setWorkspaces(archived)
      }
    } catch (error) {
      console.error('Error loading workspaces:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUnarchive = async (workspaceId: string) => {
    try {
      const result = await ipcRenderer.invoke('workspace:unarchive', workspaceId)

      if (result.success) {
        await loadWorkspaces()
      } else {
        alert(`Failed to unarchive: ${result.error}`)
      }
    } catch (error) {
      console.error('Error unarchiving workspace:', error)
      alert(`Error: ${error}`)
    }
  }

  const handleDelete = async (workspace: any) => {
    const confirmed = confirm(
      `Permanently delete "${workspace.name}"?\n\nThis action cannot be undone.`
    )

    if (!confirmed) return

    try {
      const result = await ipcRenderer.invoke('workspace:delete', workspace.id)

      if (result.success) {
        await loadWorkspaces()
      } else {
        alert(`Failed to delete: ${result.error}`)
      }
    } catch (error) {
      console.error('Error deleting workspace:', error)
      alert(`Error: ${error}`)
    }
  }

  const filteredWorkspaces = workspaces.filter((workspace) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        workspace.name.toLowerCase().includes(query) ||
        workspace.branch.toLowerCase().includes(query)
      )
    }
    return true
  })

  const formatRelativeTime = (isoString?: string) => {
    if (!isoString) return 'Unknown'

    const date = new Date(isoString)
    if (isNaN(date.getTime())) return 'Unknown'

    const now = Date.now()
    const archived = date.getTime()
    const diff = now - archived

    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    if (days < 30) return `${Math.floor(days / 7)}w ago`
    return `${Math.floor(days / 30)}mo ago`
  }

  return (
    <SettingSection title="Archived Workspaces" description={`${workspaces.length} archived workspace${workspaces.length !== 1 ? 's' : ''}`}>
      {/* Search */}
      <div className="mb-3">
        <input
          type="text"
          placeholder="Search archived workspaces..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-1.5 text-sm bg-muted border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Workspace List */}
      {isLoading ? (
        <div className="text-sm text-muted-foreground py-4 text-center">
          Loading...
        </div>
      ) : filteredWorkspaces.length === 0 && workspaces.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          <div className="text-2xl mb-2">📦</div>
          <p>No archived workspaces</p>
          <p className="text-xs mt-1">Archive workspaces by right-clicking them</p>
        </div>
      ) : filteredWorkspaces.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4 text-center">
          No matching workspaces
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {filteredWorkspaces.map((workspace) => (
            <div
              key={workspace.id}
              className="p-3 rounded-md border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                {/* Workspace Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">
                    {workspace.name}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
                    {workspace.branch}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Archived {formatRelativeTime(workspace.archivedAt)}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => handleUnarchive(workspace.id)}
                    className="px-2.5 py-1 text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 rounded transition-colors"
                  >
                    Restore
                  </button>
                  <button
                    onClick={() => handleDelete(workspace)}
                    className="px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 rounded transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </SettingSection>
  )
};
