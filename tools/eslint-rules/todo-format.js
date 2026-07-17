'use strict';

/**
 * Requires that any `TODO` comment references an issue in the format
 * `TODO(#123): descrição`. Bare `TODO`s (without an issue reference) are
 * rejected — see constitution.md Princípio VII.
 *
 * LIMITAÇÃO CONHECIDA (decisão deliberada, não é um bug pendente): a
 * detecção é uma heurística best-effort, não uma gramática formal — ela
 * balanceia dois falsos positivos/negativos concorrentes (prosa pt-BR vs.
 * marcadores TODO malformados) e há variantes residuais que escapam de
 * ambos os caminhos de detecção (ex.: um único caractere colado entre
 * "todo" e o separador, como "TODOX:" ou "todo123:"). Essa regra é uma
 * conveniência de feedback rápido local (pre-commit) — ela NÃO é, e não
 * pretende ser, à prova de bypass adversarial ou de typos incomuns. A
 * garantia formal de que todo TODO tem issue associada vem do pipeline de
 * CI (T-004) e da proteção de branch (T-006), não deste hook isolado.
 * Não abrir novas rodadas de ajuste de regex para perseguir cobertura
 * perfeita aqui — ver decisão registrada no histórico de commits desta
 * regra.
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
    // Em pt-BR essas palavras nunca aparecem inteiramente em MAIÚSCULAS como
    // prosa natural — "TODO" all-caps (as 4 letras) só existe como convenção
    // de marcador; já "Todo"/"Todos" (só a inicial maiúscula) é capitalização
    // normal de início de frase. Por isso um comentário é candidato a
    // marcador por qualquer um destes dois caminhos independentes:
    //
    // 1. Começa com "TODO" exatamente em maiúsculas, e o caractere seguinte
    //    não é outra letra maiúscula (evita casar "TODOLIST", que é uma
    //    palavra/sigla diferente, não um TODO seguido de outra coisa).
    // 2. Começa com "todo" em qualquer capitalização, seguido (direto ou com
    //    espaço no meio) de ":" ou "(" — sinal explícito de metadado, como um
    //    marcador de pendência real se anuncia ("todo:", "TODO(#123):").
    //
    // O caminho 1 cobre inclusive marcadores malformados colados a outra
    // palavra/dígito sem separador (ex.: "TODO fix later", "TODOfix",
    // "TODO123") sem reintroduzir falsos positivos em pt-BR, porque "Todo"
    // com capitalização de frase nunca bate no regex case-sensitive.
    const TODO_MARKER_UPPERCASE = /^TODO(?![A-Z])/;
    const TODO_MARKER_SEPARATOR = /^todo\s*[:(]/i;
    // Validação: sempre case-sensitive e no formato exato exigido.
    const VALID_TODO_LINE = /^TODO\(#\d+\):/;

    const normalizeLine = (line) => line.trim().replace(/^\*+\s*/, '');

    const looksLikeBareTodo = (line) =>
      (TODO_MARKER_UPPERCASE.test(line) || TODO_MARKER_SEPARATOR.test(line)) &&
      !VALID_TODO_LINE.test(line);

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
