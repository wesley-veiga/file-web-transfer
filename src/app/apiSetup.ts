/**
 * Setup das rotas de API para listagem e download de arquivos.
 *
 * Este arquivo é o ÚNICO lugar que pode importar de ambas as features:
 * - `features/server` (ApiRouter)
 * - `features/files` (FileRepository)
 *
 * Respeita as boundaries arquiteturais: features nunca se importam entre si.
 */

import type { HttpServerRequest, HttpServerResponse } from '../features/server/services/httpModule';
import type { ApiRouter, ApiHandler } from '../features/server/services/apiRouter';
import { listFilesForApi, getFileForDownload } from '../features/files/services/filesApiService';
import type { FileRepository } from '../features/files/services/fileRepository';
import type { FileOrigin } from '../features/files/types';
import { fileEntryDtoSchema, apiErrorSchema } from '../shared/types/api';
import type { FilesChangedAtTracker } from '../shared/lib/filesChangedAtTracker';

/**
 * Registra as rotas de listagem e download de arquivos no ApiRouter.
 *
 * @param apiRouter - Instância do ApiRouter a configurar
 * @param fileRepository - Instância do FileRepository para acessar arquivos
 * @param fsModule - Módulo de filesystem para ler conteúdo de arquivos (injetável para testes)
 */
export function registerFileRoutes(
  apiRouter: ApiRouter,
  fileRepository: FileRepository,
  fsModule: { readAsStringAsync: (uri: string) => Promise<string> },
): void {
  // GET /api/files — Listar arquivos disponíveis para download
  const handleListFiles: ApiHandler = async (
    _request: HttpServerRequest,
    _params: Record<string, string>,
    query: Record<string, string>,
  ): Promise<HttpServerResponse> => {
    try {
      // Extrair query parameter 'origin', default 'shared'
      const originParam = query['origin'] ?? 'shared';
      const origin = originParam as FileOrigin;

      // Validar que origin é válido
      if (origin !== 'shared' && origin !== 'received') {
        return createErrorResponse(400, 'INVALID_QUERY', `Parâmetro 'origin' inválido: ${origin}`);
      }

      // Listar arquivos
      const files = await listFilesForApi(fileRepository, origin);

      // Validar que cada arquivo bate no schema
      const parsed = fileEntryDtoSchema.array().safeParse(files);
      if (!parsed.success) {
        console.error('[FileRoutes] Erro ao validar lista de arquivos:', parsed.error);
        return createErrorResponse(500, 'INTERNAL_ERROR', 'Erro ao listar arquivos');
      }

      // Retornar resposta
      return createSuccessResponse(200, { files });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('[FileRoutes] Erro em GET /api/files:', error);
      return createErrorResponse(500, 'INTERNAL_ERROR', message);
    }
  };

  // GET /api/files/:id/download — Baixar arquivo
  const handleDownloadFile: ApiHandler = async (
    _request: HttpServerRequest,
    params: Record<string, string>,
    _query: Record<string, string>,
  ): Promise<HttpServerResponse> => {
    try {
      const fileId = params['id'];

      if (!fileId) {
        return createErrorResponse(400, 'INVALID_ID', 'ID do arquivo não fornecido');
      }

      // Buscar arquivo no repositório
      const fileInfo = await getFileForDownload(fileRepository, fileId);

      if (!fileInfo) {
        return createErrorResponse(404, 'FILE_NOT_FOUND', 'Arquivo não encontrado ou foi removido');
      }

      // Ler conteúdo do arquivo
      let fileContent: string;
      try {
        fileContent = await fsModule.readAsStringAsync(fileInfo.localUri);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro desconhecido';
        console.error(`[FileRoutes] Erro ao ler arquivo ${fileId} (${fileInfo.localUri}):`, error);
        return createErrorResponse(500, 'INTERNAL_ERROR', `Erro ao ler arquivo: ${message}`);
      }

      // Codificar nome do arquivo para RFC 5987 (UTF-8)
      // Formato: filename*=UTF-8''<nome-encodado>
      const encodedFileName = encodeURIComponent(fileInfo.name);
      const contentDisposition = `attachment; filename*=UTF-8''${encodedFileName}`;

      // Retornar arquivo com headers corretos
      // Nota: simulando streaming via base64, já que HttpServerResponse não suporta stream real
      // (este é um trade-off de escopo mencionado no relatório final)
      return {
        statusCode: 200,
        headers: {
          'Content-Type': fileInfo.mimeType,
          'Content-Length': String(fileInfo.sizeBytes),
          'Content-Disposition': contentDisposition,
        },
        body: fileContent,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('[FileRoutes] Erro em GET /api/files/:id/download:', error);
      return createErrorResponse(500, 'INTERNAL_ERROR', message);
    }
  };

  // Registrar as rotas no ApiRouter
  apiRouter.addRoute('GET', '/api/files', handleListFiles);
  apiRouter.addRoute('GET', '/api/files/:id/download', handleDownloadFile);
}

/**
 * Registra a rota de eventos de polling para atualizações de arquivos.
 *
 * GET /api/events: retorna o timestamp da última mudança na lista de arquivos.
 * Usado pela web-ui para fazer polling a cada 3s e saber se precisa refazer GET /api/files.
 *
 * @param apiRouter - Instância do ApiRouter a configurar
 * @param tracker - Rastreador de mudanças de arquivos
 */
export function registerEventsRoute(apiRouter: ApiRouter, tracker: FilesChangedAtTracker): void {
  // GET /api/events — Atualizações da sessão (polling)
  const handleGetEvents: ApiHandler = async (
    _request: HttpServerRequest,
    _params: Record<string, string>,
    _query: Record<string, string>,
  ): Promise<HttpServerResponse> => {
    try {
      // `since` é lido pela web-ui só para decidir se refaz GET /api/files — o
      // servidor não precisa comparar nada, sempre retorna o filesChangedAt atual.
      const filesChangedAt = tracker.get();

      return createSuccessResponse(200, { filesChangedAt });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('[EventsRoute] Erro em GET /api/events:', error);
      return createErrorResponse(500, 'INTERNAL_ERROR', message);
    }
  };

  // Registrar a rota no ApiRouter
  apiRouter.addRoute('GET', '/api/events', handleGetEvents);
}

/**
 * Registra a rota de upload em streaming para recebimento de arquivos.
 *
 * Esta função será implementada por T-403.
 * Importante: ao concluir um upload com sucesso (201), deve chamar tracker.touch()
 * para notificar que a lista de arquivos foi alterada.
 *
 * @param httpModule - Instância do HttpModule (usado para registro de streaming upload)
 * @param fileRepository - Instância do FileRepository para armazenar arquivos
 * @param maxUploadBytes - Tamanho máximo de upload em bytes
 * @param tracker - Rastreador de mudanças (chamado ao concluir upload)
 *
 * Expected signature (T-403):
 * ```
 * export function registerUploadRoute(
 *   httpModule: HttpModule,
 *   fileRepository: FileRepository,
 *   maxUploadBytes: number,
 *   tracker: FilesChangedAtTracker,
 * ): void
 * ```
 *
 * When T-403 is implemented, it should call `tracker.touch()` right after
 * returning a successful 201 response for a completed upload.
 */

/**
 * Cria uma resposta de sucesso (JSON).
 */
function createSuccessResponse(statusCode: number, data: unknown): HttpServerResponse {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(data),
  };
}

/**
 * Cria uma resposta de erro no envelope apiErrorSchema.
 */
function createErrorResponse(
  statusCode: number,
  code: string,
  message: string,
): HttpServerResponse {
  const error = {
    error: {
      code,
      message,
    },
  };

  // Validar o envelope contra o schema Zod
  const parsed = apiErrorSchema.safeParse(error);
  if (!parsed.success) {
    console.error('[FileRoutes] Erro ao validar ApiError:', parsed.error);
    // Fallback: retorna um envelope simples sem validação
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        error: { code: 'INTERNAL_ERROR', message: 'Erro ao serializar erro' },
      }),
    };
  }

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(error),
  };
}
