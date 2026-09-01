/**
 * Compartilhar por pasta sem duplicar (T-701 — achado de teste manual).
 *
 * Wrapper fino sobre `StorageAccessFramework` (`expo-file-system/legacy` —
 * só existe lá, o pacote base `expo-file-system` NUNCA a exportou nesta versão
 * do SDK, ao contrário do que a documentação genérica sugere) para:
 * - Pedir permissão de acesso a uma pasta externa escolhida pelo usuário.
 * - Listar os arquivos (não subpastas) dessa pasta.
 *
 * `StorageAccessFramework.readDirectoryAsync()` só retorna URIs — nem nome
 * nem MIME type. `extractFileNameFromUri`/`guessMimeTypeFromName` derivam os
 * dois a partir da própria URI, já que não há outra fonte disponível sem
 * copiar o arquivo (o que este recurso existe justamente para evitar).
 *
 * Escrita não faz parte deste módulo de propósito: `StorageAccessFramework`
 * não suporta append/streaming (só reescreve o conteúdo inteiro de uma vez),
 * então os arquivos vinculados por aqui NUNCA são escritos pelo app — só
 * lidos no download, via `FileRepository.linkFromUri()` (não copia).
 */

import { StorageAccessFramework, getInfoAsync } from 'expo-file-system/legacy';
import type * as FileSystemLegacy from 'expo-file-system/legacy';

/** Interface mínima injetável (testável sem SAF real). */
export interface FolderSharingModule {
  requestDirectoryPermissionsAsync: typeof StorageAccessFramework.requestDirectoryPermissionsAsync;
  readDirectoryAsync: typeof StorageAccessFramework.readDirectoryAsync;
  /**
   * `getInfoAsync` NÃO é reexportado por `StorageAccessFramework` (só
   * `writeAsStringAsync`/`readAsStringAsync`/`deleteAsync`/`moveAsync`/
   * `copyAsync` têm alias lá) — usamos o `getInfoAsync` de nível superior do
   * módulo legacy, cuja doc já cobre URIs `file://` e SAF.
   */
  getInfoAsync: typeof FileSystemLegacy.getInfoAsync;
}

/** Módulo padrão de produção, usando a API SAF real. */
export function createDefaultFolderSharingModule(): FolderSharingModule {
  return {
    requestDirectoryPermissionsAsync: StorageAccessFramework.requestDirectoryPermissionsAsync,
    readDirectoryAsync: StorageAccessFramework.readDirectoryAsync,
    getInfoAsync,
  };
}

export interface FolderFile {
  /** URI SAF do arquivo — usado como `sourceUri` em `FileRepository.linkFromUri()`. */
  uri: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
}

/** Extensão → MIME type, para os tipos mais comuns de arquivos compartilhados. */
const EXTENSION_MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  mkv: 'video/x-matroska',
  pdf: 'application/pdf',
  txt: 'text/plain',
  zip: 'application/zip',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

/**
 * Deriva o nome de exibição a partir de uma URI SAF.
 *
 * Ex.: `content://.../document/primary%3ADownload%2Ffoto.jpg` → `foto.jpg`.
 * O último segmento de path (após decodificar `%XX`) normalmente contém o
 * "document id" no formato `<volume>:<caminho>/<nome>` — pegamos só o nome.
 */
export function extractFileNameFromUri(uri: string): string {
  const segments = uri.split('/');
  const lastSegment = segments[segments.length - 1];

  let decoded: string;
  try {
    decoded = decodeURIComponent(lastSegment);
  } catch {
    decoded = lastSegment;
  }

  const decodedParts = decoded.split('/');
  return decodedParts[decodedParts.length - 1] || decoded;
}

/** Infere o MIME type pela extensão do nome; `application/octet-stream` se desconhecida/ausente. */
export function guessMimeTypeFromName(name: string): string {
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex === -1) {
    return 'application/octet-stream';
  }
  const ext = name.slice(dotIndex + 1).toLowerCase();
  return EXTENSION_MIME_TYPES[ext] ?? 'application/octet-stream';
}

/**
 * Pede ao usuário para escolher uma pasta e conceder acesso via SAF.
 * @returns URI da pasta escolhida, ou `null` se o usuário negou/cancelou.
 */
export async function requestFolderAccess(
  module: Pick<FolderSharingModule, 'requestDirectoryPermissionsAsync'>,
): Promise<string | null> {
  const result = await module.requestDirectoryPermissionsAsync();
  return result.granted ? result.directoryUri : null;
}

/**
 * Lista os arquivos (não subpastas) de uma pasta vinculada via SAF.
 *
 * Arquivos que falharem ao ler informação (`getInfoAsync`) são ignorados
 * silenciosamente — não devem derrubar a listagem inteira por causa de um
 * item problemático (ex.: link simbólico quebrado).
 */
/**
 * Consulta `getInfoAsync` para um único item, convertendo-o em `FolderFile`
 * (ou `null` se for diretório/inexistente/erro). Isolado nesta função para
 * poder ser disparado em paralelo por `listFolderFiles` sem perder o
 * comportamento de "item problemático não derruba a listagem inteira".
 */
async function resolveFolderFile(
  module: Pick<FolderSharingModule, 'getInfoAsync'>,
  uri: string,
): Promise<FolderFile | null> {
  try {
    const info = await module.getInfoAsync(uri);
    if (!info.exists || info.isDirectory) {
      return null;
    }
    const name = extractFileNameFromUri(uri);
    return {
      uri,
      name,
      mimeType: guessMimeTypeFromName(name),
      sizeBytes: info.size,
    };
  } catch {
    // Ignora item problemático; não propaga para o Promise.all.
    return null;
  }
}

/**
 * Todas as chamadas de `getInfoAsync` disparam em paralelo (`Promise.all`),
 * em vez de sequencialmente uma por vez. Uma pasta SAF com centenas/milhares
 * de arquivos levava minutos no padrão sequencial anterior — tempo o
 * suficiente para o app ficar em primeiro plano ocupado (ou passar por
 * transição de estado) e o servidor cair (achado real em uso, T-807). Sem
 * limite de concorrência deliberadamente: cada chamada é uma única
 * invocação de método nativo via bridge (não abre socket/handle de arquivo
 * persistente), e o próprio `readDirectoryAsync` já materializa a lista
 * inteira de URIs em memória antes desta função rodar — não há razão para
 * limitar quantas promessas ficam pendentes ao mesmo tempo.
 */
export async function listFolderFiles(
  module: Pick<FolderSharingModule, 'readDirectoryAsync' | 'getInfoAsync'>,
  directoryUri: string,
): Promise<FolderFile[]> {
  const uris = await module.readDirectoryAsync(directoryUri);
  const results = await Promise.all(uris.map((uri) => resolveFolderFile(module, uri)));
  return results.filter((file): file is FolderFile => file !== null);
}
