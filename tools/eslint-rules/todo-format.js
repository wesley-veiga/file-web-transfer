'use strict';

/**
 * Requires that any `TODO` comment references an issue in the format
 * `TODO(#123): descrição`. Bare `TODO`s (without an issue reference) are
 * rejected — see constitution.md Princípio VII.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Bloqueia comentários TODO sem referência a uma issue (formato TODO(#123): ...)',
      recommended: true,
    },
    schema: [],
    messages: {
      missingIssueReference:
        'Comentários TODO devem referenciar uma issue no formato "TODO(#123): descrição".',
    },
  },
  create(context) {
    // O projeto é pt-BR (constitution.md Seção 4), onde "todo"/"todos"/"toda"
    // são palavras comuns da língua (pronome/adjetivo — "Todos os testes...",
    // "todo arquivo...", "Todo o código..."), não um marcador de pendência.
    // Por isso a detecção exige um sinal explícito e inequívoco de metadado
    // logo após "todo": ":" ou "(" (com ou sem espaço no meio) — é assim que
    // um marcador de pendência real se anuncia ("TODO:", "TODO(#123):").
    // Isso é uma troca consciente: marcadores malformados sem separador em
    // inglês, colados a outra palavra (ex.: "TODOfix", "TODO123"), deixam de
    // ser detectados — mas evitar falsos positivos em prosa natural pt-BR
    // tem prioridade sobre capturar esse caso raro (ver constitution.md
    // Princípio VII e a decisão registrada no PR desta regra).
    const TODO_MARKER_START = /^todo\s*[:(]/i;
    // Validação: sempre case-sensitive e no formato exato exigido.
    const VALID_TODO_LINE = /^TODO\(#\d+\):/;

    const normalizeLine = (line) => line.trim().replace(/^\*+\s*/, '');

    const looksLikeBareTodo = (line) => TODO_MARKER_START.test(line) && !VALID_TODO_LINE.test(line);

    return {
      Program() {
        const sourceCode = context.sourceCode ?? context.getSourceCode();
        const comments = sourceCode.getAllComments();

        for (const comment of comments) {
          const hasBareTodo = comment.value.split('\n').map(normalizeLine).some(looksLikeBareTodo);

          if (hasBareTodo) {
            context.report({
              loc: comment.loc,
              messageId: 'missingIssueReference',
            });
          }
        }
      },
    };
  },
};
