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
    // Prosa pt-BR com "todo/todos/toda" como pronome/adjetivo (não marcador
    // de pendência) — o projeto é pt-BR (constitution.md Seção 4), então
    // esses casos NUNCA podem ser bloqueados. Reprodução real reportada
    // pelo validador: um comentário assim foi rejeitado incorretamente pelo
    // hook de pre-commit antes desta correção.
    {
      name: 'prosa pt-BR: "Todos os testes..." não é um marcador de pendência',
      code: '// Todos os testes desta função devem cobrir os casos de borda.\nconst a = 1;',
    },
    {
      name: 'prosa pt-BR: "todo arquivo..." não é um marcador de pendência',
      code: '// todo arquivo deve ser sanitizado\nconst a = 1;',
    },
    {
      name: 'prosa pt-BR: "Todo o código..." não é um marcador de pendência',
      code: '// Todo o código deve ter testes\nconst a = 1;',
    },
    // Troca consciente (ver comentário na implementação da regra): exigir
    // ":" ou "(" logo após "todo" para evitar falsos positivos em pt-BR
    // tem como efeito colateral aceito não capturar mais marcadores em
    // inglês malformados sem separador (colados a outra palavra/dígito).
    {
      name: '[troca consciente] "TODO123" sem separador não é mais detectado como marcador malformado',
      code: '// TODO123 fix later\nconst a = 1;',
    },
    {
      name: '[troca consciente] "TODOfix" sem separador não é mais detectado como marcador malformado',
      code: '// TODOfix later\nconst a = 1;',
    },
    {
      name: '[troca consciente] "TODO-123:" (hífen antes do separador) não é mais detectado como marcador malformado',
      code: '// TODO-123: fix later\nconst a = 1;',
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
      name: '//TODO sem espaço após as barras também é detectado',
      code: '//TODO: fix later\nconst a = 1;',
      errors: [{ messageId: 'missingIssueReference' }],
    },
    {
      name: 'TODO (#123): com espaço antes do parêntese é detectado como candidato mas não bate o formato exato',
      code: '// TODO (#123): fix later\nconst a = 1;',
      errors: [{ messageId: 'missingIssueReference' }],
    },
    {
      name: 'comentário de bloco JSDoc multi-linha com TODO: sem referência de issue é inválido',
      code: '/**\n * TODO: revisar depois\n */\nconst a = 1;',
      errors: [{ messageId: 'missingIssueReference' }],
    },
  ],
});
