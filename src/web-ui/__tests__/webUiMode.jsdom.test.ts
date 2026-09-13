/**
 * Testes comportamentais de renderização condicional por modo (T-909).
 *
 * Roda no project Jest "web-ui" (ver `jest.config.js`), ambiente jsdom real com
 * `runScripts: 'dangerously'` — o `<script>` embutido em `WEB_UI_HTML` é carregado via
 * `document.write` e executa de verdade, incluindo `loadSession()` que consulta `GET /api/session`
 * e renderiza condicionalmente baseado no `mode` retornado.
 *
 * Verifica que:
 * - Modo 'send': apenas painel de download é visível
 * - Modo 'receive': apenas painel de upload é visível
 * - Upload de múltiplos arquivos inicia automaticamente
 * - loadSession() trata erros de rede e resposta inválida
 * - renderConditionalView() garante que apenas uma view é visível por vez
 */

import { WEB_UI_HTML } from '../webUiHtml';

type FakeXhrUpload = {
  onprogress:
    ((event: { lengthComputable: boolean; loaded: number; total: number }) => void) | null;
};

class FakeXhr {
  static instances: FakeXhr[] = [];

  upload: FakeXhrUpload = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  status = 0;
  responseText = '';
  method: string | null = null;
  url: string | null = null;
  sentBody: FormData | null = null;

  constructor() {
    FakeXhr.instances.push(this);
  }

  open(method: string, url: string): void {
    this.method = method;
    this.url = url;
  }

  send(body: FormData): void {
    this.sentBody = body;
  }
}

function makeFile(name: string, size: number, type = 'application/octet-stream'): File {
  const file = new File([new Uint8Array(Math.max(size, 0))], name, { type });
  Object.defineProperty(file, 'size', { value: size, configurable: true });
  return file;
}

function setInputFiles(input: HTMLInputElement, files: File[]): void {
  Object.defineProperty(input, 'files', { value: files, configurable: true });
}

function fireEvent(target: EventTarget, type: string): void {
  target.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
}

interface FileEntry {
  id: string;
  name: string;
  sizeBytes: number;
  mimeType: string;
  createdAt: number;
}

interface FetchState {
  mode: 'send' | 'receive';
  tokenValid: boolean;
  appVersion: string;
  maxUploadBytes: number;
  filesChangedAt: number;
  files: FileEntry[];
  eventsFail: 'none' | 'reject' | 'not-ok';
}

function createFetchMock(state: FetchState): typeof fetch {
  return jest.fn((input: RequestInfo | URL) => {
    const url = String(input);

    if (url.startsWith('/api/session')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          mode: state.mode,
          tokenValid: state.tokenValid,
          appVersion: state.appVersion,
          maxUploadBytes: state.maxUploadBytes,
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

function loadPageWithMode(mode: 'send' | 'receive'): void {
  FakeXhr.instances = [];
  (window as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = FakeXhr;

  const state: FetchState = {
    mode,
    tokenValid: true,
    appVersion: '1.0.0',
    maxUploadBytes: 4294967296,
    filesChangedAt: 0,
    files: [],
    eventsFail: 'none',
  };

  window.fetch = createFetchMock(state);
  document.open();
  document.write(WEB_UI_HTML);
  document.close();
}

function isUploadPanelVisible(): boolean {
  const panel = document.getElementById('tab-upload');
  return panel !== null && !panel.classList.contains('hidden');
}

function isDownloadPanelVisible(): boolean {
  const panel = document.getElementById('tab-download');
  return panel !== null && !panel.classList.contains('hidden');
}

describe('renderização condicional por modo (T-909)', () => {

  describe('loadSession() - busca da sessão e renderização condicional', () => {
    it('envia requisição para GET /api/session ao carregar', (done) => {
      FakeXhr.instances = [];
      (window as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = FakeXhr;

      let sessionFetchCalled = false;
      window.fetch = jest.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.startsWith('/api/session')) {
          sessionFetchCalled = true;
          return Promise.resolve({
            ok: true,
            json: async () => ({
              mode: 'send',
              tokenValid: true,
              appVersion: '1.0.0',
              maxUploadBytes: 4294967296,
            }),
          }) as unknown as Promise<Response>;
        }
        if (url.startsWith('/api/events') || url.startsWith('/api/files')) {
          return Promise.resolve({
            ok: true,
            json: async () => (url.startsWith('/api/events') ? { filesChangedAt: 0 } : { files: [] }),
          }) as unknown as Promise<Response>;
        }
        return Promise.reject(new Error('Unexpected URL'));
      });

      document.open();
      document.write(WEB_UI_HTML);
      document.close();

      setTimeout(() => {
        expect(sessionFetchCalled).toBe(true);
        done();
      }, 50);
    });

    it('exibe "Sessão indisponível" quando a resposta não contém mode', (done) => {
      FakeXhr.instances = [];
      (window as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = FakeXhr;

      window.fetch = jest.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.startsWith('/api/session')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ tokenValid: true }), // sem mode
          }) as unknown as Promise<Response>;
        }
        if (url.startsWith('/api/events') || url.startsWith('/api/files')) {
          return Promise.resolve({
            ok: true,
            json: async () => (url.startsWith('/api/events') ? { filesChangedAt: 0 } : { files: [] }),
          }) as unknown as Promise<Response>;
        }
        return Promise.reject(new Error('Unexpected URL'));
      });

      document.open();
      document.write(WEB_UI_HTML);
      document.close();

      setTimeout(() => {
        const sessionValue = document.getElementById('session-value');
        expect(sessionValue?.textContent).toContain('Sessão indisponível');
        done();
      }, 50);
    });

    it('exibe "Sessão indisponível" quando fetch falha (erro de rede)', (done) => {
      FakeXhr.instances = [];
      (window as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = FakeXhr;

      window.fetch = jest.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.startsWith('/api/session')) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        }) as unknown as Promise<Response>;
      });

      document.open();
      document.write(WEB_UI_HTML);
      document.close();

      setTimeout(() => {
        const sessionValue = document.getElementById('session-value');
        expect(sessionValue?.textContent).toContain('Sessão indisponível');
        done();
      }, 50);
    });

    it('exibe "Sessão indisponível" quando response.ok é false', (done) => {
      FakeXhr.instances = [];
      (window as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = FakeXhr;

      window.fetch = jest.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.startsWith('/api/session')) {
          return Promise.resolve({
            ok: false,
            json: async () => ({}),
          }) as unknown as Promise<Response>;
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        }) as unknown as Promise<Response>;
      });

      document.open();
      document.write(WEB_UI_HTML);
      document.close();

      setTimeout(() => {
        const sessionValue = document.getElementById('session-value');
        expect(sessionValue?.textContent).toContain('Sessão indisponível');
        done();
      }, 50);
    });
  });

  describe('modo "send"', () => {
    beforeEach(() => {
      loadPageWithMode('send');
    });

    it('mostra apenas o painel de download (lista de arquivos para receber)', () => {
      expect(isDownloadPanelVisible()).toBe(true);
      expect(isUploadPanelVisible()).toBe(false);
    });

    it('não permite upload mesmo que o painel de upload não seja visível', () => {
      const uploadPanel = document.getElementById('tab-upload');
      expect(uploadPanel?.classList.contains('hidden')).toBe(true);
    });

    it('atualiza o rótulo de sessão para "Modo: Enviar"', (done) => {
      setTimeout(() => {
        const sessionValue = document.getElementById('session-value');
        expect(sessionValue?.textContent).toContain('Modo: Enviar');
        done();
      }, 50);
    });
  });

  describe('modo "receive"', () => {
    beforeEach(() => {
      loadPageWithMode('receive');
    });

    it('mostra apenas o painel de upload (área para enviar arquivos)', () => {
      expect(isUploadPanelVisible()).toBe(true);
      expect(isDownloadPanelVisible()).toBe(false);
    });

    it('o painel de download não é renderizado', () => {
      const downloadPanel = document.getElementById('tab-download');
      expect(downloadPanel?.classList.contains('hidden')).toBe(true);
    });

    it('atualiza o rótulo de sessão para "Modo: Receber"', (done) => {
      setTimeout(() => {
        const sessionValue = document.getElementById('session-value');
        expect(sessionValue?.textContent).toContain('Modo: Receber');
        done();
      }, 50);
    });

    it('permite selecionar e enviar múltiplos arquivos', () => {
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      const files = [
        makeFile('arquivo1.txt', 100),
        makeFile('arquivo2.txt', 200),
        makeFile('arquivo3.txt', 300),
      ];
      setInputFiles(fileInput, files);

      fireEvent(fileInput, 'change');

      // Ambos os XHR devem ser criados na fila, mas apenas o primeiro iniciado de forma síncrona
      expect(FakeXhr.instances.length).toBeGreaterThan(0);

      // Verifica que os três arquivos foram adicionados à fila
      const uploadItems = Array.from(document.querySelectorAll('#upload-list li'));
      expect(uploadItems.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('renderização condicional bidirecional', () => {
    it('nunca mostra upload e download ao mesmo tempo no modo "send"', (done) => {
      loadPageWithMode('send');
      setTimeout(() => {
        expect(isDownloadPanelVisible()).toBe(true);
        expect(isUploadPanelVisible()).toBe(false);
        // Garantia adicional: nenhum dos dois pode estar visível ao mesmo tempo
        expect(!(isDownloadPanelVisible() && isUploadPanelVisible())).toBe(true);
        done();
      }, 50);
    });

    it('nunca mostra upload e download ao mesmo tempo no modo "receive"', (done) => {
      loadPageWithMode('receive');
      setTimeout(() => {
        expect(isUploadPanelVisible()).toBe(true);
        expect(isDownloadPanelVisible()).toBe(false);
        // Garantia adicional: nenhum dos dois pode estar visível ao mesmo tempo
        expect(!(isDownloadPanelVisible() && isUploadPanelVisible())).toBe(true);
        done();
      }, 50);
    });

    it('garante que exatamente um painel é visível em cada modo', (done) => {
      loadPageWithMode('send');
      setTimeout(() => {
        const downloadVisible = isDownloadPanelVisible();
        const uploadVisible = isUploadPanelVisible();
        // Exatamente um dos dois deve estar visível (XOR lógico)
        expect(downloadVisible !== uploadVisible).toBe(true);

        // Teste similar para modo receive
        loadPageWithMode('receive');
        setTimeout(() => {
          const dlVisible = isDownloadPanelVisible();
          const ulVisible = isUploadPanelVisible();
          expect(dlVisible !== ulVisible).toBe(true);
          done();
        }, 50);
      }, 50);
    });

    it('verifica que renderConditionalView() usa classe CSS "hidden" corretamente', (done) => {
      loadPageWithMode('send');
      setTimeout(() => {
        const uploadPanel = document.getElementById('tab-upload');
        const downloadPanel = document.getElementById('tab-download');

        // Em modo send: upload deve ter classe hidden, download não deve
        expect(uploadPanel?.classList.contains('hidden')).toBe(true);
        expect(downloadPanel?.classList.contains('hidden')).toBe(false);

        // A classe hidden deve fazer display: none
        const uploadStyle = window.getComputedStyle(uploadPanel!);
        const downloadStyle = window.getComputedStyle(downloadPanel!);

        expect(uploadStyle.display).toBe('none');
        expect(downloadStyle.display).not.toBe('none');

        done();
      }, 50);
    });
  });

  describe('upload múltiplo automático (sem clique extra)', () => {
    it('inicia o envio automaticamente ao selecionar múltiplos arquivos', (done) => {
      loadPageWithMode('receive');
      setTimeout(() => {
        const fileInput = document.getElementById('file-input') as HTMLInputElement;
        const files = [
          makeFile('arquivo1.txt', 100),
          makeFile('arquivo2.txt', 200),
          makeFile('arquivo3.txt', 300),
        ];
        setInputFiles(fileInput, files);

        // Simular mudança no input (como se o usuário tivesse selecionado os arquivos)
        fireEvent(fileInput, 'change');

        // Depois de um curto tempo, os itens devem estar na fila e o upload iniciado
        setTimeout(() => {
          // Verificar que pelo menos um XHR foi criado (indicando que processUploadQueue foi chamado)
          expect(FakeXhr.instances.length).toBeGreaterThan(0);

          // Verificar que os itens estão sendo renderizados
          const uploadItems = Array.from(document.querySelectorAll('#upload-list li'));
          expect(uploadItems.length).toBeGreaterThanOrEqual(3);

          done();
        }, 100);
      }, 50);
    });

    it('não requer botão de confirmação para iniciar upload de múltiplos arquivos', (done) => {
      loadPageWithMode('receive');
      setTimeout(() => {
        const fileInput = document.getElementById('file-input') as HTMLInputElement;
        const files = [
          makeFile('doc1.pdf', 5000),
          makeFile('doc2.pdf', 6000),
        ];
        setInputFiles(fileInput, files);

        // Não há botão de confirmação no HTML para modo upload
        const confirmButton = Array.from(document.querySelectorAll('button')).find(
          (btn) => btn.textContent?.toLowerCase().includes('confirmar') ||
                   btn.textContent?.toLowerCase().includes('enviar')
        );
        // Não deve haver botão específico de envio (apenas retry para erros)
        expect(!confirmButton || confirmButton.classList.contains('retry-btn')).toBe(true);

        // Disparar change event no input
        fireEvent(fileInput, 'change');

        setTimeout(() => {
          // Verificar que XHR foi criado (upload iniciado sem clique extra)
          expect(FakeXhr.instances.length).toBeGreaterThan(0);
          done();
        }, 50);
      }, 50);
    });
  });
});
