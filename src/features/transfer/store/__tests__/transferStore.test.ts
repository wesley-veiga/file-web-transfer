import { createTransferStore, useTransferStore } from '../transferStore';
import type { EnqueueTransferInput } from '../transferStore';
import type { Transfer, TransferStatus } from '../../types';

/** Cria um relógio mockado controlável e a fábrica de input padrão para os testes. */
function makeClock(initial = 1000) {
  let current = initial;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
      return current;
    },
    set: (value: number) => {
      current = value;
      return current;
    },
  };
}

const baseInput: EnqueueTransferInput = {
  direction: 'upload',
  fileName: 'foto.png',
  sizeBytes: 1000,
  peerIp: '192.168.0.5',
};

describe('createTransferStore · enqueue', () => {
  it('usa o id explícito quando fornecido', () => {
    const clock = makeClock();
    const store = createTransferStore({ now: clock.now });

    const id = store.getState().enqueue({ ...baseInput, id: 'explicit-id' });

    expect(id).toBe('explicit-id');
    expect(store.getState().transfers[0].id).toBe('explicit-id');
  });

  it('usa generateId injetado quando id é omitido', () => {
    const clock = makeClock();
    const store = createTransferStore({ now: clock.now, generateId: () => 'generated-id' });

    const id = store.getState().enqueue(baseInput);

    expect(id).toBe('generated-id');
  });

  it('gera ids diferentes para chamadas sucessivas usando o generateId padrão do módulo', () => {
    // Sem injetar generateId: exercita o fallback `defaultDeps.generateId` (Crypto.randomUUID mockado).
    const store = createTransferStore({ now: () => 1000 });

    const id1 = store.getState().enqueue(baseInput);
    const id2 = store.getState().enqueue(baseInput);

    expect(id1).not.toBe(id2);
    expect(store.getState().transfers).toHaveLength(2);
  });

  it('inicializa a transferência com os campos padrão corretos', () => {
    const clock = makeClock(5000);
    const store = createTransferStore({ now: clock.now, generateId: () => 'id-1' });

    store.getState().enqueue(baseInput);
    const transfer = store.getState().transfers[0];

    const expected: Transfer = {
      id: 'id-1',
      direction: 'upload',
      fileName: 'foto.png',
      sizeBytes: 1000,
      transferredBytes: 0,
      status: 'queued',
      peerIp: '192.168.0.5',
      startedAt: 5000,
      finishedAt: null,
      speedBps: null,
      errorMessage: null,
    };
    expect(transfer).toEqual(expected);
  });

  it('aceita sizeBytes null (Content-Length não informado)', () => {
    const store = createTransferStore({ now: () => 1000 });

    store.getState().enqueue({ ...baseInput, sizeBytes: null });

    expect(store.getState().transfers[0].sizeBytes).toBeNull();
  });

  it('mantém a fila em ordem de chegada (FIFO)', () => {
    const store = createTransferStore({ now: () => 1000 });

    store.getState().enqueue({ ...baseInput, id: 'a', fileName: 'a.zip' });
    store.getState().enqueue({ ...baseInput, id: 'b', fileName: 'b.zip' });
    store.getState().enqueue({ ...baseInput, id: 'c', fileName: 'c.zip' });

    expect(store.getState().transfers.map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('createTransferStore · start', () => {
  it('transita queued → active', () => {
    const store = createTransferStore({ now: () => 1000 });
    const id = store.getState().enqueue(baseInput);

    store.getState().start(id);

    expect(store.getState().transfers[0].status).toBe('active');
  });

  it('não faz nada e loga aviso quando o id não existe', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const store = createTransferStore({ now: () => 1000 });
    store.getState().enqueue(baseInput);

    store.getState().start('id-inexistente');

    expect(store.getState().transfers).toHaveLength(1);
    expect(store.getState().transfers[0].status).toBe('queued');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('id-inexistente'));
  });

  it('não faz nada e loga aviso ao tentar iniciar uma transferência já ativa', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const store = createTransferStore({ now: () => 1000 });
    const id = store.getState().enqueue(baseInput);
    store.getState().start(id);
    warnSpy.mockClear();

    store.getState().start(id);

    expect(store.getState().transfers[0].status).toBe('active');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('active → active'));
  });

  it.each<TransferStatus>(['completed', 'failed', 'cancelled'])(
    'não permite iniciar uma transferência já %s',
    (terminalStatus) => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const store = createTransferStore({ now: () => 1000 });
      const id = store.getState().enqueue(baseInput);
      store.getState().start(id);
      if (terminalStatus === 'completed') store.getState().complete(id);
      if (terminalStatus === 'failed') store.getState().fail(id, 'erro');
      if (terminalStatus === 'cancelled') store.getState().cancel(id);
      warnSpy.mockClear();

      store.getState().start(id);

      expect(store.getState().transfers[0].status).toBe(terminalStatus);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Transição inválida'));
    },
  );
});

describe('createTransferStore · reportProgress', () => {
  it('não faz nada e loga aviso quando o id não existe', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const store = createTransferStore({ now: () => 1000 });

    store.getState().reportProgress('id-inexistente', 100);

    expect(store.getState().transfers).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('id-inexistente'));
  });

  it('promove queued → active automaticamente na primeira chamada', () => {
    const store = createTransferStore({ now: () => 1000 });
    const id = store.getState().enqueue(baseInput);

    store.getState().reportProgress(id, 100);

    expect(store.getState().transfers[0].status).toBe('active');
    expect(store.getState().transfers[0].transferredBytes).toBe(100);
  });

  it('atualiza transferredBytes normalmente quando já está active', () => {
    const clock = makeClock(1000);
    const store = createTransferStore({ now: clock.now });
    const id = store.getState().enqueue(baseInput);
    store.getState().start(id);

    clock.advance(500);
    store.getState().reportProgress(id, 250);

    expect(store.getState().transfers[0].status).toBe('active');
    expect(store.getState().transfers[0].transferredBytes).toBe(250);
  });

  it('faz clamp de transferredBytes ao sizeBytes quando definido', () => {
    const store = createTransferStore({ now: () => 1000 });
    const id = store.getState().enqueue({ ...baseInput, sizeBytes: 1000 });

    store.getState().reportProgress(id, 5000);

    expect(store.getState().transfers[0].transferredBytes).toBe(1000);
  });

  it('não faz clamp quando sizeBytes é null (Content-Length desconhecido)', () => {
    const store = createTransferStore({ now: () => 1000 });
    const id = store.getState().enqueue({ ...baseInput, sizeBytes: null });

    store.getState().reportProgress(id, 5_000_000);

    expect(store.getState().transfers[0].transferredBytes).toBe(5_000_000);
  });

  it.each<TransferStatus>(['completed', 'failed', 'cancelled'])(
    'ignora progresso reportado para transferência já %s e loga aviso',
    (terminalStatus) => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const store = createTransferStore({ now: () => 1000 });
      const id = store.getState().enqueue(baseInput);
      store.getState().start(id);
      store.getState().reportProgress(id, 100);
      if (terminalStatus === 'completed') store.getState().complete(id);
      if (terminalStatus === 'failed') store.getState().fail(id, 'erro');
      if (terminalStatus === 'cancelled') store.getState().cancel(id);
      warnSpy.mockClear();

      store.getState().reportProgress(id, 999);

      expect(store.getState().transfers[0].status).toBe(terminalStatus);
      expect(store.getState().transfers[0].transferredBytes).toBe(100); // inalterado
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Progresso ignorado para transferência finalizada'),
      );
    },
  );

  it('calcula speedBps como null enquanto houver menos de duas amostras', () => {
    const store = createTransferStore({ now: () => 1000 });
    const id = store.getState().enqueue(baseInput);

    store.getState().reportProgress(id, 100);

    expect(store.getState().transfers[0].speedBps).toBeNull();
  });

  it('calcula speedBps como média móvel a partir da segunda amostra', () => {
    const clock = makeClock(1000);
    const store = createTransferStore({ now: clock.now });
    const id = store.getState().enqueue(baseInput);

    store.getState().reportProgress(id, 0);
    clock.set(2000);
    store.getState().reportProgress(id, 500);

    // 500 bytes em 1000ms = 500 bytes/s
    expect(store.getState().transfers[0].speedBps).toBe(500);
  });

  it('isola as amostras de velocidade entre transferências diferentes', () => {
    const clock = makeClock(1000);
    const store = createTransferStore({ now: clock.now });
    const idA = store.getState().enqueue({ ...baseInput, id: 'a', sizeBytes: null });
    const idB = store.getState().enqueue({ ...baseInput, id: 'b', sizeBytes: null });

    store.getState().reportProgress(idA, 0);
    clock.set(2000);
    store.getState().reportProgress(idA, 1000); // A: 1000 bytes/s

    clock.set(3000);
    store.getState().reportProgress(idB, 0);
    clock.set(4000);
    store.getState().reportProgress(idB, 100); // B: 100 bytes/s

    const byId = (id: string) => store.getState().transfers.find((t) => t.id === id);
    expect(byId('a')?.speedBps).toBe(1000);
    expect(byId('b')?.speedBps).toBe(100);
  });
});

describe('createTransferStore · complete', () => {
  it('transita queued → completed e define finishedAt', () => {
    const clock = makeClock(1000);
    const store = createTransferStore({ now: clock.now });
    const id = store.getState().enqueue(baseInput);

    clock.set(9000);
    store.getState().complete(id);

    expect(store.getState().transfers[0].status).toBe('completed');
    expect(store.getState().transfers[0].finishedAt).toBe(9000);
  });

  it('transita active → completed', () => {
    const store = createTransferStore({ now: () => 1000 });
    const id = store.getState().enqueue(baseInput);
    store.getState().start(id);

    store.getState().complete(id);

    expect(store.getState().transfers[0].status).toBe('completed');
  });

  it('não permite completar duas vezes (completed → completed é inválido)', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const store = createTransferStore({ now: () => 1000 });
    const id = store.getState().enqueue(baseInput);
    store.getState().complete(id);
    const finishedAtAfterFirstComplete = store.getState().transfers[0].finishedAt;
    warnSpy.mockClear();

    store.getState().complete(id);

    expect(store.getState().transfers[0].finishedAt).toBe(finishedAtAfterFirstComplete);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Transição inválida'));
  });

  it('não faz nada e loga aviso quando o id não existe', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const store = createTransferStore({ now: () => 1000 });

    store.getState().complete('id-inexistente');

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('id-inexistente'));
  });
});

describe('createTransferStore · fail', () => {
  it('transita queued → failed com mensagem de erro e finishedAt', () => {
    const clock = makeClock(1000);
    const store = createTransferStore({ now: clock.now });
    const id = store.getState().enqueue(baseInput);

    clock.set(7000);
    store.getState().fail(id, 'Conexão perdida');

    const transfer = store.getState().transfers[0];
    expect(transfer.status).toBe('failed');
    expect(transfer.errorMessage).toBe('Conexão perdida');
    expect(transfer.finishedAt).toBe(7000);
  });

  it('transita active → failed', () => {
    const store = createTransferStore({ now: () => 1000 });
    const id = store.getState().enqueue(baseInput);
    store.getState().start(id);

    store.getState().fail(id, 'Erro de rede');

    expect(store.getState().transfers[0].status).toBe('failed');
  });

  it('não permite falhar uma transferência já cancelada', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const store = createTransferStore({ now: () => 1000 });
    const id = store.getState().enqueue(baseInput);
    store.getState().cancel(id);
    warnSpy.mockClear();

    store.getState().fail(id, 'erro tardio');

    expect(store.getState().transfers[0].status).toBe('cancelled');
    expect(store.getState().transfers[0].errorMessage).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Transição inválida'));
  });
});

describe('createTransferStore · cancel', () => {
  it('transita queued → cancelled e define finishedAt', () => {
    const clock = makeClock(1000);
    const store = createTransferStore({ now: clock.now });
    const id = store.getState().enqueue(baseInput);

    clock.set(4000);
    store.getState().cancel(id);

    const transfer = store.getState().transfers[0];
    expect(transfer.status).toBe('cancelled');
    expect(transfer.finishedAt).toBe(4000);
  });

  it('transita active → cancelled', () => {
    const store = createTransferStore({ now: () => 1000 });
    const id = store.getState().enqueue(baseInput);
    store.getState().start(id);

    store.getState().cancel(id);

    expect(store.getState().transfers[0].status).toBe('cancelled');
  });

  it('não permite cancelar uma transferência já concluída', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const store = createTransferStore({ now: () => 1000 });
    const id = store.getState().enqueue(baseInput);
    store.getState().complete(id);
    warnSpy.mockClear();

    store.getState().cancel(id);

    expect(store.getState().transfers[0].status).toBe('completed');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Transição inválida'));
  });
});

describe('createTransferStore · cancelAllActive', () => {
  it('cancela apenas transferências queued/active, preservando estados terminais e seus finishedAt', () => {
    const clock = makeClock(1000);
    const store = createTransferStore({ now: clock.now });

    const queuedId = store.getState().enqueue({ ...baseInput, id: 'queued' });

    const activeId = store.getState().enqueue({ ...baseInput, id: 'active' });
    store.getState().start(activeId);

    const completedId = store.getState().enqueue({ ...baseInput, id: 'completed' });
    clock.set(2000);
    store.getState().complete(completedId);

    const failedId = store.getState().enqueue({ ...baseInput, id: 'failed' });
    clock.set(3000);
    store.getState().fail(failedId, 'erro');

    const cancelledId = store.getState().enqueue({ ...baseInput, id: 'cancelled' });
    clock.set(4000);
    store.getState().cancel(cancelledId);

    clock.set(9999);
    store.getState().cancelAllActive();

    const byId = (id: string) => store.getState().transfers.find((t) => t.id === id)!;

    expect(byId(queuedId).status).toBe('cancelled');
    expect(byId(queuedId).finishedAt).toBe(9999);

    expect(byId(activeId).status).toBe('cancelled');
    expect(byId(activeId).finishedAt).toBe(9999);

    // Estados terminais permanecem intocados, inclusive seu finishedAt original.
    expect(byId(completedId).status).toBe('completed');
    expect(byId(completedId).finishedAt).toBe(2000);

    expect(byId(failedId).status).toBe('failed');
    expect(byId(failedId).finishedAt).toBe(3000);

    expect(byId(cancelledId).status).toBe('cancelled');
    expect(byId(cancelledId).finishedAt).toBe(4000);
  });

  it('não faz nada quando não há transferências', () => {
    const store = createTransferStore({ now: () => 1000 });

    expect(() => store.getState().cancelAllActive()).not.toThrow();
    expect(store.getState().transfers).toEqual([]);
  });
});

describe('createTransferStore · reset', () => {
  it('limpa a lista de transferências', () => {
    const store = createTransferStore({ now: () => 1000 });
    store.getState().enqueue(baseInput);
    store.getState().enqueue(baseInput);

    store.getState().reset();

    expect(store.getState().transfers).toEqual([]);
  });

  it('limpa o histórico de amostras de velocidade — nova sessão não herda amostras antigas', () => {
    const clock = makeClock(1000);
    const store = createTransferStore({ now: clock.now });

    // Sessão antiga: acumula duas amostras próximas no tempo com id 'reused-id'.
    const oldId = store.getState().enqueue({ ...baseInput, id: 'reused-id', sizeBytes: null });
    store.getState().reportProgress(oldId, 0);
    clock.set(1100);
    store.getState().reportProgress(oldId, 1_000_000); // velocidade antiga altíssima

    store.getState().reset();

    // Nova sessão: mesmo id, mas o histórico de amostras deve ter sido zerado.
    clock.set(5000);
    const newId = store.getState().enqueue({ ...baseInput, id: 'reused-id', sizeBytes: null });
    store.getState().reportProgress(newId, 10);

    // Apenas uma amostra na nova sessão → speedBps ainda null (não deve "herdar" a
    // amostra da sessão anterior para calcular uma velocidade espúria).
    expect(store.getState().transfers[0].speedBps).toBeNull();

    clock.set(6000);
    store.getState().reportProgress(newId, 20);

    // 10 bytes em 1000ms = 10 bytes/s — comportamento consistente com uma sessão nova,
    // sem contaminação da amostra de 1_000_000 bytes da sessão anterior.
    expect(store.getState().transfers[0].speedBps).toBe(10);
  });
});

describe('useTransferStore (instância padrão)', () => {
  it('usa Date.now e o gerador de id padrão para enfileirar uma transferência', () => {
    const id = useTransferStore.getState().enqueue(baseInput);

    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
    const transfer = useTransferStore.getState().transfers.find((t) => t.id === id);
    expect(transfer?.status).toBe('queued');
    expect(typeof transfer?.startedAt).toBe('number');

    // Limpa o estado global para não vazar entre testes de outros arquivos.
    useTransferStore.getState().reset();
  });
});
