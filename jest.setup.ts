import React from 'react';

// Setup Jest environment
Object.defineProperty(global, '__DEV__', {
  writable: true,
  value: true,
});

// Mock expo-splash-screen with proper async behavior
jest.mock('expo-splash-screen', () => ({
  hideAsync: jest.fn().mockResolvedValue(undefined),
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
}));

// Mock react-native-safe-area-context to allow rendering
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, style }: any) =>
    React.createElement('View', { style }, children),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Mock expo-router for Stack and ThemeProvider
jest.mock('expo-router', () => {
  return {
    Stack: (props: any) => {
      return React.createElement(
        'Stack',
        { screenOptions: props.screenOptions },
        props.children
      );
    },
    ThemeProvider: (props: any) => {
      return React.createElement(
        'ThemeProvider',
        { value: props.value },
        props.children
      );
    },
    DarkTheme: { isDark: true },
    DefaultTheme: { isDark: false },
  };
});

// Setup react-native with proper component mocks
jest.mock('react-native', () => {
  const mockReactNative: any = {
    View: React.forwardRef((props: any, ref: any) => {
      return React.createElement('View', { ...props, ref });
    }),
    Text: React.forwardRef((props: any, ref: any) => {
      return React.createElement('Text', { ...props, ref }, props.children);
    }),
    StyleSheet: {
      create: (styles: any) => styles,
      flatten: (styles: any) => {
        if (Array.isArray(styles)) {
          return Object.assign({}, ...styles);
        }
        return styles || {};
      },
    },
    useColorScheme: jest.fn(() => 'light'),
    Platform: {
      OS: 'web',
      select: (obj: any) => obj.web || obj.default,
    },
    LogBox: {
      ignoreLogs: jest.fn(),
      ignoreAllLogs: jest.fn(),
    },
  };

  return mockReactNative;
});

// Add React globals for JSX
globalThis.React = React;
