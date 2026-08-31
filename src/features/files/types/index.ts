/**
 * Tipos de domínio da feature de arquivos.
 *
 * Não reutiliza FileEntryDto (que é apenas a projeção pública via API);
 * FileEntry é o modelo interno com localUri (nunca exposto pela API).
 */

/** Origem do arquivo: recebido de um convidado via upload, ou compartilhado pelo host. */
export type FileOrigin = 'received' | 'shared';

/** Modelo interno de um arquivo gerenciado pelo repositório. */
export interface FileEntry {
  /** UUID estável durante a sessão. */
  id: string;

  /** Nome sanitizado (sem path, sem caracteres de controle). */
  name: string;

  /** Tamanho em bytes. */
  sizeBytes: number;

  /** MIME type (ex.: "application/pdf", "application/octet-stream" quando desconhecido). */
  mimeType: string;

  /** URI local no sandbox do app (NUNCA exposto na API). */
  localUri: string;

  /** Origem do arquivo. */
  origin: FileOrigin;

  /** Timestamp da criação (epoch ms). */
  createdAt: number;

  /**
   * `true` quando `localUri` aponta para um arquivo que o app NÃO copiou para a
   * sandbox (ex.: vinculado de uma pasta via Storage Access Framework, T-701) —
   * o app não é dono do arquivo. `remove()` de uma entrada vinculada só apaga o
   * registro de metadados (desvincula); nunca chama `deleteAsync` no arquivo
   * real do usuário. Ausente/`false` para entradas normais (copiadas via
   * `save()`/`saveFromUri()`/`beginStreamedWrite()`), que o app criou e possui.
   */
  linked?: boolean;
}

/** Reutiliza a definição exportada de shared/types/api (não duplicar). */
export type { FileEntryDto } from '../../../shared/types/api';
