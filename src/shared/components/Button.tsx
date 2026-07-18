import React from 'react';
import { Pressable, Text, PressableProps } from 'react-native';

interface ButtonProps extends Omit<PressableProps, 'children'> {
  label: string;
  variant?: 'primary' | 'secondary' | 'success' | 'error';
  size?: 'sm' | 'md' | 'lg';
}

const variantClasses: Record<string, string> = {
  primary: 'bg-primary',
  secondary: 'bg-secondary',
  success: 'bg-success',
  error: 'bg-error',
};

const sizeClasses: Record<string, string> = {
  sm: 'px-3 py-1 text-xs',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
};

/**
 * Button component using NativeWind for styling
 * @param label - The text to display on the button
 * @param variant - The color variant (primary, secondary, success, error)
 * @param size - The button size (sm, md, lg)
 * @param disabled - Whether the button is disabled
 */
export function Button({
  label,
  variant = 'primary',
  size = 'md',
  disabled = false,
  className,
  ...props
}: ButtonProps) {
  const variantClass = variantClasses[variant];
  const sizeClass = sizeClasses[size];
  const disabledClass = disabled ? 'opacity-50' : '';

  const allClasses = `rounded-md items-center justify-center active:opacity-75 ${variantClass} ${sizeClass} ${disabledClass} ${className || ''}`;

  return (
    <Pressable disabled={disabled} className={allClasses} {...props}>
      <Text className="text-white font-bold">{label}</Text>
    </Pressable>
  );
}
