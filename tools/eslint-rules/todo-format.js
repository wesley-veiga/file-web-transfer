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
    const TODO_TOKEN = /\btodo\b/i;
    const VALID_TODO = /\bTODO\(#\d+\):/;

    return {
      Program() {
        const sourceCode = context.sourceCode ?? context.getSourceCode();
        const comments = sourceCode.getAllComments();

        for (const comment of comments) {
          if (TODO_TOKEN.test(comment.value) && !VALID_TODO.test(comment.value)) {
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
