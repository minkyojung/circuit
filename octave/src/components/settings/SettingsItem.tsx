/**
 * SettingsItem - Cursor-style setting item component
 *
 * Reusable component for different types of settings
 */

import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type SettingsItemType = 'toggle' | 'button' | 'select' | 'custom';

interface BaseSettingsItemProps {
  title: string;
  description?: string;
  className?: string;
}

interface ToggleSettingsItemProps extends BaseSettingsItemProps {
  type: 'toggle';
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

interface ButtonSettingsItemProps extends BaseSettingsItemProps {
  type: 'button';
  buttonLabel: string;
  buttonVariant?: 'default' | 'secondary' | 'outline' | 'ghost';
  onButtonClick: () => void;
  disabled?: boolean;
}

interface SelectSettingsItemProps extends BaseSettingsItemProps {
  type: 'select';
  children: React.ReactNode;
}

interface CustomSettingsItemProps extends BaseSettingsItemProps {
  type: 'custom';
  children: React.ReactNode;
}

type SettingsItemProps =
  | ToggleSettingsItemProps
  | ButtonSettingsItemProps
  | SelectSettingsItemProps
  | CustomSettingsItemProps;

export const SettingsItem: React.FC<SettingsItemProps> = (props) => {
  const { title, description, className } = props;

  return (
    <div className={cn(
      'flex items-start justify-between py-3 gap-6',
      className
    )}>
      <div className="flex-1 space-y-0.5">
        <div className="text-sm font-medium text-foreground">{title}</div>
        {description && (
          <div className="text-xs text-muted-foreground leading-relaxed">{description}</div>
        )}
      </div>

      <div className="flex-shrink-0 flex items-start pt-0.5">
        {props.type === 'toggle' && (
          <Switch
            checked={props.checked}
            onCheckedChange={props.onCheckedChange}
            disabled={props.disabled}
          />
        )}

        {props.type === 'button' && (
          <Button
            variant={props.buttonVariant || 'outline'}
            size="sm"
            onClick={props.onButtonClick}
            disabled={props.disabled}
          >
            {props.buttonLabel}
          </Button>
        )}

        {props.type === 'select' && props.children}
        {props.type === 'custom' && props.children}
      </div>
    </div>
  );
};

/**
 * SettingsGroup - Groups multiple settings under a section header
 */
interface SettingsGroupProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export const SettingsGroup: React.FC<SettingsGroupProps> = ({
  title,
  description,
  children,
  className
}) => {
  return (
    <div className={cn('space-y-1', className)}>
      <div className="mb-3">
        <h3 className="text-xs font-medium text-muted-foreground">
          {title}
        </h3>
        {description && (
          <p className="text-xs text-muted-foreground/80 mt-1">{description}</p>
        )}
      </div>
      <div className="space-y-0 divide-y divide-border/30">
        {children}
      </div>
    </div>
  );
};
