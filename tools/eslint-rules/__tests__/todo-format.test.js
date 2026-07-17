'use strict';

/**
 * Teste de fumaça (RuleTester) para a regra ESLint local que bloqueia
 * comentários de pendência sem referência a uma issue (formato exigido:
 * "TODO(#123): descrição" — ver constitution.md Princípio VII).
 *
 * O arquivo desta regra fica em tools/eslint-rules/ (fora de src/), por isso
 * não conta para os thresholds de cobertura do Jest configurados em
 * jest.config.js (`collectCoverageFrom`), mas segue sendo código de produção
 * usado por eslint.config.js e precisa de teste — Princípio III.
 *
 * RuleTester.run() registra suas próprias chamadas de describe/it usando os
 * globals do Jest (ver node_modules/eslint/lib/rule-tester/rule-tester.js),
 * por isso é chamado diretamente no escopo do módulo, sem aninhar em outro
 * it().
 */

const { RuleTester } = require('eslint');
const rule = require('../todo-format');

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
});

ruleTester.run('local/todo-format', rule, {
  valid: [
    {
      name: 'TODO(#123): descrição — referência de issue com dois-pontos é válida',
      code: '// TODO(#123): implementar validação de tamanho máximo\nconst a = 1;',
    },
    {
      name: 'comentário sem a palavra reservada de pendência não é reportado',
      code: '// nada a ver com pendências\nconst a = 1;',
    },
    {
      name: 'comentário de bloco com TODO(#1): referência válida também é aceito',
      code: '/* TODO(#1): revisar depois */\nconst a = 1;',
    },
    {
      name: 'menção à palavra "todo" fora de posição de marcador (ex.: nome da própria regra) não é reportada',
      code: '// menciona a regra todo-format aqui\nconst a = 1;',
    },
    {
      name: '"TODO" no meio do texto (não ancorado ao início do comentário) não é reportado',
      code: '// isto não é um TODO de verdade, apenas prosa\nconst a = 1;',
    },
    {
      name: 'TODOLIST: palavra que continua em maiúsculas após "TODO" é outra palavra, não um marcador',
      code: '// TODOLIST: fix later\nconst a = 1;',
    },
    {
      name: 'comentário de bloco JSDoc multi-linha com TODO(#5): no formato correto é aceito',
      code: '/**\n * TODO(#5): revisar depois\n */\nconst a = 1;',
    },
  ],
  invalid: [
    {
      name: 'comentário de pendência sem referência de issue é inválido',
      code: '// TODO: texto\nconst a = 1;',
      errors: [{ messageId: 'missingIssueReference' }],
    },
    {
      name: 'comentário de pendência com issue mas sem dois-pontos é inválido',
      code: '// TODO(#12) texto sem dois-pontos\nconst a = 1;',
      errors: [{ messageId: 'missingIssueReference' }],
    },
    {
      name: 'todo: minúsculo e sem referência é inválido (case-insensitive na detecção)',
      code: '// todo: lowercase bare\nconst a = 1;',
      errors: [{ messageId: 'missingIssueReference' }],
    },
    {
      name: 'TODO123: dígito colado logo após TODO é um marcador malformado',
      code: '// TODO123 fix later\nconst a = 1;',
      errors: [{ messageId: 'missingIssueReference' }],
    },
    {
      name: 'TODOfix: palavra minúscula colada logo após TODO é um marcador malformado',
      code: '// TODOfix later\nconst a = 1;',
      errors: [{ messageId: 'missingIssueReference' }],
    },
    {
      name: 'TODO-123: referência estilo ticket com hífen não é o formato exigido',
      code: '// TODO-123: fix later\nconst a = 1;',
      errors: [{ messageId: 'missingIssueReference' }],
    },
    {
      name: '//TODO sem espaço após as barras também é detectado',
      code: '//TODO: fix later\nconst a = 1;',
      errors: [{ messageId: 'missingIssueReference' }],
    },
    {
      name: 'comentário de bloco JSDoc multi-linha com TODO: sem referência de issue é inválido',
      code: '/**\n * TODO: revisar depois\n */\nconst a = 1;',
      errors: [{ messageId: 'missingIssueReference' }],
    },
  ],
});
