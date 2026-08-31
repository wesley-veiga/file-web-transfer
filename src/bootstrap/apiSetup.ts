/**
 * Setup das rotas de API para listagem, download e upload de arquivos.
 *
 * Este arquivo é o ÚNICO lugar que pode importar de três features:
 * - `features/server` (ApiRouter, HttpModule)
 * - `features/files` (FileRepository)
 * - `features/transfer` (TransferStore — instrumentação de progresso, T-602)
 * - `shared/lib` (utilidades comuns como multipartStreamParser)
 *
 * Respeita as boundaries arquiteturais: features nunca se importam entre si.
 */

import { Buffer } from 'buffer';
import type {
  HttpServerRequest,
  HttpServerResponse,
  HttpServerRequestHandler,
  HttpModule,
  HttpUploadChunk,
} from '../features/server/services/httpModule';
import type { ApiRouter, ApiHandler } from '../features/server/services/apiRouter';
import { listFilesForApi, getFileForDownload } from '../features/files/services/filesApiService';
import type { FileRepository } from '../features/files/services/fileRepository';
import type { FileOrigin } from '../features/files/types';
import { fileEntryDtoSchema, apiErrorSchema } from '../shared/types/api';
import type { FilesChangedAtTracker } from '../shared/lib/filesChangedAtTracker';
import { createMultipartStreamParser } from '../shared/lib/multipartStreamParser';
import { WEB_UI_HTML } from '../web-ui/webUiHtml';
import { useTransferStore } from '../features/transfer/store/transferStore';
import type { TransferStore } from '../features/transfer/store/transferStore';

/**
 * Fatia do `TransferStore` (T-601) usada pela instrumentação das rotas (T-602).
 *
 * Só as ações de escrita usadas por upload/download — nunca o estado `transfers`
 * em si, que as rotas não precisam ler. Injetável (em vez de importar
 * `useTransferStore` direto nos handlers) para que o `testador` consiga mockar
 * sem depender da instância Zustand global.
 */
export type TransferStoreActions = Pick<
  TransferStore,
  'enqueue' | 'start' | 'reportProgress' | 'complete' | 'fail'
>;

/** IP de fallback quando o transporte não consegue determinar o IP remoto do peer. */
const UNKNOWN_PEER_IP = 'desconhecido';

/** Throttle mínimo entre chamadas a `reportProgress` durante um upload (T-602). */
const PROGRESS_REPORT_THROTTLE_MS = 500;

/**
 * Registra as rotas de listagem e download de arquivos no ApiRouter.
 *
 * @param apiRouter - Instância do ApiRouter a configurar
 * @param fileRepository - Instância do FileRepository para acessar arquivos
 * @param fsModule - Módulo de filesystem para ler conteúdo de arquivos (injetável para testes)
 * @param transferStore - Ações do TransferStore usadas para instrumentar o progresso do
 *   download (T-602). Padrão: instância de produção (`useTransferStore.getState()`).
 *   Injetável para o `testador` mockar sem depender do Zustand global.
 */
export function registerFileRoutes(
  apiRouter: ApiRouter,
  fileRepository: FileRepository,
  fsModule: {
    readAsStringAsync: (uri: string, options?: { encoding?: 'utf8' | 'base64' }) => Promise<string>;
  },
  transferStore: TransferStoreActions = useTransferStore.getState(),
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
    request: HttpServerRequest,
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

      // Instrumentação T-602: enfileira a transferência assim que o arquivo é
      // encontrado. NOTA DE ESCOPO: esta rota lê o arquivo inteiro de uma vez
      // (`fsModule.readAsStringAsync`, sem streaming real — ver T-405); por isso
      // não há progresso incremental possível aqui. `transferredBytes` só é
      // conhecido de uma vez, no sucesso (= sizeBytes) ou na falha (= 0). Uma
      // refatoração de streaming de download fica fora do escopo de T-602.
      const transferId = transferStore.enqueue({
        direction: 'download',
        fileName: fileInfo.name,
        sizeBytes: fileInfo.sizeBytes,
        peerIp: request.remoteAddress ?? UNKNOWN_PEER_IP,
      });
      transferStore.start(transferId);

      // Ler conteúdo do arquivo como base64 e decodificar para bytes reais.
      //
      // Achado em T-701 (teste manual em dispositivo real): ler com
      // `readAsStringAsync(uri)` sem `encoding` usa UTF-8 por padrão
      // (`expo-file-system/legacy`) — qualquer byte que não forme uma sequência
      // UTF-8 válida (a maioria dos bytes de um arquivo binário real, como
      // jpeg/mov) é substituído/perdido na decodificação, corrompendo o arquivo
      // antes mesmo de sair pela rede. `{ encoding: 'base64' }` lê os bytes
      // exatos sem reinterpretá-los como texto.
      let fileBuffer: Buffer;
      try {
        const base64Content = await fsModule.readAsStringAsync(fileInfo.localUri, {
          encoding: 'base64',
        });
        fileBuffer = Buffer.from(base64Content, 'base64');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro desconhecido';
        console.error(`[FileRoutes] Erro ao ler arquivo ${fileId} (${fileInfo.localUri}):`, error);
        transferStore.fail(transferId, message);
        return createErrorResponse(500, 'INTERNAL_ERROR', `Erro ao ler arquivo: ${message}`);
      }

      // Codificar nome do arquivo para RFC 5987 (UTF-8)
      // Formato: filename*=UTF-8''<nome-encodado>
      const encodedFileName = encodeURIComponent(fileInfo.name);
      const contentDisposition = `attachment; filename*=UTF-8''${encodedFileName}`;

      // Leitura atômica bem-sucedida: reporta o total de uma vez (não há chunks
      // incrementais nesta rota, ver nota de escopo acima) e conclui.
      transferStore.reportProgress(transferId, fileInfo.sizeBytes);
      transferStore.complete(transferId);

      // Retornar arquivo com headers corretos.
      // Nota: lê o arquivo inteiro em memória (sem streaming real — ver nota de
      // escopo acima); `body` é o Buffer de bytes exatos decodificado acima,
      // nunca uma string re-interpretada como texto (T-701).
      return {
        statusCode: 200,
        headers: {
          'Content-Type': fileInfo.mimeType,
          'Content-Length': String(fileInfo.sizeBytes),
          'Content-Disposition': contentDisposition,
        },
        body: fileBuffer,
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
 * Registra a rota que serve a interface web (T-501) em `GET /`.
 *
 * Diferente de `registerFileRoutes`/`registerEventsRoute` (que registram rotas no
 * `ApiRouter`, cujo catch-all fica em `/api`), esta rota é registrada diretamente no
 * `HttpModule` com `addListener('/', ...)`. Por causa do roteamento por "prefixo mais
 * longo" (ver `nativeHttpModule.ts`, função `findHandler`), qualquer path que não bata
 * com um prefixo mais específico já registrado (como `/api`) cai neste handler — ou
 * seja, `addListener('/', ...)` funciona como um catch-all "estático" que serve a
 * página para qualquer rota de navegação, já que não há mais nenhuma outra rota
 * estática no servidor.
 *
 * @param httpModule - Instância do HttpModule para registrar o listener da web-ui
 */
export function registerWebUiRoute(httpModule: HttpModule): void {
  const handleGetWebUi: HttpServerRequestHandler = async (
    request: HttpServerRequest,
  ): Promise<HttpServerResponse> => {
    if (request.method !== 'GET') {
      return {
        statusCode: 405,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', Allow: 'GET' },
        body: 'Method Not Allowed',
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: WEB_UI_HTML,
    };
  };

  httpModule.addListener('/', handleGetWebUi);
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
 * @param tracker - Rastreador de mudanças; tocado ao concluir um upload com sucesso,
 *   para que GET /api/events reflita a mudança na próxima consulta de polling.
 * @param transferStore - Ações do TransferStore usadas para instrumentar o progresso do
 *   upload (T-602). Padrão: instância de produção (`useTransferStore.getState()`).
 *   Injetável para o `testador` mockar sem depender do Zustand global.
 * @param now - Relógio injetável (epoch ms) usado só para o throttle de
 *   `reportProgress` (no mínimo a cada 500 ms de tempo real, nunca a cada chunk).
 *   Padrão: `Date.now`. Injetável para o `testador` controlar tempo determinístico.
 */
export function registerUploadRoute(
  httpModule: HttpModule,
  fileRepository: FileRepository,
  maxUploadBytes: number,
  tracker: FilesChangedAtTracker,
  transferStore: TransferStoreActions = useTransferStore.getState(),
  now: () => number = Date.now,
): void {
  /**
   * Estado de um upload em andamento.
   * Mantém parser, handle de escrita e bytes acumulados.
   */
  interface UploadState {
    parser: ReturnType<typeof createMultipartStreamParser>;
    writeHandle: Awaited<ReturnType<typeof fileRepository.beginStreamedWrite>> | null;
    totalBytes: number;
    lastError: { statusCode: number; code: string; message: string } | null;
    /** Id da transferência no TransferStore (T-602); null até o evento `fileStart`. */
    transferId: string | null;
    /** epoch ms da última chamada a `reportProgress` — controla o throttle de 500ms. */
    lastProgressReportAt: number;
  }

  /**
   * Reporta progresso ao TransferStore respeitando o throttle mínimo de
   * `PROGRESS_REPORT_THROTTLE_MS` — chamado a cada `fileData`, mas só emite de
   * fato quando tempo real suficiente se passou desde a última emissão. `set()`
   * do Zustand é síncrono e barato; o throttle existe para não sobrecarregar a
   * UI, não porque a chamada em si seja lenta (não bloqueia o processamento do
   * chunk em nenhum dos dois casos).
   *
   * @param force - Ignora o throttle (usado na última chamada, ao concluir).
   */
  function reportProgressThrottled(state: UploadState, force = false): void {
    if (!state.transferId) {
      return;
    }
    const timestamp = now();
    if (!force && timestamp - state.lastProgressReportAt < PROGRESS_REPORT_THROTTLE_MS) {
      return;
    }
    state.lastProgressReportAt = timestamp;
    transferStore.reportProgress(state.transferId, state.totalBytes);
  }

  /**
   * Registra uma falha: guarda `lastError` (para short-circuit de chunks
   * seguintes do mesmo upload) e propaga ao TransferStore, se a transferência
   * já havia sido enfileirada (`fileStart` já recebido).
   */
  function failUpload(
    state: UploadState,
    statusCode: number,
    code: string,
    message: string,
  ): HttpServerResponse {
    state.lastError = { statusCode, code, message };
    if (state.transferId) {
      transferStore.fail(state.transferId, message);
    }
    return createErrorResponse(statusCode, code, message);
  }

  // Map para rastrear uploads em andamento por identificador único (chunk.requestId)
  const activeUploads = new Map<string, UploadState>();

  /**
   * Handler de upload em streaming.
   * Invocado a cada chunk recebido.
   */
  const handleUploadChunk = async (
    chunk: HttpUploadChunk,
    request: Omit<HttpServerRequest, 'body'>,
  ): Promise<HttpServerResponse | void> => {
    // Correlacionar chunks do mesmo upload via requestId (estável entre chunks,
    // gerado pelo módulo nativo) — nunca inferir isso de IP/headers, que não
    // distingue uploads concorrentes do mesmo cliente.
    const uploadId = chunk.requestId;

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
        transferId: null,
        lastProgressReportAt: 0,
      };

      activeUploads.set(uploadId, state);
    }

    // Se já houve erro neste upload, retornar erro novamente (fail() já foi
    // reportado ao TransferStore na primeira ocorrência, não repetir)
    if (state.lastError) {
      if (chunk.isLast) {
        activeUploads.delete(uploadId);
      }
      return createErrorResponse(
        state.lastError.statusCode,
        state.lastError.code,
        state.lastError.message,
      );
    }

    try {
      // Alimentar chunk ao parser
      const events = state.parser.feed(chunk.data);

      for (const event of events) {
        switch (event.type) {
          case 'fileStart': {
            // T-602: enfileira a transferência assim que o primeiro chunk chega
            // (identifica o arquivo), antes mesmo de abrir o handle de escrita —
            // assim falhas em beginStreamedWrite (ex.: 422) também aparecem no
            // TransferStore. sizeBytes fica null: o Content-Length do request é
            // do corpo multipart inteiro (inclui boundaries/headers), não do
            // arquivo em si — reportar isso como sizeBytes induziria a UI a
            // erro (progresso nunca bateria 100% antes de completar).
            state.transferId = transferStore.enqueue({
              direction: 'upload',
              fileName: event.filename,
              sizeBytes: null,
              peerIp: request.remoteAddress ?? UNKNOWN_PEER_IP,
            });
            transferStore.start(state.transferId);

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
                return failUpload(state, 422, 'INVALID_FILENAME', 'Nome de arquivo inválido');
              }
              throw error;
            }
            break;
          }

          case 'fileData': {
            if (!state.writeHandle) {
              return failUpload(state, 400, 'INVALID_MULTIPART', 'Formato multipart inválido');
            }

            // Contar bytes
            state.totalBytes += event.data.length;

            // Verificar limite de tamanho
            if (state.totalBytes > maxUploadBytes) {
              // Abortar escrita
              await state.writeHandle.abort();
              return failUpload(
                state,
                413,
                'FILE_TOO_LARGE',
                'Arquivo excede tamanho máximo permitido',
              );
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
                return failUpload(state, 507, 'INSUFFICIENT_STORAGE', 'Sem espaço no dispositivo');
              }
              throw error;
            }

            // T-602: reporta progresso ao store, respeitando o throttle de 500ms
            // (comparação de timestamps, nunca setTimeout/setInterval — não
            // atrasa o processamento do chunk em si).
            reportProgressThrottled(state);
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
            return failUpload(state, 400, 'INVALID_MULTIPART', 'Corpo multipart malformado');
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
            return failUpload(state, 400, 'INVALID_MULTIPART', 'Corpo multipart malformado');
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
          return failUpload(state, 500, 'INTERNAL_ERROR', 'Erro ao processar arquivo');
        }

        // T-602: reporta o total final (ignora o throttle — é a última emissão)
        // e conclui a transferência.
        reportProgressThrottled(state, true);
        if (state.transferId) {
          transferStore.complete(state.transferId);
        }

        activeUploads.delete(uploadId);
        tracker.touch();
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
      return failUpload(state, 500, 'INTERNAL_ERROR', message);
    }
  };

  // Registrar listener de upload
  httpModule.addUploadListener('/api/upload', handleUploadChunk);
}
