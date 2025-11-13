import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';

/**
 * Theme toggle button with 3-state cycle: light → dark → system
 * Visual feedback shows current theme with appropriate icon
 */
export const ThemeToggle: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => {
  const { theme, resolvedTheme, toggleTheme } = useTheme();

  const getIcon = () => {
    if (theme === 'system') {
      return <Monitor size={16} strokeWidth={1.5} />;
    }
    return resolvedTheme === 'dark' ? (
      <Moon size={16} strokeWidth={1.5} />
    ) : (
      <Sun size={16} strokeWidth={1.5} />
    );
  };

  const getLabel = () => {
    if (theme === 'system') return 'System';
    return theme === 'dark' ? 'Dark' : 'Light';
  };

  return (
    <button
      onClick={toggleTheme}
      className={cn('flex items-center justify-center rounded-md h-7 w-7 transition-colors', className)}
      style={style}
      title={`Current theme: ${getLabel()}. Click to cycle.`}
    >
      {getIcon()}
    </button>
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
    <button
      onClick={toggleTheme}
      className={cn('flex items-center justify-center p-2 rounded-md h-8 w-8 transition-colors', className)}
      title={`${getLabel()}. Click to cycle.`}
    >
      {getIcon()}
    </button>
  );
};
