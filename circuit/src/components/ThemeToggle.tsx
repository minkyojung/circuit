import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Theme toggle button with 3-state cycle: light → dark → system
 * Visual feedback shows current theme with appropriate icon
 */
export const ThemeToggle: React.FC<{ className?: string }> = ({ className }) => {
  const { theme, resolvedTheme, toggleTheme } = useTheme();

  const getIcon = () => {
    if (theme === 'system') {
      return <Monitor className="h-4 w-4" />;
    }
    return resolvedTheme === 'dark' ? (
      <Moon className="h-4 w-4" />
    ) : (
      <Sun className="h-4 w-4" />
    );
  };

  const getLabel = () => {
    if (theme === 'system') return 'System';
    return theme === 'dark' ? 'Dark' : 'Light';
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      className={cn('gap-2', className)}
      title={`Current theme: ${getLabel()}. Click to cycle.`}
    >
      {getIcon()}
      <span className="text-xs">{getLabel()}</span>
    </Button>
  );
};

/**
 * Icon-only compact version for toolbars
 */
export const ThemeToggleIcon: React.FC<{ className?: string }> = ({ className }) => {
  const { theme, resolvedTheme, toggleTheme } = useTheme();

  const getIcon = () => {
    if (theme === 'system') {
      return <Monitor className="h-[18px] w-[18px]" />;
    }
    return resolvedTheme === 'dark' ? (
      <Moon className="h-[18px] w-[18px]" />
    ) : (
      <Sun className="h-[18px] w-[18px]" />
    );
  };

  const getLabel = () => {
    if (theme === 'system') return 'System theme';
    return theme === 'dark' ? 'Dark mode' : 'Light mode';
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className={cn('h-8 w-8', className)}
      title={`${getLabel()}. Click to cycle.`}
    >
      {getIcon()}
    </Button>
  );
};
