/**
 * Setup das rotas de API para listagem, download e upload de arquivos.
 *
 * Este arquivo é o ÚNICO lugar que pode importar de ambas as features:
 * - `features/server` (ApiRouter, HttpModule)
 * - `features/files` (FileRepository)
 * - `shared/lib` (utilidades comuns como multipartStreamParser)
 *
 * Respeita as boundaries arquiteturais: features nunca se importam entre si.
 */

import type {
  HttpServerRequest,
  HttpServerResponse,
  HttpModule,
  HttpUploadChunk,
} from '../features/server/services/httpModule';
import type { ApiRouter, ApiHandler } from '../features/server/services/apiRouter';
import { listFilesForApi, getFileForDownload } from '../features/files/services/filesApiService';
import type { FileRepository } from '../features/files/services/fileRepository';
import type { FileOrigin } from '../features/files/types';
import { fileEntryDtoSchema, apiErrorSchema } from '../shared/types/api';

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

/**
 * Registra a rota POST /api/upload com streaming.
 *
 * Orquestra:
 * - Parser multipart em streaming (chunks incrementais)
 * - Sanitização e anti-duplicata de nome
 * - Escrita incremental de arquivo
 * - Detecção de erros: multipart malformado, arquivo grande demais, sem espaço
 *
 * @param httpModule - Instância do HttpModule para registrar listener de upload
 * @param fileRepository - Repositório para orquestrar escrita em streaming
 * @param maxUploadBytes - Limite de tamanho de upload (ex.: 4GB)
 */
export function registerUploadRoute(
  httpModule: HttpModule,
  fileRepository: FileRepository,
  maxUploadBytes: number,
): void {
  // Importações necessárias
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createMultipartStreamParser } = require('../shared/lib/multipartStreamParser');

  /**
   * Estado de um upload em andamento.
   * Mantém parser, handle de escrita e bytes acumulados.
   */
  interface UploadState {
    parser: ReturnType<typeof createMultipartStreamParser>;
    writeHandle: Awaited<ReturnType<typeof fileRepository.beginStreamedWrite>> | null;
    totalBytes: number;
    lastError: { code: string; message: string } | null;
  }

  // Map para rastrear uploads em andamento por identificador único
  const activeUploads = new Map<string, UploadState>();

  // Counter para gerar IDs de upload únicos
  let uploadIdCounter = 0;

  /**
   * Handler de upload em streaming.
   * Invocado a cada chunk recebido.
   */
  const handleUploadChunk = async (
    chunk: HttpUploadChunk,
    request: Omit<HttpServerRequest, 'body'>,
  ): Promise<HttpServerResponse | void> => {
    // Gerar ID único para este upload (baseado em IP do cliente + contador)
    const clientIp =
      (request.headers['x-forwarded-for'] as string) ||
      (request.headers['host'] as string) ||
      'unknown';
    const uploadId = `${clientIp}-${uploadIdCounter}`;

    // Incrementar counter a cada novo upload
    if (!activeUploads.has(uploadId)) {
      uploadIdCounter += 1;
    }

    let state = activeUploads.get(uploadId);

    // Primeiro chunk: inicializar parser e handle de escrita
    if (!state) {
      // Extrair boundary do header Content-Type
      const contentType = (request.headers['content-type'] as string) || '';
      const boundaryMatch = contentType.match(/boundary=([^\s;]+)/);

      if (!boundaryMatch || !boundaryMatch[1]) {
        return createErrorResponse(400, 'INVALID_MULTIPART', 'Content-Type sem boundary válido');
      }

      const boundary = boundaryMatch[1];
      const parser = createMultipartStreamParser(boundary);

      state = {
        parser,
        writeHandle: null,
        totalBytes: 0,
        lastError: null,
      };

      activeUploads.set(uploadId, state);
    }

    // Se já houve erro neste upload, retornar erro novamente
    if (state.lastError) {
      if (chunk.isLast) {
        activeUploads.delete(uploadId);
      }
      return createErrorResponse(400, state.lastError.code, state.lastError.message);
    }

    try {
      // Alimentar chunk ao parser
      const events = state.parser.feed(chunk.data);

      for (const event of events) {
        switch (event.type) {
          case 'fileStart': {
            // Iniciar escrita em streaming
            try {
              state.writeHandle = await fileRepository.beginStreamedWrite(
                event.filename,
                event.contentType,
                'received',
              );
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Erro desconhecido';
              // Se o erro menciona que o nome é vazio após sanitização, é 422
              if (message.includes('INVALID_FILENAME')) {
                state.lastError = { code: 'INVALID_FILENAME', message };
                return createErrorResponse(422, 'INVALID_FILENAME', 'Nome de arquivo inválido');
              }
              throw error;
            }
            break;
          }

          case 'fileData': {
            if (!state.writeHandle) {
              state.lastError = {
                code: 'INVALID_MULTIPART',
                message: 'Arquivo data sem fileStart',
              };
              return createErrorResponse(400, 'INVALID_MULTIPART', 'Formato multipart inválido');
            }

            // Contar bytes
            state.totalBytes += event.data.length;

            // Verificar limite de tamanho
            if (state.totalBytes > maxUploadBytes) {
              // Abortar escrita
              await state.writeHandle.abort();
              state.lastError = {
                code: 'FILE_TOO_LARGE',
                message: 'Arquivo excede tamanho máximo permitido',
              };
              return createErrorResponse(413, 'FILE_TOO_LARGE', 'Arquivo excede tamanho máximo');
            }

            // Escrever chunk
            try {
              await state.writeHandle.writeChunk(event.data);
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Erro desconhecido';
              // Verificar se é erro de espaço (ENOSPC, storage, etc.)
              if (
                message.toLowerCase().includes('space') ||
                message.toLowerCase().includes('enospc') ||
                message.toLowerCase().includes('storage')
              ) {
                await state.writeHandle.abort();
                state.lastError = {
                  code: 'INSUFFICIENT_STORAGE',
                  message: 'Sem espaço no dispositivo',
                };
                return createErrorResponse(
                  507,
                  'INSUFFICIENT_STORAGE',
                  'Sem espaço no dispositivo',
                );
              }
              throw error;
            }
            break;
          }

          case 'fileEnd': {
            // Arquivo encerrado, aguardar finish() no último chunk
            break;
          }

          case 'malformed': {
            if (state.writeHandle) {
              await state.writeHandle.abort();
            }
            state.lastError = {
              code: 'INVALID_MULTIPART',
              message: 'Corpo multipart malformado',
            };
            return createErrorResponse(400, 'INVALID_MULTIPART', 'Corpo multipart malformado');
          }
        }
      }

      // Se é o último chunk, finalizar parser e escrita
      if (chunk.isLast) {
        const finalEvents = state.parser.finish();

        for (const event of finalEvents) {
          if (event.type === 'malformed') {
            if (state.writeHandle) {
              await state.writeHandle.abort();
            }
            activeUploads.delete(uploadId);
            return createErrorResponse(400, 'INVALID_MULTIPART', 'Corpo multipart malformado');
          }
        }

        // Finalizar escrita e gerar resposta 201
        if (!state.writeHandle) {
          activeUploads.delete(uploadId);
          return createErrorResponse(400, 'INVALID_MULTIPART', 'Sem arquivo no upload');
        }

        const fileEntry = await state.writeHandle.finish(state.totalBytes);
        const fileDto = fileRepository.toDto(fileEntry);

        // Validar DTO contra schema
        const parsed = fileEntryDtoSchema.safeParse(fileDto);
        if (!parsed.success) {
          console.error('[UploadRoute] Erro ao validar FileEntryDto:', parsed.error);
          await state.writeHandle.abort();
          activeUploads.delete(uploadId);
          return createErrorResponse(500, 'INTERNAL_ERROR', 'Erro ao processar arquivo');
        }

        activeUploads.delete(uploadId);
        return createSuccessResponse(201, { file: fileDto });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('[UploadRoute] Erro não tratado:', error);

      if (state.writeHandle) {
        try {
          await state.writeHandle.abort();
        } catch {
          // Ignorar erro ao abortar
        }
      }

      activeUploads.delete(uploadId);
      return createErrorResponse(500, 'INTERNAL_ERROR', message);
    }
  };

  // Registrar listener de upload
  httpModule.addUploadListener('/api/upload', handleUploadChunk);
}
