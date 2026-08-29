/**
 * Testes comportamentais do download + polling da interface web (T-503).
 *
 * Roda no project Jest "web-ui" (ver `jest.config.js`), ambiente jsdom real com
 * `runScripts: 'dangerously'` — o `<script>` embutido em `WEB_UI_HTML` é carregado via
 * `document.write` e executa de verdade, incluindo `setupPolling()`, que já dispara um
 * `pollEvents()` síncrono e registra um `setInterval(pollEvents, 3000)` assim que a página
 * carrega. Ver `webUiUpload.jsdom.test.ts` (T-502) para o padrão original deste project.
 *
 * `window.fetch` é substituído por um mock único que inspeciona a URL recebida e responde
 * de forma diferente para `/api/session`, `/api/events` e `/api/files` — necessário porque,
 * ao contrário do teste de upload, aqui várias rotas são chamadas na mesma carga de página
 * e evoluem de forma independente entre os "ticks" de polling.
 *
 * Fake timers (`jest.useFakeTimers()`) controlam o `setInterval` do polling.
 * `jest.advanceTimersByTimeAsync` é usado (em vez de `advanceTimersByTime` + await manual de
 * promises) porque ele também aguarda a fila de microtasks entre cada avanço — necessário
 * para deixar as cadeias `fetch().then().then()` de `pollEvents()`/`loadDownloadList()`
 * resolverem antes de inspecionar o DOM.
 */

import { WEB_UI_HTML } from '../webUiHtml';

interface FileEntry {
  id: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
  createdAt: number;
}

type EventsFailureMode = 'none' | 'reject' | 'not-ok';

interface FetchState {
  filesChangedAt: number;
  files: FileEntry[];
  eventsFail: EventsFailureMode;
}

function createFetchMock(state: FetchState, calls: string[]): typeof fetch {
  return jest.fn((input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);

    if (url.startsWith('/api/session')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          sessionId: 'sessao-teste',
          appVersion: '1.0.0',
          maxUploadBytes: 4294967296,
        }),
      }) as unknown as Promise<Response>;
    }

    if (url.startsWith('/api/events')) {
      if (state.eventsFail === 'reject') {
        return Promise.reject(new Error('falha de rede simulada'));
      }
      if (state.eventsFail === 'not-ok') {
        return Promise.resolve({
          ok: false,
          json: async () => ({}),
        }) as unknown as Promise<Response>;
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ filesChangedAt: state.filesChangedAt }),
      }) as unknown as Promise<Response>;
    }

    if (url.startsWith('/api/files')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ files: state.files }),
      }) as unknown as Promise<Response>;
    }

    return Promise.reject(new Error('URL inesperada em teste: ' + url));
  }) as unknown as typeof fetch;
}

function loadPage(state: FetchState, calls: string[]): void {
  window.fetch = createFetchMock(state, calls);
  document.open();
  document.write(WEB_UI_HTML);
  document.close();
}

function getDownloadListEl(): HTMLUListElement {
  return document.getElementById('download-list') as HTMLUListElement;
}

function getDownloadItems(): HTMLLIElement[] {
  return Array.from(document.querySelectorAll('#download-list li'));
}

function isBannerHidden(): boolean {
  const banner = document.getElementById('disconnected-banner') as HTMLElement;
  return banner.classList.contains('hidden');
}

function filesCallCount(calls: string[]): number {
  return calls.filter((url) => url.startsWith('/api/files')).length;
}

describe('download + polling na web-ui', () => {
  let calls: string[];

  beforeEach(() => {
    calls = [];
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('carga inicial da lista de download via polling', () => {
    it('popula #download-list com nome, tamanho formatado, tipo, data e href de download corretos', async () => {
      const createdAt = new Date('2026-01-15T12:00:00Z').getTime();
      const state: FetchState = {
        filesChangedAt: 1000,
        files: [
          {
            id: 'abc-123',
            name: 'relatorio.pdf',
            sizeBytes: 2048,
            mimeType: 'application/pdf',
            createdAt,
          },
        ],
        eventsFail: 'none',
      };
      loadPage(state, calls);

      await jest.advanceTimersByTimeAsync(0);

      const items = getDownloadItems();
      expect(items).toHaveLength(1);

      const link = items[0].querySelector('.download-item-link') as HTMLAnchorElement;
      expect(link.getAttribute('href')).toBe('/api/files/abc-123/download');
      expect(items[0].querySelector('.download-item-name')?.textContent).toBe('relatorio.pdf');
      expect(items[0].querySelector('.download-item-size')?.textContent).toBe('2.0 KB');
      // "PDF" vem de formatFileType('application/pdf'); a data é comparada com o mesmo
      // cálculo que o próprio código de produção faz (new Date(...).toLocaleDateString),
      // para não depender do timezone/locale exatos do ambiente que roda o teste.
      const meta = items[0].querySelector('.download-item-meta');
      expect(meta?.textContent).toContain('PDF');
      expect(meta?.textContent).toContain(new Date(createdAt).toLocaleDateString('pt-BR'));
    });

    it('lida com múltiplos arquivos, um item por arquivo, preservando a ordem recebida', async () => {
      const state: FetchState = {
        filesChangedAt: 1000,
        files: [
          { id: '1', name: 'a.txt', sizeBytes: 10, mimeType: 'text/plain', createdAt: 1 },
          { id: '2', name: 'b.png', sizeBytes: 20, mimeType: 'image/png', createdAt: 2 },
        ],
        eventsFail: 'none',
      };
      loadPage(state, calls);

      await jest.advanceTimersByTimeAsync(0);

      const items = getDownloadItems();
      expect(items).toHaveLength(2);
      expect(items[0].querySelector('.download-item-name')?.textContent).toBe('a.txt');
      expect(items[1].querySelector('.download-item-name')?.textContent).toBe('b.png');
      expect(items[1].querySelector('.download-item-meta')?.textContent).toContain('PNG');
    });
  });

  describe('lista vazia', () => {
    it('mostra o placeholder "Nenhum arquivo compartilhado ainda" quando /api/files retorna files: []', async () => {
      const state: FetchState = { filesChangedAt: 1000, files: [], eventsFail: 'none' };
      loadPage(state, calls);

      await jest.advanceTimersByTimeAsync(0);

      const items = getDownloadItems();
      expect(items).toHaveLength(1);
      expect(items[0].className).toBe('placeholder');
      expect(items[0].textContent).toBe('Nenhum arquivo compartilhado ainda');
    });
  });

  describe('escaping de nomes de arquivo', () => {
    it('escapa tags HTML no nome do arquivo — não injeta markup cru em #download-list', async () => {
      const state: FetchState = {
        filesChangedAt: 1000,
        files: [
          {
            id: 'x1',
            name: '<script>alert(1)</script>.txt',
            sizeBytes: 10,
            mimeType: 'text/plain',
            createdAt: 1,
          },
        ],
        eventsFail: 'none',
      };
      loadPage(state, calls);

      await jest.advanceTimersByTimeAsync(0);

      const list = getDownloadListEl();
      expect(list.innerHTML).not.toContain('<script>alert(1)</script>.txt');
      expect(list.innerHTML).toContain('&lt;script&gt;');
      // O texto renderizado (via textContent, que desfaz o escaping de leitura) continua
      // sendo o nome original — prova que foi tratado como texto, nunca como HTML ativo.
      expect(list.querySelector('.download-item-name')?.textContent).toBe(
        '<script>alert(1)</script>.txt',
      );
    });

    it('escapa "&" no nome do arquivo e preserva o texto original ao ler de volta', async () => {
      // Nota: aspas em texto (fora de atributo) não precisam de escaping por spec HTML, e o
      // jsdom normaliza `&quot;` de volta para `"` puro ao serializar `innerHTML` — por isso
      // este teste verifica apenas `&`, que É reescrito para `&amp;` de volta na serialização
      // (ambíguo/obrigatório em texto), prova mais confiável de que `escapeHtml` rodou.
      const state: FetchState = {
        filesChangedAt: 1000,
        files: [
          {
            id: 'x2',
            name: 'nome & companhia.pdf',
            sizeBytes: 5,
            mimeType: 'application/pdf',
            createdAt: 1,
          },
        ],
        eventsFail: 'none',
      };
      loadPage(state, calls);

      await jest.advanceTimersByTimeAsync(0);

      const list = getDownloadListEl();
      expect(list.innerHTML).toContain('&amp;');
      expect(list.querySelector('.download-item-name')?.textContent).toBe('nome & companhia.pdf');
    });
  });

  describe('polling não refaz GET /api/files quando filesChangedAt não muda', () => {
    it('segunda rodada de polling com o mesmo filesChangedAt não dispara novo fetch de /api/files', async () => {
      const state: FetchState = {
        filesChangedAt: 1000,
        files: [{ id: '1', name: 'a.txt', sizeBytes: 1, mimeType: 'text/plain', createdAt: 1 }],
        eventsFail: 'none',
      };
      loadPage(state, calls);

      await jest.advanceTimersByTimeAsync(0);
      expect(filesCallCount(calls)).toBe(1);

      await jest.advanceTimersByTimeAsync(3000);

      expect(filesCallCount(calls)).toBe(1);
      expect(getDownloadItems()).toHaveLength(1);
    });
  });

  describe('polling refaz GET /api/files quando filesChangedAt aumenta', () => {
    it('busca a lista de novo e ela reflete o novo arquivo adicionado', async () => {
      const state: FetchState = {
        filesChangedAt: 1000,
        files: [{ id: '1', name: 'a.txt', sizeBytes: 1, mimeType: 'text/plain', createdAt: 1 }],
        eventsFail: 'none',
      };
      loadPage(state, calls);

      await jest.advanceTimersByTimeAsync(0);
      expect(filesCallCount(calls)).toBe(1);
      expect(getDownloadItems()).toHaveLength(1);

      state.filesChangedAt = 2000;
      state.files = [
        { id: '1', name: 'a.txt', sizeBytes: 1, mimeType: 'text/plain', createdAt: 1 },
        { id: '2', name: 'b.txt', sizeBytes: 2, mimeType: 'text/plain', createdAt: 2 },
      ];

      await jest.advanceTimersByTimeAsync(3000);

      expect(filesCallCount(calls)).toBe(2);
      const items = getDownloadItems();
      expect(items).toHaveLength(2);
      expect(items[1].querySelector('.download-item-name')?.textContent).toBe('b.txt');
    });
  });

  describe('banner de desconexão', () => {
    it('permanece oculto depois de apenas 1 falha de polling', async () => {
      const state: FetchState = { filesChangedAt: 0, files: [], eventsFail: 'none' };
      loadPage(state, calls);

      await jest.advanceTimersByTimeAsync(0);
      expect(isBannerHidden()).toBe(true);

      state.eventsFail = 'reject';
      await jest.advanceTimersByTimeAsync(3000);

      expect(isBannerHidden()).toBe(true);
    });

    it('aparece depois de 2 falhas consecutivas de polling', async () => {
      const state: FetchState = { filesChangedAt: 0, files: [], eventsFail: 'none' };
      loadPage(state, calls);

      await jest.advanceTimersByTimeAsync(0);

      state.eventsFail = 'not-ok';
      await jest.advanceTimersByTimeAsync(3000); // falha 1
      expect(isBannerHidden()).toBe(true);

      await jest.advanceTimersByTimeAsync(3000); // falha 2
      expect(isBannerHidden()).toBe(false);
    });

    it('some no primeiro sucesso de polling após ter aparecido', async () => {
      const state: FetchState = { filesChangedAt: 0, files: [], eventsFail: 'none' };
      loadPage(state, calls);

      await jest.advanceTimersByTimeAsync(0);

      state.eventsFail = 'reject';
      await jest.advanceTimersByTimeAsync(3000); // falha 1
      await jest.advanceTimersByTimeAsync(3000); // falha 2 — banner aparece
      expect(isBannerHidden()).toBe(false);

      state.eventsFail = 'none';
      await jest.advanceTimersByTimeAsync(3000); // sucesso

      expect(isBannerHidden()).toBe(true);
    });

    it('zera o contador de falhas em qualquer sucesso — falha isolada após um sucesso no meio não reexibe o banner', async () => {
      const state: FetchState = { filesChangedAt: 0, files: [], eventsFail: 'none' };
      loadPage(state, calls);

      await jest.advanceTimersByTimeAsync(0);

      state.eventsFail = 'reject';
      await jest.advanceTimersByTimeAsync(3000); // falha 1
      expect(isBannerHidden()).toBe(true);

      state.eventsFail = 'none';
      await jest.advanceTimersByTimeAsync(3000); // sucesso — zera o contador
      expect(isBannerHidden()).toBe(true);

      state.eventsFail = 'reject';
      await jest.advanceTimersByTimeAsync(3000); // falha isolada — contador deveria estar em 1, não 3
      expect(isBannerHidden()).toBe(true);
    });
  });
});
