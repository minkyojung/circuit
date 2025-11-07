/**
 * SettingsSidebar - Cursor-style settings navigation
 */

import React from 'react';
import {
  Settings,
  Cpu,
  Sparkles,
  Terminal as TerminalIcon,
  Sliders,
  Activity,
  Archive,
  Search
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

export type SettingsCategory = 'general' | 'model' | 'ai' | 'terminal' | 'advanced' | 'mcp' | 'archive';

interface NavItem {
  id: SettingsCategory;
  label: string;
  icon: typeof Settings;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'model', label: 'Models', icon: Cpu },
  { id: 'ai', label: 'AI', icon: Sparkles },
  { id: 'terminal', label: 'Terminal', icon: TerminalIcon },
  { id: 'advanced', label: 'Advanced', icon: Sliders },
  { id: 'mcp', label: 'Tools & MCP', icon: Activity },
  { id: 'archive', label: 'Archive', icon: Archive },
];

interface SettingsSidebarProps {
  activeCategory: SettingsCategory;
  onCategoryChange: (category: SettingsCategory) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  activeCategory,
  onCategoryChange,
  searchQuery,
  onSearchChange
}) => {
  return (
    <div className="w-64 h-full bg-background border-r border-border flex flex-col">
      {/* User info placeholder */}
      <div className="px-4 py-3 border-b border-border">
        <div className="text-sm font-medium text-foreground">Circuit</div>
        <div className="text-xs text-muted-foreground">Settings</div>
      </div>

      {/* Search */}
      {onSearchChange && (
        <div className="px-3 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search settings ⌘F"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 h-9 bg-muted/50 border-none"
            />
          </div>
        </div>
      )}

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
