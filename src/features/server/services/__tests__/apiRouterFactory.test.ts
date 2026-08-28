/**
 * Testes unitários para a factory do ApiRouter.
 *
 * Testa:
 * - createApiRouter(config) retorna uma instância de ApiRouterImpl
 * - Instância retornada satisfaz a interface ApiRouter
 * - Configs diferentes produzem instâncias independentes
 */

import { createApiRouter } from '../apiRouterFactory';
import { ApiRouterImpl } from '../apiRouter';
import type { ApiRouterConfig } from '../apiRouter';

const config: ApiRouterConfig = {
  sessionId: 'test-123',
  appVersion: '1.0.0',
  maxUploadBytes: 4294967296,
};

describe('createApiRouter', () => {
  it('retorna uma instância de ApiRouterImpl', () => {
    const router = createApiRouter(config);
    expect(router).toBeInstanceOf(ApiRouterImpl);
  });

  it('a instância retornada satisfaz a interface ApiRouter', () => {
    const router = createApiRouter(config);
    expect(typeof router.register).toBe('function');
    expect(typeof router.unregister).toBe('function');
  });

  it('dois configs diferentes produzem instâncias independentes', () => {
    const config1: ApiRouterConfig = { ...config, sessionId: 'test-456' };
    const config2: ApiRouterConfig = { ...config, sessionId: 'test-789' };

    const router1 = createApiRouter(config1);
    const router2 = createApiRouter(config2);

    expect(router1).not.toBe(router2);
  });
});
