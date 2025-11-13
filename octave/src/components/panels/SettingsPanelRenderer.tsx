/**
 * SettingsPanelRenderer Component
 *
 * Renders the SettingsPanel component.
 * Extracted from App.tsx render function for better organization.
 *
 * This is a simple wrapper that passes workspace path to SettingsPanel.
 */

import { SettingsPanel } from '@/components/SettingsPanel';
import type { Workspace } from '@/types/workspace';

interface SettingsPanelRendererProps {
  selectedWorkspace: Workspace | null;
}

export function SettingsPanelRenderer({ selectedWorkspace }: SettingsPanelRendererProps) {
  return <SettingsPanel workspacePath={selectedWorkspace?.path} />;
}
