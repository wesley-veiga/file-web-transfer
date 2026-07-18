import React, { ReactNode } from 'react';
import { View, ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  children: ReactNode;
}

/**
 * Card component - a container with padding, border, and shadow using NativeWind
 * Automatically adapts to light/dark theme via dark: variant
 * @param children - The content to display inside the card
 */
export function Card({ children, className, ...props }: CardProps) {
  const baseClasses = 'bg-surface-light dark:bg-surface-dark rounded-lg p-4';
  const allClasses = `${baseClasses} ${className || ''}`;

  return (
    <View className={allClasses} {...props}>
      {children}
    </View>
  );
}
