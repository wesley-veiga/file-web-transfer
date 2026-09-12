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
 *   acontecer — por isso `ApiRouterConfig.getToken` e `getMode` são funções (lêem o
 *   token e modo atuais) em vez de valores fixos (ver `apiRouter.ts`).
 * - Registrar as rotas de arquivos/upload/eventos (`apiSetup.ts`) no roteador.
 */

import * as FileSystemLegacy from 'expo-file-system/legacy';
import { setHttpModule } from '../features/server/services/serverServiceFactory';
import { createDefaultHttpModule } from '../features/server/services/nativeHttpModule';
import { createApiRouter } from '../features/server/services/apiRouterFactory';
import { createFileRepository } from '../features/files/services/fileRepositoryFactory';
import { createFilesChangedAtTracker } from '../shared/lib/filesChangedAtTracker';
import { generateSessionId } from '../shared/lib';
import type { SessionMode } from '../features/server/types';
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

/** Caixa mutável do token atual, lida por `ApiRouterConfig.getToken`. */
const tokenBox = { current: generateSessionId() };

/** Caixa mutável do modo de sessão atual, lida por `ApiRouterConfig.getMode`. */
const modeBox = { current: 'send' as SessionMode };

/** Retorna o token atualmente ativo (da última sessão do servidor iniciada). */
export function getCurrentToken(): string {
  return tokenBox.current;
}

/**
 * Atualiza o token ativo.
 *
 * Deve ser chamado sempre que `ServerServiceImpl.start()` gerar um novo token
 * (isto é, sempre que `serverInfo.token` mudar no `serverStore`), para que
 * a API reflita a sessão em andamento mesmo com o `ApiRouter` montado
 * uma única vez no boot.
 */
export function setCurrentToken(token: string): void {
  tokenBox.current = token;
}

/** Retorna o modo de sessão atualmente ativo. */
export function getCurrentMode(): SessionMode {
  return modeBox.current;
}

/**
 * Atualiza o modo de sessão ativo.
 *
 * Deve ser chamado sempre que `ServerServiceImpl.start()` mude o modo
 * (isto é, sempre que `serverInfo.mode` mudar no `serverStore`).
 */
export function setCurrentMode(mode: SessionMode): void {
  modeBox.current = mode;
}

/**
 * Retrocompatibilidade com código antigo.
 * @deprecated Use `setCurrentToken()` instead.
 */
export function setCurrentSessionId(sessionId: string): void {
  setCurrentToken(sessionId);
}

/**
 * Retrocompatibilidade com código antigo.
 * @deprecated Use `getCurrentToken()` instead.
 */
export function getCurrentSessionId(): string {
  return getCurrentToken();
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
    getToken: () => tokenBox.current,
    getMode: () => modeBox.current,
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
