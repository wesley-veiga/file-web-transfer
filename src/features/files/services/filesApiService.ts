/**
 * Serviço de API para listagem e download de arquivos.
 *
 * Funções puras de negócio que preparam dados para o endpoint HTTP.
 * Sem imports de tipos HTTP (HttpServerRequest, HttpServerResponse, etc.) —
 * isso respeita as boundaries arquiteturais (features não se importam entre si).
 */

import type { FileRepository } from './fileRepository';
import type { FileEntryDto } from '../../../shared/types/api';
import type { FileOrigin } from '../types';

/**
 * Lista arquivos disponíveis para download, ordenados por createdAt desc.
 *
 * @param fileRepository - Repositório de arquivos
 * @param origin - Origem dos arquivos (default: 'shared')
 * @returns Array de FileEntryDto ordenado por createdAt desc
 */
export async function listFilesForApi(
  fileRepository: FileRepository,
  origin: FileOrigin = 'shared',
): Promise<FileEntryDto[]> {
  const entries = await fileRepository.list(origin);

  // Converter para DTO
  const dtos = entries.map((entry) => fileRepository.toDto(entry));

  // Ordenar por createdAt desc (mais recentes primeiro)
  return dtos.sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Obtém informações de um arquivo para download.
 *
 * @param fileRepository - Repositório de arquivos
 * @param id - ID do arquivo a baixar
 * @returns Objeto com localUri, name, mimeType, sizeBytes, linked; null se não encontrado
 */
export async function getFileForDownload(
  fileRepository: FileRepository,
  id: string,
): Promise<{
  localUri: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  linked: boolean;
} | null> {
  // Buscar arquivo em ambos os origins
  const allEntries = await fileRepository.list();
  const entry = allEntries.find((e) => e.id === id);

  if (!entry) {
    return null;
  }

  return {
    localUri: entry.localUri,
    name: entry.name,
    mimeType: entry.mimeType,
    sizeBytes: entry.sizeBytes,
    linked: entry.linked ?? false,
  };
}
