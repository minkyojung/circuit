/**
 * SettingsSidebar - Cursor-style settings navigation
 */

import React from 'react';
import {
  Settings,
  Sparkles,
  Terminal as TerminalIcon,
  Sliders,
  Activity,
  Archive,
  Github,
  FolderGit2
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type SettingsCategory = 'general' | 'ai' | 'terminal' | 'repositories' | 'github' | 'advanced' | 'mcp' | 'archive';

interface NavItem {
  id: SettingsCategory;
  label: string;
  icon: typeof Settings;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'ai', label: 'AI', icon: Sparkles },
  { id: 'terminal', label: 'Terminal', icon: TerminalIcon },
  { id: 'repositories', label: 'Repositories', icon: FolderGit2 },
  { id: 'github', label: 'GitHub', icon: Github },
  { id: 'advanced', label: 'Advanced', icon: Sliders },
  { id: 'mcp', label: 'Tools & MCP', icon: Activity },
  { id: 'archive', label: 'Archive', icon: Archive },
];

interface SettingsSidebarProps {
  activeCategory: SettingsCategory;
  onCategoryChange: (category: SettingsCategory) => void;
}

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  activeCategory,
  onCategoryChange
}) => {
  return (
    <div className="w-64 h-full bg-background border-r border-border flex flex-col">
      {/* Navigation */}
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeCategory === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onCategoryChange(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-muted text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              <Icon size={16} strokeWidth={isActive ? 2 : 1.5} />
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
};
