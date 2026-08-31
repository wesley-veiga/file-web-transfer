/**
 * Fiação real do servidor HTTP embarcado, chamada uma única vez no boot do app (T-405).
 *
 * Este arquivo, assim como `apiSetup.ts`, é o único lugar autorizado a importar de
 * `features/server` E `features/files` simultaneamente (ver `apiSetup.ts` para o
 * racional completo das boundaries).
 *
 * Responsabilidades:
 * - Instanciar o `HttpModule` real (`nativeHttpModule.ts`, T-405) e registrá-lo via
 *   `setHttpModule()`, para que `createServerService()` deixe de lançar
 *   "HttpModule não foi inicializado".
 * - Montar o `ApiRouter` uma única vez, ANTES de qualquer `ServerService.start()`
 *   acontecer — por isso `ApiRouterConfig.getSessionId` é uma função (lê o
 *   sessionId atual) em vez de um valor fixo (ver `apiRouter.ts`).
 * - Registrar as rotas de arquivos/upload/eventos (`apiSetup.ts`) no roteador.
 */

import * as FileSystemLegacy from 'expo-file-system/legacy';
import { setHttpModule } from '../features/server/services/serverServiceFactory';
import { createDefaultHttpModule } from '../features/server/services/nativeHttpModule';
import { createApiRouter } from '../features/server/services/apiRouterFactory';
import { createFileRepository } from '../features/files/services/fileRepositoryFactory';
import { createFilesChangedAtTracker } from '../shared/lib/filesChangedAtTracker';
import { generateSessionId } from '../shared/lib';
import {
  registerFileRoutes,
  registerUploadRoute,
  registerEventsRoute,
  registerWebUiRoute,
} from './apiSetup';

/**
 * Limite máximo de upload em bytes.
 *
 * Valor alinhado ao usado nos testes existentes de `apiRouter`/`apiRouterFactory`
 * (`maxUploadBytes: 4294967296`), que já convencionavam 4 GiB como o limite de
 * referência do projeto (ver também o comentário `@param maxUploadBytes` de
 * `registerUploadRoute` em `apiSetup.ts`, que cita "ex.: 4GB").
 */
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024 * 1024; // 4 GiB

/**
 * Versão do app exibida em `GET /api/session`.
 *
 * Não há, hoje, nenhuma constante única de versão consumida em runtime a partir de
 * `app.json`/`package.json` (ambos declaram "1.0.0"); usamos esse valor literal e
 * mantemos os três em sincronia manualmente até que exista necessidade de os unificar.
 */
const APP_VERSION = '1.0.0';

let initialized = false;

/** Caixa mutável do sessionId atual, lida por `ApiRouterConfig.getSessionId`. */
const sessionIdBox = { current: generateSessionId() };

/** Retorna o sessionId atualmente ativo (da última sessão do servidor iniciada). */
export function getCurrentSessionId(): string {
  return sessionIdBox.current;
}

/**
 * Atualiza o sessionId ativo.
 *
 * Deve ser chamado sempre que `ServerServiceImpl.start()` gerar um novo sessionId
 * (isto é, sempre que `serverInfo.sessionId` mudar no `serverStore`), para que
 * `GET /api/session` reflita a sessão em andamento mesmo com o `ApiRouter` montado
 * uma única vez no boot.
 */
export function setCurrentSessionId(sessionId: string): void {
  sessionIdBox.current = sessionId;
}

/**
 * Inicializa o servidor HTTP embarcado: cria o `HttpModule` real, monta o `ApiRouter`
 * e registra todas as rotas. Idempotente — chamadas repetidas após a primeira são
 * ignoradas.
 */
export function initServer(): void {
  if (initialized) {
    return;
  }
  initialized = true;

  const httpModule = createDefaultHttpModule();
  setHttpModule(httpModule);

  const apiRouter = createApiRouter({
    getSessionId: () => sessionIdBox.current,
    appVersion: APP_VERSION,
    maxUploadBytes: MAX_UPLOAD_BYTES,
  });
  apiRouter.register(httpModule);

  const fileRepository = createFileRepository();
  const tracker = createFilesChangedAtTracker();

  registerFileRoutes(apiRouter, fileRepository, {
    readAsStringAsync: FileSystemLegacy.readAsStringAsync,
  });
  registerEventsRoute(apiRouter, tracker);
  registerUploadRoute(httpModule, fileRepository, MAX_UPLOAD_BYTES, tracker);
  registerWebUiRoute(httpModule);
}
