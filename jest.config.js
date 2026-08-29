const tsJestTransform = {
  '^.+\\.tsx?$': [
    'ts-jest',
    {
      tsconfig: {
        jsx: 'react',
      },
      isolatedModules: true,
    },
  ],
};

module.exports = {
  projects: [
    {
      displayName: 'app',
      preset: '@react-native/jest-preset',
      testEnvironment: 'node',
      transform: tsJestTransform,
      transformIgnorePatterns: [
        'node_modules/(?!(expo|expo-router|expo-splash-screen|expo-font|expo-notifications|expo-modules-core|expo-device|expo-sharing|react-native|@react-native|react-native-screens|react-native-gesture-handler|react-native-reanimated|react-native-web|react-native-safe-area-context|react-native-tcp-socket)/)',
      ],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@/assets/(.*)$': '<rootDir>/assets/$1',
        '^expo-notifications$': '<rootDir>/__mocks__/expo-notifications.ts',
        '^expo-device$': '<rootDir>/__mocks__/expo-device.ts',
        '^expo-sharing$': '<rootDir>/__mocks__/expo-sharing.ts',
        // Mesmo mock de `expo-file-system` cobre `/legacy` — o subpath não é auto-detectado
        // pela convenção `__mocks__/<pacote>.ts` do Jest (só cobre o especificador exato).
        '^expo-file-system/legacy$': '<rootDir>/__mocks__/expo-file-system.ts',
        '\\.(css|less|scss|sass)$': '<rootDir>/__mocks__/styleMock.js',
      },
      setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
      // Testes `*.jsdom.test.ts` rodam no project "web-ui" abaixo (ambiente jsdom puro,
      // sem o preset do React Native, que conflita com `window` do jsdom).
      testPathIgnorePatterns: ['/node_modules/', '\\.jsdom\\.test\\.ts$'],
      clearMocks: true,
    },
    {
      // Projeto isolado para testar o comportamento client-side do HTML/JS embutido em
      // `src/web-ui/webUiHtml.ts` (T-502+): roda num ambiente jsdom real, sem o preset do
      // React Native (cujo `setup.js` tenta redefinir `window`, o que conflita com o
      // `window` que o próprio jsdom já define — daí o project separado).
      displayName: 'web-ui',
      testEnvironment: 'jsdom',
      testEnvironmentOptions: {
        // Necessário para o jsdom executar as tags <script> ao carregar o HTML via
        // `document.write` — por padrão o jsdom não roda nenhum script, por segurança.
        runScripts: 'dangerously',
        url: 'http://localhost/',
      },
      transform: tsJestTransform,
      testMatch: ['<rootDir>/src/web-ui/**/*.jsdom.test.ts'],
      clearMocks: true,
    },
  ],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts', '!src/**/__tests__/**'],
  coveragePathIgnorePatterns: ['/node_modules/', '/__tests__/'],
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
