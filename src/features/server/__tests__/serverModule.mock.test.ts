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

  it('ServerModuleError usa o próprio código como mensagem quando nenhuma é informada', () => {
    const error = new ServerModuleError('UNKNOWN');

    expect(error.message).toBe('UNKNOWN');
  });

  describe('múltiplos ciclos start/stop em sequência', () => {
    it('alterna isRunning corretamente ao longo de vários ciclos start → stop', async () => {
      const serverModule = createMockServerModule();

      expect(serverModule.isRunning()).toBe(false);

      await serverModule.start();
      expect(serverModule.isRunning()).toBe(true);

      await serverModule.stop();
      expect(serverModule.isRunning()).toBe(false);

      await serverModule.start({ preferredPort: 9090, networkMode: 'ownNetwork' });
      expect(serverModule.isRunning()).toBe(true);

      await serverModule.stop();
      expect(serverModule.isRunning()).toBe(false);
    });

    it('registra cada chamada de start/stop separadamente em mock.calls (sem resetar entre ciclos)', async () => {
      const serverModule = createMockServerModule();

      await serverModule.start();
      await serverModule.stop();
      await serverModule.start();
      await serverModule.stop();
      await serverModule.start();

      expect(serverModule.start).toHaveBeenCalledTimes(3);
      expect(serverModule.stop).toHaveBeenCalledTimes(2);
      expect(serverModule.isRunning()).toBe(true);
    });

    it('start chamado duas vezes seguidas sem stop mantém isRunning true e retorna resultado da chamada mais recente', async () => {
      const serverModule = createMockServerModule();

      const first = await serverModule.start({ preferredPort: 8080 });
      const second = await serverModule.start({ preferredPort: 8081, networkMode: 'ownNetwork' });

      expect(first.port).toBe(8080);
      expect(second.port).toBe(8081);
      expect(second.networkMode).toBe('ownNetwork');
      expect(serverModule.isRunning()).toBe(true);
    });

    it('stop chamado quando o servidor já está parado é idempotente (não lança, mantém isRunning false)', async () => {
      const serverModule = createMockServerModule();

      await expect(serverModule.stop()).resolves.toBeUndefined();
      expect(serverModule.isRunning()).toBe(false);

      await expect(serverModule.stop()).resolves.toBeUndefined();
      expect(serverModule.isRunning()).toBe(false);
    });
  });

  describe('overrides parciais da factory', () => {
    it('sobrescrever apenas isRunning preserva o comportamento padrão de start/stop', async () => {
      const isRunningOverride = jest.fn(() => true);
      const serverModule = createMockServerModule({ isRunning: isRunningOverride });

      const result = await serverModule.start();

      expect(result.port).toBe(8080);
      expect(serverModule.isRunning()).toBe(true);
      expect(isRunningOverride).toHaveBeenCalledTimes(1);

      await serverModule.stop();
      // isRunning foi totalmente substituído: não reflete o estado interno de start/stop,
      // continua retornando o valor fixo do override.
      expect(serverModule.isRunning()).toBe(true);
    });

    it('sobrescrever apenas stop preserva o start/isRunning padrão, mas o estado interno não é afetado pelo override', async () => {
      const stopOverride = jest.fn().mockResolvedValue(undefined);
      const serverModule = createMockServerModule({ stop: stopOverride });

      await serverModule.start();
      expect(serverModule.isRunning()).toBe(true);

      await serverModule.stop();

      expect(stopOverride).toHaveBeenCalledTimes(1);
      // Documenta uma nuance real do mock: como `overrides` substitui a função inteira
      // (não injeta comportamento na closure `running` interna), sobrescrever `stop`
      // isoladamente NÃO libera o estado "running" observado por `isRunning` (que continua
      // sendo a implementação padrão fechada sobre a variável interna). Quem precisar dessa
      // interação deve sobrescrever `stop` E `isRunning` juntos.
      expect(serverModule.isRunning()).toBe(true);
    });

    it('sobrescrever start e stop juntos permite compor um cenário totalmente customizado, mantendo isRunning padrão desacoplado', async () => {
      let customRunning = false;
      const serverModule = createMockServerModule({
        start: jest.fn(async () => {
          customRunning = true;
          return { port: 1234, ipAddress: '10.0.0.1', networkMode: 'ownNetwork' as const };
        }),
        stop: jest.fn(async () => {
          customRunning = false;
        }),
      });

      const result = await serverModule.start();
      expect(result).toEqual({ port: 1234, ipAddress: '10.0.0.1', networkMode: 'ownNetwork' });
      expect(customRunning).toBe(true);
      // isRunning não foi sobrescrito: continua sendo a implementação padrão, fechada sobre
      // a variável `running` interna da factory — que nunca foi tocada pelos overrides de
      // start/stop customizados acima (eles usam sua própria variável `customRunning`).
      expect(serverModule.isRunning()).toBe(false);

      await serverModule.stop();
      expect(customRunning).toBe(false);
    });

    it('override vazio ({}) é equivalente a não passar overrides', async () => {
      const serverModule = createMockServerModule({});

      const result = await serverModule.start();

      expect(result).toEqual({ port: 8080, ipAddress: '192.168.1.42', networkMode: 'wifi' });
      expect(serverModule.isRunning()).toBe(true);
    });
  });
});
