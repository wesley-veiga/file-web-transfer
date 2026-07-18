import React, { ReactNode } from 'react';
import { View, ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ScreenProps extends ViewProps {
  children: ReactNode;
}

/**
 * Screen component - a full-screen container with SafeAreaView and proper theming
 * Automatically adapts background color via dark: variant (NativeWind)
 * @param children - The content to display on the screen
 */
export function Screen({ children, className, ...props }: ScreenProps) {
  const baseClasses = 'flex-1 bg-background-light dark:bg-background-dark';
  const allClasses = `${baseClasses} ${className || ''}`;

  return (
    <SafeAreaView className={allClasses}>
      <View className="flex-1 w-full" {...props}>
        {children}
      </View>
    </SafeAreaView>
  );
}
