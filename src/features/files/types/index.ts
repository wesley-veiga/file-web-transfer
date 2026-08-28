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
}

/** Reutiliza a definição exportada de shared/types/api (não duplicar). */
export type { FileEntryDto } from '../../../shared/types/api';
