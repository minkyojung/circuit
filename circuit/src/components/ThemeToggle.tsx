import React from 'react';
import { Sun, Moon, Monitor, Leaf } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Theme toggle button with 5-state cycle: light → dark → green-light → green-dark → system
 * Visual feedback shows current theme with appropriate icon
 */
export const ThemeToggle: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => {
  const { theme, resolvedTheme, toggleTheme } = useTheme();

  const getIcon = () => {
    if (theme === 'system') {
      return <Monitor className="h-4 w-4" />;
    }
    if (theme === 'green-light' || theme === 'green-dark') {
      return <Leaf className="h-4 w-4" />;
    }
    return resolvedTheme === 'dark' ? (
      <Moon className="h-4 w-4" />
    ) : (
      <Sun className="h-4 w-4" />
    );
  };

  const getLabel = () => {
    if (theme === 'system') return 'System';
    if (theme === 'green-light') return 'Sage';
    if (theme === 'green-dark') return 'Forest';
    return theme === 'dark' ? 'Dark' : 'Light';
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      className={cn('gap-2', className)}
      style={style}
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
    if (theme === 'green-light' || theme === 'green-dark') {
      return <Leaf className="h-[18px] w-[18px]" />;
    }
    return resolvedTheme === 'dark' ? (
      <Moon className="h-[18px] w-[18px]" />
    ) : (
      <Sun className="h-[18px] w-[18px]" />
    );
  };

  const getLabel = () => {
    if (theme === 'system') return 'System theme';
    if (theme === 'green-light') return 'Sage theme';
    if (theme === 'green-dark') return 'Forest theme';
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
