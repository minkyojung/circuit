/**
 * SettingsPanel - Cursor-style Settings UI
 *
 * Complete redesign with Shadcn UI components
 */

import React, { useState } from 'react';
import { useSettingsContext } from '@/contexts/SettingsContext';
import { useTheme } from '@/hooks/useTheme';
import { SettingsSidebar, type SettingsCategory } from './settings/SettingsSidebar';
import { GeneralSection } from './settings/sections/GeneralSection';
import { ModelSection } from './settings/sections/ModelSection';
import { AISection } from './settings/sections/AISection';
import { TerminalSection } from './settings/sections/TerminalSection';
import { AdvancedSection } from './settings/sections/AdvancedSection';
import { MCPSection } from './settings/sections/MCPSection';
import { ArchiveSection } from './settings/sections/ArchiveSection';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface SettingsPanelProps {
  workspacePath?: string;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ workspacePath }) => {
  const { settings, updateSettings, resetSettings } = useSettingsContext();
  const { theme, setTheme } = useTheme();
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('general');
  const [searchQuery, setSearchQuery] = useState('');
  const [showResetDialog, setShowResetDialog] = useState(false);

  const handleReset = () => {
    resetSettings();
    setShowResetDialog(false);
  };

  return (
    <div className="h-full w-full flex bg-background">
      {/* Sidebar */}
      <SettingsSidebar
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-border">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1)}
            </h1>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {activeCategory === 'general' && (
            <GeneralSection
              theme={theme}
              setTheme={setTheme}
              settings={settings}
              updateSettings={updateSettings}
            />
          )}

          {activeCategory === 'model' && (
            <ModelSection
              settings={settings}
              updateSettings={updateSettings}
            />
          )}

          {activeCategory === 'ai' && (
            <AISection
              settings={settings}
              updateSettings={updateSettings}
              workspacePath={workspacePath}
            />
          )}

          {activeCategory === 'terminal' && (
            <TerminalSection
              settings={settings}
              updateSettings={updateSettings}
            />
          )}

          {activeCategory === 'advanced' && (
            <AdvancedSection
              settings={settings}
              updateSettings={updateSettings}
            />
          )}

          {activeCategory === 'mcp' && <MCPSection />}

          {activeCategory === 'archive' && <ArchiveSection />}
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowResetDialog(true)}
            className="text-muted-foreground hover:text-foreground"
          >
            Reset to Defaults
          </Button>
        </div>
      </div>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset all settings?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reset all settings to their default values. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset}>
              Reset Settings
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
