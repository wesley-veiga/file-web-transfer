import React, { ReactNode } from 'react';
import { View, ViewProps, useColorScheme } from 'react-native';

interface CardProps extends ViewProps {
  children: ReactNode;
}

/**
 * Card component - a container with padding, border, and shadow using NativeWind
 * Automatically adapts to light/dark theme
 * @param children - The content to display inside the card
 */
export function Card({ children, style, className, ...props }: CardProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const backgroundColor = isDark ? '#2A2A2A' : '#F5F5F5';

  const mergedStyle = {
    backgroundColor,
    borderRadius: 8,
    padding: 16,
    ...style,
  };

  const baseClasses = 'bg-surface-light dark:bg-surface-dark rounded-lg p-4';
  const allClasses = `${baseClasses} ${className || ''}`;

  return (
    <View style={mergedStyle} className={allClasses} {...props}>
      {children}
    </View>
  );
}
