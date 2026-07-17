// Mock expo-splash-screen
jest.mock('expo-splash-screen', () => ({
  hideAsync: jest.fn().mockResolvedValue(undefined),
  preventAutoHideAsync: jest.fn().mockResolvedValue(undefined),
}));

// Mock react-native useColorScheme
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  StyleSheet: { create: (styles: any) => styles },
  useColorScheme: () => 'light',
  SafeAreaView: 'SafeAreaView',
}));

// Mock expo-router
jest.mock('expo-router', () => ({
  Stack: ({ children, screenOptions }: any) => children,
  ThemeProvider: ({ children }: any) => children,
  DarkTheme: {},
  DefaultTheme: {},
}));
