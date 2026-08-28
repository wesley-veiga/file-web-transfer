/**
 * Rastreador de mudanças na lista de arquivos.
 *
 * Responsabilidade: manter o timestamp (epoch ms) da última mudança
 * na lista de arquivos (upload concluído, arquivo removido, etc.).
 *
 * Usado por:
 * - GET /api/events: retorna o timestamp para a web-ui saber se há mudanças
 * - POST /api/upload: marca como alterado ao concluir um upload
 *
 * A injeção da função `now` permite testes determinísticos.
 */

/**
 * Interface do rastreador de mudanças.
 */
export interface FilesChangedAtTracker {
  /**
   * Marca "agora" como o momento da última mudança na lista de arquivos.
   * Chamado quando um arquivo é adicionado ou removido.
   */
  touch: () => void;

  /**
   * Retorna o timestamp (epoch ms) da última mudança.
   * Inicial: o momento em que o tracker foi criado.
   */
  get: () => number;
}

/**
 * Cria um novo rastreador de mudanças.
 *
 * @param now - Função que retorna o timestamp atual (epoch ms).
 *             Padrão: Date.now. Injetável para testes determinísticos.
 * @returns Instância de FilesChangedAtTracker
 */
export function createFilesChangedAtTracker(now: () => number = Date.now): FilesChangedAtTracker {
  // Estado inicial: momento da criação
  let lastChangedAt = now();

  return {
    touch: () => {
      lastChangedAt = now();
    },

    get: () => lastChangedAt,
  };
}
