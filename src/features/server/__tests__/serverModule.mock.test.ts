import {
  createMockServerModule,
  ServerModuleError,
} from '../services/serverModule.mock';

describe('createMockServerModule (mock estrutural do módulo do servidor — T-003)', () => {
  it('inicia com porta/IP/modo de rede padrão (Wi-Fi, porta 8080)', async () => {
    const serverModule = createMockServerModule();

    const result = await serverModule.start();

    expect(result).toEqual({
      port: 8080,
      ipAddress: '192.168.1.42',
      networkMode: 'wifi',
    });
    expect(serverModule.isRunning()).toBe(true);
  });

  it('respeita porta preferida e networkMode informados (HU-08 — rede própria)', async () => {
    const serverModule = createMockServerModule();

    const result = await serverModule.start({ preferredPort: 8081, networkMode: 'ownNetwork' });

    expect(result.port).toBe(8081);
    expect(result.networkMode).toBe('ownNetwork');
  });

  it('para o servidor e libera o estado "running" (HU-02)', async () => {
    const serverModule = createMockServerModule();
    await serverModule.start();

    await serverModule.stop();

    expect(serverModule.isRunning()).toBe(false);
  });

  it('permite sobrescrever start para simular erro NO_NETWORK', async () => {
    const serverModule = createMockServerModule({
      start: jest.fn().mockRejectedValue(new ServerModuleError('NO_NETWORK')),
    });

    await expect(serverModule.start()).rejects.toMatchObject({
      name: 'ServerModuleError',
      code: 'NO_NETWORK',
    });
  });

  it('ServerModuleError expõe o código de erro e uma mensagem legível', () => {
    const error = new ServerModuleError('PORT_UNAVAILABLE', 'porta 8080 em uso');

    expect(error.code).toBe('PORT_UNAVAILABLE');
    expect(error.message).toBe('porta 8080 em uso');
    expect(error).toBeInstanceOf(Error);
  });
});
