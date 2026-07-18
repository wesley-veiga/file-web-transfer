import React, { ReactNode } from 'react';
import { View, useColorScheme, ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ScreenProps extends ViewProps {
  children: ReactNode;
}

/**
 * Screen component - a full-screen container with SafeAreaView and proper theming
 * Automatically adapts background color based on system color scheme
 * @param children - The content to display on the screen
 */
export function Screen({ children, style, className, ...props }: ScreenProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const backgroundColor = isDark ? '#1F1F1F' : '#FFFFFF';

  const screenStyle = {
    flex: 1,
    backgroundColor,
    ...style,
  };

  const baseClasses = `flex-1 ${isDark ? 'bg-background-dark' : 'bg-background-light'}`;
  const allClasses = `${baseClasses} ${className || ''}`;

  return (
    <SafeAreaView style={screenStyle} className={allClasses}>
      <View style={{ flex: 1, width: '100%' }} className="flex-1 w-full" {...props}>
        {children}
      </View>
    </SafeAreaView>
  );
}
