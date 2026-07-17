module.exports = {
  preset: '@react-native/jest-preset',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react',
      },
    }],
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
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/',
  ],
  // Reseta mock.calls/mock.instances (não a implementação) antes de cada teste, para que
  // testes de features não vazem chamadas registradas nos mocks globais de
  // expo-file-system/expo-network entre casos de teste.
  clearMocks: true,
  // Cobertura mínima (constitution.md, Princípio III):
  // - 80% global (statements/branches/functions/lines).
  // - 90% nas camadas de domínio/serviços: utilitários puros de `shared/lib`, serviços e
  //   stores de cada feature (`features/*/services`, `features/*/store`).
  //
  // Nota: `features/*/services` e `features/*/store` são combinados em uma única chave de
  // glob (com expansão de chaves `{services,store}`) porque o Jest falha com "Coverage data
  // ... was not found" para qualquer chave de threshold que não tenha NENHUM arquivo
  // coberto correspondente — e até a Fase 2 (T-201+) essas pastas só têm `.gitkeep`. Uma
  // chave combinada é satisfeita assim que qualquer uma das duas subpastas tiver arquivos
  // cobertos (ex.: o mock de `features/server/services/serverModule.mock.ts` desta tarefa),
  // e passa a valer para `store/` automaticamente assim que T-201 adicionar código lá — sem
  // precisar reduzir os alvos de 90%/80% da spec.
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80,
    },
    './src/shared/lib/**': {
      statements: 90,
      branches: 90,
      functions: 90,
      lines: 90,
    },
    './src/features/*/{services,store}/**': {
      statements: 90,
      branches: 90,
      functions: 90,
      lines: 90,
    },
  },
};
