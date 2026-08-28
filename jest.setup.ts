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

// Mock react-native-qrcode-svg for unit tests
jest.mock(
  'react-native-qrcode-svg',
  () =>
    ({ value, size }: any) =>
      React.createElement('MockQRCode', { 'data-testid': 'qrcode', value, size }),
);

// Mock react-native-safe-area-context to allow rendering
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, className, style, ...props }: any) =>
    React.createElement('View', { className, style, ...props }, children),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Mock expo-router for Stack and ThemeProvider
jest.mock('expo-router', () => ({
  Stack: (props: any) => {
    return React.createElement('Stack', { screenOptions: props.screenOptions }, props.children);
  },
  ThemeProvider: (props: any) => {
    return React.createElement('ThemeProvider', { value: props.value }, props.children);
  },
  DarkTheme: { isDark: true },
  DefaultTheme: { isDark: false },
}));

// Setup react-native with proper component mocks
jest.mock('react-native', () => {
  const mockReactNative: any = {
    View: ({ children, ...props }: any) => React.createElement('View', props, children),
    Text: ({ children, ...props }: any) => React.createElement('Text', props, children),
    Pressable: ({ children, ...props }: any) => React.createElement('Pressable', props, children),
    ScrollView: ({ children, ...props }: any) => React.createElement('ScrollView', props, children),
    FlatList: ({ data, renderItem, keyExtractor, ListEmptyComponent, ...props }: any) =>
      React.createElement(
        'FlatList',
        props,
        Array.isArray(data)
          ? data.map((item: any, index: number) =>
              React.createElement(
                React.Fragment,
                { key: keyExtractor ? keyExtractor(item, index) : index },
                renderItem({ item, index }),
              ),
            )
          : ListEmptyComponent
            ? React.createElement(
                typeof ListEmptyComponent === 'function'
                  ? ListEmptyComponent
                  : () => ListEmptyComponent,
              )
            : null,
      ),
    ActivityIndicator: ({ size, color }: any) =>
      React.createElement('ActivityIndicator', { size, color }),
    Alert: {
      alert: jest.fn(),
    },
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
    AppState: {
      currentState: 'active',
      addEventListener: jest.fn(() => ({ remove: jest.fn() })),
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
