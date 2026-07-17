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
    // Case-sensitive e ancorado ao início da linha (após remover espaços e o
    // "*" de continuação de comentários de bloco/JSDoc): evita falsos
    // positivos como uma frase que apenas menciona a palavra "todo" (ex.:
    // "menciona a regra todo-format aqui") ou "TODO" no meio do texto.
    const TODO_LINE = /^TODO\b/;
    const VALID_TODO_LINE = /^TODO\(#\d+\):/;

    const normalizeLine = (line) => line.trim().replace(/^\*+\s*/, '');

    return {
      Program() {
        const sourceCode = context.sourceCode ?? context.getSourceCode();
        const comments = sourceCode.getAllComments();

        for (const comment of comments) {
          const lines = comment.value.split('\n');
          const hasBareTodo = lines.some((line) => {
            const normalized = normalizeLine(line);
            return TODO_LINE.test(normalized) && !VALID_TODO_LINE.test(normalized);
          });

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
