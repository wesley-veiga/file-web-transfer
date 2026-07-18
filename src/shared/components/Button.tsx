import React from 'react';
import { Pressable, Text, PressableProps, StyleProp, ViewStyle } from 'react-native';

interface ButtonProps extends Omit<PressableProps, 'children'> {
  label: string;
  variant?: 'primary' | 'secondary' | 'success' | 'error';
  size?: 'sm' | 'md' | 'lg';
}

const variantToColor: Record<string, string> = {
  primary: '#208AEF',
  secondary: '#6C757D',
  success: '#28A745',
  error: '#DC3545',
};

const sizeToStyle: Record<
  string,
  { paddingHorizontal: number; paddingVertical: number; fontSize: number }
> = {
  sm: { paddingHorizontal: 12, paddingVertical: 4, fontSize: 12 },
  md: { paddingHorizontal: 16, paddingVertical: 8, fontSize: 16 },
  lg: { paddingHorizontal: 24, paddingVertical: 12, fontSize: 18 },
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
  style,
  className,
  ...props
}: ButtonProps) {
  const sizeStyle = sizeToStyle[size];
  const backgroundColor = variantToColor[variant];
  const opacity = disabled ? 0.5 : 1;

  const mergedStyle: StyleProp<ViewStyle> = {
    backgroundColor,
    borderRadius: 8,
    paddingHorizontal: sizeStyle.paddingHorizontal,
    paddingVertical: sizeStyle.paddingVertical,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    opacity,
    ...style,
  };

  const allClasses = `rounded-md items-center justify-center active:opacity-75 ${className || ''}`;

  return (
    <Pressable disabled={disabled} style={mergedStyle} className={allClasses} {...props}>
      <Text style={{ color: 'white', fontWeight: 'bold', fontSize: sizeStyle.fontSize }}>
        {label}
      </Text>
    </Pressable>
  );
}
