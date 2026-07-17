// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');
const boundaries = require('eslint-plugin-boundaries');
const localRules = require('./tools/eslint-rules');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    plugins: {
      local: localRules,
    },
    rules: {
      // Princípio VII — TODO sem issue associada é bloqueado (formato exigido: TODO(#123): ...).
      'local/todo-format': 'error',
    },
  },
  {
    // jest.setup.ts define mocks globais de módulos nativos (não é um componente de UI real);
    // a regra react/display-name não se aplica a fábricas de mock inline.
    files: ['jest.setup.ts'],
    rules: {
      'react/display-name': 'off',
    },
  },
  {
    // Código do app (não scripts de CLI/tooling, que legitimamente usam console.* para saída).
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    rules: {
      // Princípio VII — código morto e `console.log` bloqueados; `console.warn`/`console.error`
      // seguem liberados para reportar problemas reais em runtime.
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Código do app, mesmo escopo que `expo lint` cobre por padrão (src/, app/, components/).
    // Arquivos de configuração/tooling na raiz (jest.setup.ts, babel.config.js…) ficam de fora
    // do Princípio II, que rege o código do produto.
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      // Princípio II — TypeScript estrito: `any` é proibido.
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  // Princípio IV — Arquitetura feature-first com camadas explícitas.
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      boundaries,
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: './tsconfig.json',
        },
      },
      'boundaries/elements': [
        { type: 'app', pattern: 'src/app/**', partialMatch: false },
        {
          type: 'feature',
          pattern: 'src/features/*/**',
          capture: ['feature'],
          partialMatch: false,
        },
        { type: 'shared', pattern: 'src/shared/**', partialMatch: false },
        { type: 'web-ui', pattern: 'src/web-ui/**', partialMatch: false },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            // src/app pode importar de features e de shared.
            {
              from: { element: { types: 'app' } },
              allow: { to: { element: { types: { anyOf: ['feature', 'shared'] } } } },
            },
            // features podem importar de shared...
            {
              from: { element: { types: 'feature' } },
              allow: { to: { element: { types: 'shared' } } },
            },
            // ...e de si mesmas, mas NUNCA de outra feature.
            {
              from: { element: { types: 'feature' } },
              allow: {
                to: { element: { types: 'feature', captured: { feature: '{{from.feature}}' } } },
              },
            },
            // shared NUNCA importa de features nem de app (nenhuma política allow definida
            // para from: shared — o default "disallow" cobre esse caso).
          ],
        },
      ],
    },
  },
  // Prettier sempre por último: desativa regras de formatação que conflitariam com ele.
  prettierConfig,
]);
