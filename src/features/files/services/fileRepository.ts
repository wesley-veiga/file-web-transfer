/**
 * Repositório de arquivos — interface e implementação.
 *
 * Gerencia leitura, escrita e metadados de arquivos no sandbox do app.
 * Usa `expo-file-system` sob o capô; injeção de dependência permite mockar em testes.
 *
 * Responsabilidades:
 * - Salvar arquivo em `received/` (aplicando sanitização e resolução de duplicata)
 * - Listar arquivos existentes
 * - Remover arquivo por id
 * - Mapear FileEntry → FileEntryDto (nunca expor localUri)
 */

import * as Crypto from 'expo-crypto';
import type * as FileSystem from 'expo-file-system/legacy'; // Tipos apenas; runtime usará expo-file-system via injeção

import { sanitizeFileName, resolveDuplicateName } from '../../../shared/lib';
import type { FileEntryDto } from '../../../shared/types/api';
import type { FileEntry, FileOrigin } from '../types';

/** Interface do módulo `expo-file-system` (injetável para testes). */
export interface FileSystemModule {
  documentDirectory?: string;
  getInfoAsync: typeof FileSystem.getInfoAsync;
  readDirectoryAsync: typeof FileSystem.readDirectoryAsync;
  makeDirectoryAsync: typeof FileSystem.makeDirectoryAsync;
  writeAsStringAsync: typeof FileSystem.writeAsStringAsync;
  readAsStringAsync: typeof FileSystem.readAsStringAsync;
  deleteAsync: typeof FileSystem.deleteAsync;
  copyAsync: typeof FileSystem.copyAsync;
  moveAsync: typeof FileSystem.moveAsync;

  /**
   * Anexa conteúdo ao final do arquivo em `uri`, criando-o se não existir.
   * Usado para escrita incremental (streaming de upload).
   *
   * Implementação em produção usa API nova de `expo-file-system` (File/FileHandle),
   * não a legacy; permite append eficiente sem bufferizar o corpo inteiro.
   *
   * @param uri - URI do arquivo
   * @param content - Conteúdo a anexar (string)
   * @throws Se falhar ao escrever (sem espaço, permissão, etc.)
   */
  appendToFileAsync: (uri: string, content: string) => Promise<void>;
}

/**
 * Serviço de repositório de arquivos.
 *
 * Interface pública que define operações sobre o repositório.
 */
export interface FileRepository {
  /**
   * Salva um novo arquivo no repositório.
   *
   * Aplica sanitização de nome e resolução de duplicata contra arquivos
   * existentes do mesmo origin. O arquivo é escrito em `received/` ou `shared/`
   * conforme `origin`.
   *
   * @param content - Conteúdo do arquivo (UTF-8)
   * @param desiredName - Nome desejado (será sanitizado)
   * @param mimeType - MIME type (ex.: "application/pdf")
   * @param origin - Origem do arquivo
   * @returns FileEntry criado com id, name final (após resolução), timestamp
   * @throws Error se falhar ao criar diretório ou escrever arquivo
   */
  save: (
    content: string,
    desiredName: string,
    mimeType: string,
    origin: FileOrigin,
  ) => Promise<FileEntry>;

  /**
   * Salva um novo arquivo no repositório a partir de um URI local.
   *
   * Útil para arquivos selecionados via document picker ou galeria, já que
   * esses retornam URIs locais (não conteúdo em memória).
   *
   * Aplica sanitização de nome e resolução de duplicata, assim como `save()`.
   *
   * @param sourceUri - URI local do arquivo a copiar (ex.: do document picker)
   * @param desiredName - Nome desejado (será sanitizado)
   * @param mimeType - MIME type (ex.: "application/pdf")
   * @param sizeBytes - Tamanho do arquivo em bytes
   * @param origin - Origem do arquivo
   * @returns FileEntry criado com id, name final (após resolução), timestamp
   * @throws Error se falhar ao criar diretório, copiar arquivo ou atualizar metadados
   */
  saveFromUri: (
    sourceUri: string,
    desiredName: string,
    mimeType: string,
    sizeBytes: number,
    origin: FileOrigin,
  ) => Promise<FileEntry>;

  /**
   * Lista todos os arquivos do repositório.
   *
   * @param origin - Filtra por origem (opcional; se omitido, retorna todos)
   * @returns Array de FileEntry
   */
  list: (origin?: FileOrigin) => Promise<FileEntry[]>;

  /**
   * Remove um arquivo pelo id.
   *
   * @param id - ID do arquivo a remover
   * @throws Error se arquivo não existir ou falhar ao deletar
   */
  remove: (id: string) => Promise<void>;

  /**
   * Mapeia um FileEntry para seu DTO público (remove localUri e origin).
   *
   * @param entry - FileEntry interno
   * @returns FileEntryDto segura para exposição via API
   */
  toDto: (entry: FileEntry) => FileEntryDto;

  /**
   * Inicia uma escrita em streaming: sanitiza o nome, resolve duplicata,
   * cria o arquivo vazio, e retorna um handle para escrever chunks e finalizar.
   *
   * Orquestra sanitização/anti-duplicata reutilizando a lógica de `save()` e `saveFromUri()`,
   * mas para uploads em streaming onde não conhecemos o tamanho total até o fim.
   *
   * @param desiredName - Nome desejado (será sanitizado; se ficar vazio, lança erro)
   * @param mimeType - MIME type do arquivo (ex.: "application/octet-stream")
   * @param origin - Origem do arquivo ('received' ou 'shared')
   * @returns Handle de escrita com métodos para escrever chunks, finalizar e abortar
   * @throws Error se o nome sanitizado ficar vazio (caller deve mapear para 422 INVALID_FILENAME)
   */
  beginStreamedWrite: (
    desiredName: string,
    mimeType: string,
    origin: FileOrigin,
  ) => Promise<{
    /** ID único do arquivo (uuid) */
    id: string;
    /** Nome final do arquivo após sanitização e resolução de duplicata */
    finalName: string;
    /**
     * Escreve um chunk de dados ao arquivo.
     * Pode ser chamado múltiplas vezes até que `finish()` seja chamado.
     * @param data - Dados brutos (string) a anexar ao arquivo
     */
    writeChunk: (data: string) => Promise<void>;
    /**
     * Finaliza a escrita e grava metadados.
     * Deve ser chamado uma única vez após todos os chunks terem sido escritos.
     * @param sizeBytes - Tamanho total do arquivo em bytes
     * @returns FileEntry completado com metadados gravados
     */
    finish: (sizeBytes: number) => Promise<FileEntry>;
    /**
     * Aborta a escrita (em caso de erro, por exemplo).
     * Deleta o arquivo parcial e não grava metadados.
     */
    abort: () => Promise<void>;
  }>;
}

/**
 * Implementação concreta do FileRepository.
 *
 * Todos os arquivos são armazenados com metadados em JSON dentro de cada
 * diretório de origem (`received/`, `shared/`). A estrutura de diretórios:
 *
 * ```
 * documentDirectory/
 *   received/
 *     .meta.json        ← lista de {id, name, sizeBytes, mimeType, localUri, createdAt}
 *     <file1>           ← conteúdo
 *     <file2>
 *   shared/
 *     .meta.json
 *     <file3>
 * ```
 *
 * Injeção de dependência permite mockar expo-file-system em testes.
 */
export class FileRepositoryImpl implements FileRepository {
  private readonly fsModule: FileSystemModule;
  private readonly baseDir: string;
  private readonly receivedDir: string;
  private readonly sharedDir: string;
  private readonly metaFileName = '.meta.json';

  constructor(fsModule: FileSystemModule) {
    this.fsModule = fsModule;
    this.baseDir = fsModule.documentDirectory || 'file:///document/';
    this.receivedDir = this.baseDir.replace(/\/$/, '') + '/received';
    this.sharedDir = this.baseDir.replace(/\/$/, '') + '/shared';
  }

  async save(
    content: string,
    desiredName: string,
    mimeType: string,
    origin: FileOrigin,
  ): Promise<FileEntry> {
    // Preparar diretório de destino
    const targetDir = origin === 'received' ? this.receivedDir : this.sharedDir;
    await this.ensureDirectoryExists(targetDir);

    // Sanitizar nome e resolver duplicata
    const finalName = await this.resolveFinalName(targetDir, desiredName);

    // Gerar id
    const id = Crypto.randomUUID();
    const localUri = targetDir.replace(/\/$/, '') + '/' + finalName;
    const createdAt = Date.now();

    // Escrever conteúdo do arquivo
    await this.fsModule.writeAsStringAsync(localUri, content);

    // Obter tamanho real do arquivo escrito (não usar Buffer.byteLength, que não existe em React Native)
    let sizeBytes = 0;
    try {
      const fileInfo = await this.fsModule.getInfoAsync(localUri);
      // `FileInfo` é uma union discriminada por `exists`; quando true, `size` já vem
      // narrowed pelo TypeScript, sem necessidade de cast.
      if (fileInfo.exists) {
        sizeBytes = fileInfo.size;
      }
    } catch {
      // Se getInfoAsync falhar, usar 0 como fallback (arquivo foi escrito, mas não conseguimos ler o tamanho)
      sizeBytes = 0;
    }

    const entry: FileEntry = {
      id,
      name: finalName,
      sizeBytes,
      mimeType,
      localUri,
      origin,
      createdAt,
    };

    // Carregar metadados existentes, adicionar entrada, salvar
    const metadata = await this.loadMetadata(targetDir);
    metadata.push({
      id,
      name: finalName,
      sizeBytes,
      mimeType,
      localUri,
      createdAt,
    });
    await this.saveMetadata(targetDir, metadata);

    return entry;
  }

  async saveFromUri(
    sourceUri: string,
    desiredName: string,
    mimeType: string,
    sizeBytes: number,
    origin: FileOrigin,
  ): Promise<FileEntry> {
    // Preparar diretório de destino
    const targetDir = origin === 'received' ? this.receivedDir : this.sharedDir;
    await this.ensureDirectoryExists(targetDir);

    // Sanitizar nome e resolver duplicata
    const finalName = await this.resolveFinalName(targetDir, desiredName);

    // Gerar id e criar FileEntry
    const id = Crypto.randomUUID();
    const localUri = targetDir.replace(/\/$/, '') + '/' + finalName;
    const createdAt = Date.now();

    const entry: FileEntry = {
      id,
      name: finalName,
      sizeBytes,
      mimeType,
      localUri,
      origin,
      createdAt,
    };

    // Copiar arquivo do sourceUri para o destino
    await this.fsModule.copyAsync({
      from: sourceUri,
      to: localUri,
    });

    // Carregar metadados existentes, adicionar entrada, salvar
    const metadata = await this.loadMetadata(targetDir);
    metadata.push({
      id,
      name: finalName,
      sizeBytes,
      mimeType,
      localUri,
      createdAt,
    });
    await this.saveMetadata(targetDir, metadata);

    return entry;
  }

  async list(origin?: FileOrigin): Promise<FileEntry[]> {
    const results: FileEntry[] = [];

    // Listar recebidos se solicitado (ou se origin não especificado)
    if (!origin || origin === 'received') {
      const receivedEntries = await this.listFromDir(this.receivedDir, 'received');
      results.push(...receivedEntries);
    }

    // Listar compartilhados se solicitado (ou se origin não especificado)
    if (!origin || origin === 'shared') {
      const sharedEntries = await this.listFromDir(this.sharedDir, 'shared');
      results.push(...sharedEntries);
    }

    return results;
  }

  async remove(id: string): Promise<void> {
    // Procurar o arquivo em ambos os diretórios
    const allEntries = await this.list();
    const entry = allEntries.find((e) => e.id === id);

    if (!entry) {
      throw new Error(`File with id ${id} not found`);
    }

    // Determinar diretório
    const targetDir = entry.origin === 'received' ? this.receivedDir : this.sharedDir;

    // Deletar arquivo
    await this.fsModule.deleteAsync(entry.localUri);

    // Atualizar metadados
    const metadata = await this.loadMetadata(targetDir);
    const updated = metadata.filter((m) => m.id !== id);
    await this.saveMetadata(targetDir, updated);
  }

  toDto(entry: FileEntry): FileEntryDto {
    return {
      id: entry.id,
      name: entry.name,
      sizeBytes: entry.sizeBytes,
      mimeType: entry.mimeType,
      createdAt: entry.createdAt,
    };
  }

  async beginStreamedWrite(
    desiredName: string,
    mimeType: string,
    origin: FileOrigin,
  ): Promise<{
    id: string;
    finalName: string;
    writeChunk: (data: string) => Promise<void>;
    finish: (sizeBytes: number) => Promise<FileEntry>;
    abort: () => Promise<void>;
  }> {
    // Sanitizar nome e resolver duplicata
    const sanitized = sanitizeFileName(desiredName);
    if (!sanitized || sanitized === '') {
      throw new Error('Nome sanitizado vazio (INVALID_FILENAME)');
    }

    const targetDir = origin === 'received' ? this.receivedDir : this.sharedDir;
    await this.ensureDirectoryExists(targetDir);

    const existingNames = await this.getExistingNames(targetDir);
    const finalName = resolveDuplicateName(sanitized, existingNames);

    // Gerar id e criar arquivo vazio
    const id = Crypto.randomUUID();
    const localUri = targetDir.replace(/\/$/, '') + '/' + finalName;

    // Criar arquivo vazio inicialmente
    await this.fsModule.writeAsStringAsync(localUri, '');

    // Retornar handle de escrita
    return {
      id,
      finalName,
      writeChunk: async (data: string) => {
        await this.fsModule.appendToFileAsync(localUri, data);
      },
      finish: async (sizeBytes: number) => {
        const createdAt = Date.now();

        const entry: FileEntry = {
          id,
          name: finalName,
          sizeBytes,
          mimeType,
          localUri,
          origin,
          createdAt,
        };

        // Carregar metadados existentes, adicionar entrada, salvar
        const metadata = await this.loadMetadata(targetDir);
        metadata.push({
          id,
          name: finalName,
          sizeBytes,
          mimeType,
          localUri,
          createdAt,
        });
        await this.saveMetadata(targetDir, metadata);

        return entry;
      },
      abort: async () => {
        try {
          await this.fsModule.deleteAsync(localUri);
        } catch {
          // Se falhar ao deletar, é ok — arquivo parcial pode ser deixado
        }
      },
    };
  }

  /**
   * Sanitiza o nome desejado e resolve duplicatas.
   * Helper privado compartilhado por `save()` e `saveFromUri()`.
   */
  private async resolveFinalName(targetDir: string, desiredName: string): Promise<string> {
    // Sanitizar nome
    const sanitized = sanitizeFileName(desiredName);

    // Resolver duplicata
    const existingFiles = await this.getExistingNames(targetDir);
    return resolveDuplicateName(sanitized, existingFiles);
  }

  /**
   * Garante que um diretório existe, criando-o se necessário.
   */
  private async ensureDirectoryExists(dirUri: string): Promise<void> {
    try {
      const info = await this.fsModule.getInfoAsync(dirUri);
      if (!info.exists || !info.isDirectory) {
        await this.fsModule.makeDirectoryAsync(dirUri, { intermediates: true });
      }
    } catch {
      // Se getInfoAsync falhar, tenta criar (pode não existir ainda)
      await this.fsModule.makeDirectoryAsync(dirUri, { intermediates: true });
    }
  }

  /**
   * Obtém lista de nomes de arquivos existentes em um diretório.
   * Exclui o arquivo de metadados (.meta.json).
   */
  private async getExistingNames(dirUri: string): Promise<string[]> {
    try {
      const files = await this.fsModule.readDirectoryAsync(dirUri);
      return files.filter((f) => f !== this.metaFileName);
    } catch {
      // Diretório não existe ou vazio
      return [];
    }
  }

  /**
   * Carrega o array de metadados do arquivo .meta.json do diretório.
   * Retorna [] se não existir.
   */
  private async loadMetadata(dirUri: string): Promise<Omit<FileEntry, 'origin'>[]> {
    const metaPath = dirUri.replace(/\/$/, '') + '/' + this.metaFileName;

    try {
      const content = await this.fsModule.readAsStringAsync(metaPath);
      return JSON.parse(content);
    } catch {
      // Arquivo não existe ou está corrompido
      return [];
    }
  }

  /**
   * Salva o array de metadados no arquivo .meta.json do diretório.
   */
  private async saveMetadata(dirUri: string, metadata: Omit<FileEntry, 'origin'>[]): Promise<void> {
    const metaPath = dirUri.replace(/\/$/, '') + '/' + this.metaFileName;
    const content = JSON.stringify(metadata, null, 2);
    await this.fsModule.writeAsStringAsync(metaPath, content);
  }

  /**
   * Lista todos os arquivos de um diretório específico, carregando metadados.
   */
  private async listFromDir(dirUri: string, origin: FileOrigin): Promise<FileEntry[]> {
    try {
      const metadata = await this.loadMetadata(dirUri);
      return metadata.map((m) => ({
        ...m,
        origin,
      }));
    } catch {
      return [];
    }
  }
}
