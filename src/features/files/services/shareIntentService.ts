/**
 * Serviço para processar payload de share intent do Android — T-903.
 *
 * Responsabilidades:
 * - Ler URIs de arquivo(s) compartilhado(s) via Intent (chama módulo nativo)
 * - Vincular cada arquivo ao repositório sem duplicar (FileRepository.linkFromUri)
 * - Isolar erro por item: um arquivo inválido não derruba o processamento dos demais
 * - Retornar lista de arquivos vinculados com sucesso + lista de erros isolados
 */

import { NativeModules } from 'react-native';
import type { FileEntry } from '../types';
import type { FileRepository } from './fileRepository';
import { getMimeType } from '../../../shared/lib/mimeTypes';

/**
 * Interface do módulo nativo ShareIntentPayload.
 * Implementação Kotlin em `plugins/withShareIntentPayload.js`.
 */
export interface ShareIntentPayloadModule {
  /**
   * Retorna array de URIs de arquivo(s) compartilhado(s) via Intent.
   * Nunca lança exceção — retorna [] em caso de erro.
   * @returns Promise<string[]> — URIs (ex.: ["content://...", "file://..."])
   */
  getShareIntentPayload(): Promise<string[]>;

  /**
   * Limpa o Intent após consumir o payload.
   * Previne reprocessamento se o app for minimizado e trazido para foreground.
   */
  clearShareIntent(): Promise<void>;
}

/**
 * Resultado do processamento de um URI individual.
 */
export interface ShareIntentItemResult {
  uri: string;
  success: boolean;
  fileEntry?: FileEntry; // presente se success === true
  errorMessage?: string; // presente se success === false
}

/**
 * Resultado completo do processamento de share intent.
 */
export interface ShareIntentProcessResult {
  /** Arquivos vinculados com sucesso */
  files: FileEntry[];
  /** Erros isolados por item (não impedem sucesso dos demais) */
  errors: ShareIntentItemResult[];
  /** true se pelo menos 1 arquivo foi processado com sucesso */
  hasSuccessfulItems: boolean;
}

/**
 * Serviço de processamento de share intent.
 *
 * Expõe uma interface testável que recebe uma implementação do módulo nativo
 * (ou mock em testes) e do repositório de arquivos.
 */
export class ShareIntentService {
  constructor(
    private nativeModule: ShareIntentPayloadModule,
    private fileRepository: FileRepository,
  ) {}

  /**
   * Processa o payload do share intent: lê URIs, valida cada uma, vincula arquivos.
   *
   * Fluxo:
   * 1. Chama `getShareIntentPayload()` para obter array de URIs
   * 2. Para cada URI:
   *    a. Valida e obtém info do arquivo (tamanho, nome, MIME type)
   *    b. Vincula ao repositório via `linkFromUri` (não copia, evita duplicação)
   *    c. Isolamento de erro: falha de um URI não derruba o resto
   * 3. Limpa o Intent nativo para evitar reprocessamento
   * 4. Retorna resultado consolidado (sucessos + erros isolados)
   *
   * @returns Promise<ShareIntentProcessResult>
   */
  async processShareIntent(): Promise<ShareIntentProcessResult> {
    const result: ShareIntentProcessResult = {
      files: [],
      errors: [],
      hasSuccessfulItems: false,
    };

    let uris: string[] = [];
    try {
      uris = await this.nativeModule.getShareIntentPayload();
    } catch (_) {
      // Erro ao chamar o módulo nativo — provavelmente app não foi invocado via Intent
      // Retorna resultado vazio, não falha
      return result;
    }

    // Processa cada URI isoladamente
    for (const uri of uris) {
      try {
        const fileEntry = await this.processShareIntentItem(uri);
        result.files.push(fileEntry);
        result.hasSuccessfulItems = true;
      } catch (error) {
        // Isolamento de erro: registra e continua
        const errorMessage = error instanceof Error ? error.message : String(error);
        result.errors.push({
          uri,
          success: false,
          errorMessage,
        });
      }
    }

    // Limpa o Intent nativo para evitar reprocessar ao trazer o app para foreground novamente
    try {
      await this.nativeModule.clearShareIntent();
    } catch (_) {
      // Log silent — limpeza falhando não invalida o resultado já processado
    }

    return result;
  }

  /**
   * Processa um único URI compartilhado.
   *
   * Valida a URI, obtém metadados (tamanho, nome), e vincula ao repositório.
   *
   * @param uri — URI do arquivo (ex.: "content://...", "file://...")
   * @returns FileEntry vinculado
   * @throws Error se falhar validação, leitura de info ou vinculação
   */
  private async processShareIntentItem(uri: string): Promise<FileEntry> {
    // Valida URI básica
    if (!uri || typeof uri !== 'string' || uri.trim() === '') {
      throw new Error('URI de compartilhamento inválida: string vazia ou nula');
    }

    // Obtém info do arquivo (tamanho, nome)
    const fileInfo = await this.getFileInfo(uri);

    // Extrai nome do arquivo da URI (fallback: "shared_file")
    const desiredName = this.extractFileName(uri, fileInfo.name || 'shared_file');

    // Obtém MIME type
    const mimeType = getMimeType(desiredName);

    // Vincula o arquivo (não copia, origin 'shared')
    const fileEntry = await this.fileRepository.linkFromUri(
      uri,
      desiredName,
      mimeType,
      fileInfo.sizeBytes,
      'shared',
    );

    return fileEntry;
  }

  /**
   * Obtém metadados de um arquivo pela URI.
   *
   * Tenta primeiro via `getInfoAsync` (suporta tanto file:// quanto content://);
   * fallback para valor mínimo válido se falhar (size = 0, name = null).
   *
   * @param uri — URI do arquivo
   * @returns { sizeBytes, name? } — tamanho e nome (este pode estar ausente)
   */
  private async getFileInfo(uri: string): Promise<{ sizeBytes: number; name?: string }> {
    try {
      // Tenta obter info completa via filesystem
      // (nota: expo-file-system suporta tanto file:// quanto content:// URIs no Android)
      const repo = this.fileRepository as unknown;
      const repoWithFs = repo as { fsModule?: { getInfoAsync?: (uri: string) => Promise<unknown> } };
      const info = await repoWithFs.fsModule?.getInfoAsync?.(uri);
      if (info && typeof info === 'object') {
        const infoObj = info as { size?: unknown; name?: unknown };
        return {
          sizeBytes: typeof infoObj.size === 'number' ? infoObj.size : 0,
          name: typeof infoObj.name === 'string' ? infoObj.name : undefined,
        };
      }
    } catch (_) {
      // Falha ao obter info — nota de debug, não falha a vinculação
      // (alguns provedores SAF podem retornar size 0 ou info incompleta)
    }

    // Fallback: arquivo com tamanho 0 (será recalculado later se necessário)
    return { sizeBytes: 0 };
  }

  /**
   * Extrai nome do arquivo de uma URI.
   *
   * Tenta extrair o último componente de qualquer URI:
   * - file:///data/local/tmp/photo.jpg → "photo.jpg"
   * - content://provider/document/photo.jpg → "photo.jpg"
   * - content://provider/1234 → usa fallback (sem extensão legível)
   *
   * @param uri — URI do arquivo
   * @param fallback — nome a usar se não conseguir extrair
   * @returns Nome do arquivo
   */
  private extractFileName(uri: string, fallback: string): string {
    try {
      // Tenta pegar o último componente do path (funciona para file:// e alguns content://)
      const lastComponent = uri.split('/').pop();
      if (lastComponent && lastComponent.trim().length > 0) {
        // Verifica se parece um nome de arquivo legível (contém extensão ou caracteres de nome)
        const hasExtension = lastComponent.includes('.');
        if (hasExtension) {
          return lastComponent;
        }
      }
    } catch {
      // Qualquer erro na extração — usa fallback
    }

    return fallback;
  }
}

/**
 * Factory para criar uma instância do ShareIntentService com a implementação
 * do módulo nativo real.
 *
 * @param fileRepository — repositório de arquivos
 * @returns ShareIntentService com módulo nativo real
 */
export function createShareIntentService(fileRepository: FileRepository): ShareIntentService {
  // Obtém o módulo nativo — retorna {} se não estiver disponível (ex.: iOS, emulador sem suporte)
  const nativeModule: ShareIntentPayloadModule =
    NativeModules.ShareIntentPayload ?? {
      getShareIntentPayload: async () => [],
      clearShareIntent: async () => {},
    };

  return new ShareIntentService(nativeModule, fileRepository);
}
