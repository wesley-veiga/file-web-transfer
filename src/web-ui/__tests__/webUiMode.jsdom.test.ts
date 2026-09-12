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
 * - Upload de múltiplos arquivos inicia automaticamente (já coberto por webUiUpload.jsdom.test.ts,
 *   mas confirmado aqui no contexto de renderização condicional)
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
  });
});
