/**
 * Factory para criar instâncias do `ApiRouter` com injeção de dependência.
 *
 * Uso:
 * - `createApiRouter(config)` cria um novo roteador com a configuração fornecida
 * - Testes podem mockar o HttpModule ao chamar `router.register(mockHttpModule)`
 */

import type { ApiRouter, ApiRouterConfig } from './apiRouter';
import { ApiRouterImpl } from './apiRouter';

/**
 * Cria uma instância do ApiRouter.
 *
 * @param config Configuração do roteador (sessionId, appVersion, maxUploadBytes)
 * @returns Nova instância de ApiRouter
 */
export function createApiRouter(config: ApiRouterConfig): ApiRouter {
  return new ApiRouterImpl(config);
}
