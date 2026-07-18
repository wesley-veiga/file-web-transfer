module.exports = {
  preset: '@react-native/jest-preset',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react',
        },
      },
    ],
  },
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
  transformIgnorePatterns: [
    'node_modules/(?!(expo|expo-router|expo-splash-screen|expo-font|react-native|@react-native|react-native-screens|react-native-gesture-handler|react-native-reanimated|react-native-web|react-native-safe-area-context)/)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts', '!src/**/__tests__/**'],
  coveragePathIgnorePatterns: ['/node_modules/', '/__tests__/'],
};
