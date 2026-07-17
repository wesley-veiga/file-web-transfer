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
    // Detecção: case-insensitive (pega "todo", "Todo", "TODO"...) e ancorada
    // ao início da linha (após remover espaços e o "*" de continuação de
    // comentários de bloco/JSDoc) — evita falsos positivos como uma frase
    // que apenas menciona a palavra "todo" no meio do texto (ex.: "menciona
    // a regra todo-format aqui").
    const TODO_PREFIX = /^todo/i;
    // Validação: sempre case-sensitive e no formato exato exigido.
    const VALID_TODO_LINE = /^TODO\(#\d+\):/;

    const normalizeLine = (line) => line.trim().replace(/^\*+\s*/, '');

    /**
     * Decide se uma linha já normalizada parece um marcador de pendência
     * (válido ou não). O caractere logo após "todo" é o que desambigua:
     * - nada (fim da linha) → é só "todo", não há como estar no formato
     *   válido.
     * - letra maiúscula → continua como outra palavra/sigla em maiúsculas
     *   (ex.: "TODOLIST"), não é um marcador de pendência.
     * - ":" "(" ou espaço → separador plausível de marcador; só é válido no
     *   formato exato TODO(#123):.
     * - qualquer outra coisa colada logo em seguida (dígito, letra
     *   minúscula, hífen…) → marcador malformado/informal (ex.: "TODO123",
     *   "TODOfix", "TODO-123:").
     */
    const looksLikeBareTodo = (line) => {
      const match = TODO_PREFIX.exec(line);
      if (!match) {
        return false;
      }

      const rest = line.slice(match[0].length);
      const nextChar = rest.charAt(0);

      if (nextChar === '') {
        return true;
      }
      if (/[A-Z]/.test(nextChar)) {
        return false;
      }
      if (/[:(\s]/.test(nextChar)) {
        return !VALID_TODO_LINE.test(line);
      }
      return true;
    };

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
