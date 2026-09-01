/**
 * Testes unitários para o fake de `react-native-tcp-socket` usado por
 * `nativeHttpModule.test.ts`. Fica sob `services/testing/`, portanto dentro da pasta
 * `services` de uma feature — coberta pelo threshold de 90% do projeto — e precisa da
 * própria suíte, no mesmo padrão de `shared/lib/testing/resetExpoMocks.ts`.
 */

import {
  MockServer,
  MockSocket,
  createdServers,
  createServerMock,
  createTcpSocketModule,
  resetTcpSocketMock,
} from '../tcpSocketMock';

describe('MockSocket', () => {
  it('registra escrita com encoding string e reconstrói o texto escrito', () => {
    const socket = new MockSocket();
    socket.write('cabecalho', 'utf8');

    expect(socket.writtenText()).toBe('cabecalho');
  });

  it('aceita um callback como segundo argumento (sem encoding) e o invoca', () => {
    const socket = new MockSocket();
    const cb = jest.fn();

    socket.write('dado', cb);

    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('reconstrói como utf8 por padrão uma escrita sem encoding explícito', () => {
    const socket = new MockSocket();

    socket.write('sem-encoding');

    expect(socket.writtenText()).toBe('sem-encoding');
  });

  it('aceita um callback como terceiro argumento junto de um encoding', () => {
    const socket = new MockSocket();
    const cb = jest.fn();

    socket.write('dado', 'utf8', cb);

    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('escreve Buffers sem exigir encoding e reconstrói os bytes originais', () => {
    const socket = new MockSocket();
    const buffer = Buffer.from([0x00, 0xff, 0x10]);

    socket.write(buffer);

    expect(socket.writtenBuffer().equals(buffer)).toBe(true);
  });

  it('writtenBuffer concatena múltiplas escritas (string + Buffer) na ordem correta', () => {
    const socket = new MockSocket();
    socket.write('abc', 'utf8');
    socket.write(Buffer.from([0x64, 0x65, 0x66]));

    expect(socket.writtenBuffer().toString('utf8')).toBe('abcdef');
  });

  it('conta chamadas de pause() e resume() separadamente', () => {
    const socket = new MockSocket();

    socket.pause();
    socket.pause();
    socket.resume();

    expect(socket.pauseCalls).toBe(2);
    expect(socket.resumeCalls).toBe(1);
  });

  it('destroy() marca destroyed e emite "close" apenas uma vez, mesmo se chamado duas vezes', () => {
    const socket = new MockSocket();
    const closeListener = jest.fn();
    socket.on('close', closeListener);

    socket.destroy();
    socket.destroy();

    expect(socket.destroyed).toBe(true);
    expect(closeListener).toHaveBeenCalledTimes(1);
  });

  it('write() retorna true (compatível com a assinatura real de Socket)', () => {
    const socket = new MockSocket();
    expect(socket.write('x')).toBe(true);
  });

  describe('deferWriteCallbacks (T-804)', () => {
    it('não invoca o callback de write() imediatamente quando ligado, mas registra os dados escritos', () => {
      const socket = new MockSocket();
      socket.deferWriteCallbacks = true;
      const cb = jest.fn();

      socket.write('chunk-1', cb);

      expect(cb).not.toHaveBeenCalled();
      expect(socket.written).toHaveLength(1);
      expect(socket.pendingWriteCount).toBe(1);
    });

    it('flushNextWrite() dispara os callbacks pendentes em ordem FIFO, um por vez', () => {
      const socket = new MockSocket();
      socket.deferWriteCallbacks = true;
      const cb1 = jest.fn();
      const cb2 = jest.fn();

      socket.write('chunk-1', cb1);
      socket.write('chunk-2', cb2);
      expect(socket.pendingWriteCount).toBe(2);

      socket.flushNextWrite();
      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).not.toHaveBeenCalled();
      expect(socket.pendingWriteCount).toBe(1);

      socket.flushNextWrite();
      expect(cb2).toHaveBeenCalledTimes(1);
      expect(socket.pendingWriteCount).toBe(0);
    });

    it('flushNextWrite() não lança quando não há callback pendente', () => {
      const socket = new MockSocket();
      socket.deferWriteCallbacks = true;

      expect(() => socket.flushNextWrite()).not.toThrow();
    });

    it('write() sem callback em modo deferido não é enfileirado (nada para disparar depois)', () => {
      const socket = new MockSocket();
      socket.deferWriteCallbacks = true;

      socket.write('sem-callback');

      expect(socket.pendingWriteCount).toBe(0);
    });
  });
});

describe('MockServer', () => {
  it('guarda o connectionListener recebido no construtor', () => {
    const listener = jest.fn();
    const server = new MockServer(listener);

    expect(server.connectionListener).toBe(listener);
  });

  it('listen() com (opts, callback) invoca o callback só quando triggerListening() é chamado', () => {
    const server = new MockServer(jest.fn());
    const onListening = jest.fn();

    server.listen({ port: 8080 }, onListening);
    expect(onListening).not.toHaveBeenCalled();
    expect(server.listenOptions).toEqual({ port: 8080 });

    server.triggerListening();
    expect(onListening).toHaveBeenCalledTimes(1);
  });

  it('listen() com host string no 2º argumento não registra callback (fiel à lib real, T-701)', () => {
    // A lib real (react-native-tcp-socket) só olha o 2º argumento como callback
    // quando `options` é um objeto — um 3º argumento (removido desta assinatura)
    // era ignorado nesse overload. Um callback passado ali (bug real encontrado
    // em nativeHttpModule.ts via teste manual em dispositivo — ver T-701) nunca
    // seria chamado; `triggerListening()` não deve lançar mesmo sem callback.
    const server = new MockServer(jest.fn());

    server.listen({ port: 8080, host: '0.0.0.0' }, '0.0.0.0');

    expect(() => server.triggerListening()).not.toThrow();
  });

  it('triggerListening() não lança quando listen() nunca foi chamado', () => {
    const server = new MockServer(jest.fn());
    expect(() => server.triggerListening()).not.toThrow();
  });

  it('close() marca closed, emite "close" e invoca o callback', () => {
    const server = new MockServer(jest.fn());
    const closeListener = jest.fn();
    const closeCallback = jest.fn();
    server.on('close', closeListener);

    server.close(closeCallback);

    expect(server.closed).toBe(true);
    expect(closeListener).toHaveBeenCalledTimes(1);
    expect(closeCallback).toHaveBeenCalledTimes(1);
  });

  it('close() funciona sem callback', () => {
    const server = new MockServer(jest.fn());
    expect(() => server.close()).not.toThrow();
    expect(server.closed).toBe(true);
  });
});

describe('createServerMock / createTcpSocketModule / resetTcpSocketMock', () => {
  afterEach(() => {
    resetTcpSocketMock();
  });

  it('createServerMock cria um MockServer e o registra em createdServers', () => {
    const listener = jest.fn();
    const server = createServerMock(listener);

    expect(server).toBeInstanceOf(MockServer);
    expect(server.connectionListener).toBe(listener);
    expect(createdServers).toContain(server);
  });

  it('createTcpSocketModule expõe createServerMock como default.createServer', () => {
    const mod = createTcpSocketModule();

    expect(mod.__esModule).toBe(true);
    expect(mod.default.createServer).toBe(createServerMock);
  });

  it('resetTcpSocketMock esvazia createdServers e limpa o histórico de chamadas do mock', () => {
    createServerMock(jest.fn());
    expect(createdServers.length).toBeGreaterThan(0);
    expect(createServerMock).toHaveBeenCalledTimes(1);

    resetTcpSocketMock();

    expect(createdServers.length).toBe(0);
    expect(createServerMock).toHaveBeenCalledTimes(0);
  });
});
