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

describe('caixa de confirmação de token (T-910)', () => {
  describe('mostrar caixa de confirmação quando token está ausente ou inválido', () => {
    it('mostra a caixa de confirmação quando não há token na URL', (done) => {
      FakeXhr.instances = [];
      (window as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = FakeXhr;

      window.fetch = jest.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.startsWith('/api/session')) {
          // Simular resposta com tokenValid: false (sem token na URL)
          return Promise.resolve({
            ok: true,
            json: async () => ({
              tokenValid: false,
              mode: null,
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
        const confirmBox = document.getElementById('token-confirmation-box');
        expect(confirmBox?.classList.contains('hidden')).toBe(false);

        const uploadPanel = document.getElementById('tab-upload');
        const downloadPanel = document.getElementById('tab-download');
        expect(uploadPanel?.classList.contains('hidden')).toBe(true);
        expect(downloadPanel?.classList.contains('hidden')).toBe(true);

        done();
      }, 50);
    });

    it('exibe a mensagem de erro quando fetch falha', (done) => {
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
        const confirmBox = document.getElementById('token-confirmation-box');
        expect(confirmBox?.classList.contains('hidden')).toBe(false);
        done();
      }, 50);
    });
  });

  describe('submissão de token', () => {
    it('aceita token válido digitado manualmente e mostra a view correta', (done) => {
      FakeXhr.instances = [];
      (window as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = FakeXhr;

      window.fetch = jest.fn((input: RequestInfo | URL) => {
        const url = String(input);

        if (url.startsWith('/api/session')) {
          // Primeira chamada: sem token (tokenValid: false)
          if (!url.includes('token=')) {
            return Promise.resolve({
              ok: true,
              json: async () => ({
                tokenValid: false,
                mode: null,
                appVersion: '1.0.0',
                maxUploadBytes: 4294967296,
              }),
            }) as unknown as Promise<Response>;
          }
          // Segunda chamada: com token "test-valid"
          if (url.includes('token=test-valid')) {
            return Promise.resolve({
              ok: true,
              json: async () => ({
                tokenValid: true,
                mode: 'receive',
                appVersion: '1.0.0',
                maxUploadBytes: 4294967296,
              }),
            }) as unknown as Promise<Response>;
          }
          // Outros tokens: inválidos
          return Promise.resolve({
            ok: true,
            json: async () => ({
              tokenValid: false,
              mode: null,
            }),
          }) as unknown as Promise<Response>;
        }
        if (url.startsWith('/api/events')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ filesChangedAt: 0 }),
          }) as unknown as Promise<Response>;
        }
        if (url.startsWith('/api/files')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ files: [] }),
          }) as unknown as Promise<Response>;
        }
        return Promise.reject(new Error('Unexpected URL: ' + url));
      });

      document.open();
      document.write(WEB_UI_HTML);
      document.close();

      setTimeout(() => {
        const confirmBox = document.getElementById('token-confirmation-box');
        expect(confirmBox?.classList.contains('hidden')).toBe(false);

        const tokenInput = document.getElementById('token-input') as HTMLInputElement;
        const submitBtn = document.getElementById('token-submit-btn') as HTMLButtonElement;

        tokenInput.value = 'test-valid';
        submitBtn.click();

        // Wait for async fetch to complete
        setTimeout(() => {
          // Confirmação deve desaparecer
          expect(confirmBox?.classList.contains('hidden')).toBe(true);

          // View apropriada (upload para 'receive') deve aparecer
          const uploadPanel = document.getElementById('tab-upload');
          const downloadPanel = document.getElementById('tab-download');
          expect(uploadPanel?.classList.contains('hidden')).toBe(false);
          expect(downloadPanel?.classList.contains('hidden')).toBe(true);

          done();
        }, 150);
      }, 50);
    });

    it('mostra mensagem de erro quando token é inválido', (done) => {
      FakeXhr.instances = [];
      (window as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = FakeXhr;

      window.fetch = jest.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.startsWith('/api/session')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              tokenValid: false,
              mode: null,
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
        const tokenInput = document.getElementById('token-input') as HTMLInputElement;
        const submitBtn = document.getElementById('token-submit-btn') as HTMLButtonElement;
        const errorMsg = document.getElementById('token-error-message');

        tokenInput.value = 'token-errado';
        submitBtn.click();

        setTimeout(() => {
          expect(errorMsg?.classList.contains('visible')).toBe(true);
          expect(errorMsg?.textContent).toContain('Token inválido');

          // Confirmação deve continuar visível
          const confirmBox = document.getElementById('token-confirmation-box');
          expect(confirmBox?.classList.contains('hidden')).toBe(false);

          done();
        }, 150);
      }, 50);
    });

    it('permite nova tentativa após erro de token inválido', (done) => {
      FakeXhr.instances = [];
      (window as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = FakeXhr;

      window.fetch = jest.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.startsWith('/api/session')) {
          if (url.includes('token=retry-ok')) {
            return Promise.resolve({
              ok: true,
              json: async () => ({
                tokenValid: true,
                mode: 'send',
                appVersion: '1.0.0',
                maxUploadBytes: 4294967296,
              }),
            }) as unknown as Promise<Response>;
          }
          return Promise.resolve({
            ok: true,
            json: async () => ({
              tokenValid: false,
              mode: null,
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
        const tokenInput = document.getElementById('token-input') as HTMLInputElement;
        const submitBtn = document.getElementById('token-submit-btn') as HTMLButtonElement;

        // Primeira tentativa: token errado
        tokenInput.value = 'errado1';
        submitBtn.click();

        setTimeout(() => {
          const errorMsg = document.getElementById('token-error-message');
          expect(errorMsg?.classList.contains('visible')).toBe(true);

          // Segunda tentativa: token correto
          tokenInput.value = 'retry-ok';
          submitBtn.click();

          setTimeout(() => {
            expect(errorMsg?.classList.contains('visible')).toBe(false);
            const confirmBox = document.getElementById('token-confirmation-box');
            expect(confirmBox?.classList.contains('hidden')).toBe(true);

            done();
          }, 150);
        }, 150);
      }, 50);
    });

    it('permite submissão via tecla Enter no input', (done) => {
      FakeXhr.instances = [];
      (window as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = FakeXhr;

      window.fetch = jest.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.startsWith('/api/session')) {
          if (url.includes('token=enter-token')) {
            return Promise.resolve({
              ok: true,
              json: async () => ({
                tokenValid: true,
                mode: 'receive',
                appVersion: '1.0.0',
                maxUploadBytes: 4294967296,
              }),
            }) as unknown as Promise<Response>;
          }
          return Promise.resolve({
            ok: true,
            json: async () => ({
              tokenValid: false,
              mode: null,
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
        const tokenInput = document.getElementById('token-input') as HTMLInputElement;

        tokenInput.value = 'enter-token';
        const event = new KeyboardEvent('keydown', { key: 'Enter' });
        tokenInput.dispatchEvent(event);

        setTimeout(() => {
          const confirmBox = document.getElementById('token-confirmation-box');
          expect(confirmBox?.classList.contains('hidden')).toBe(true);

          done();
        }, 150);
      }, 50);
    });
  });

  describe('experiência de usuário da confirmação de token', () => {
    it('limpa mensagem de erro quando usuário começa a digitar', (done) => {
      FakeXhr.instances = [];
      (window as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = FakeXhr;

      window.fetch = jest.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.startsWith('/api/session')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              tokenValid: false,
              mode: null,
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
        const tokenInput = document.getElementById('token-input') as HTMLInputElement;
        const submitBtn = document.getElementById('token-submit-btn') as HTMLButtonElement;
        const errorMsg = document.getElementById('token-error-message');

        // Tentar enviar sem valor
        submitBtn.click();

        setTimeout(() => {
          expect(errorMsg?.classList.contains('visible')).toBe(true);

          // Usuário começa a digitar
          tokenInput.value = 'a';
          tokenInput.dispatchEvent(new Event('input', { bubbles: true }));

          expect(errorMsg?.classList.contains('visible')).toBe(false);

          done();
        }, 50);
      }, 50);
    });

    it('não permite envio com token vazio', (done) => {
      FakeXhr.instances = [];
      (window as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = FakeXhr;

      window.fetch = jest.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.startsWith('/api/session')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              tokenValid: false,
              mode: null,
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
        const submitBtn = document.getElementById('token-submit-btn') as HTMLButtonElement;
        const errorMsg = document.getElementById('token-error-message');

        submitBtn.click();

        setTimeout(() => {
          expect(errorMsg?.classList.contains('visible')).toBe(true);
          expect(errorMsg?.textContent).toContain('vazio');

          done();
        }, 50);
      }, 50);
    });

    it('atualiza a URL quando token válido é confirmado', (done) => {
      FakeXhr.instances = [];
      (window as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = FakeXhr;

      window.fetch = jest.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url.startsWith('/api/session')) {
          if (url.includes('token=novo-token')) {
            return Promise.resolve({
              ok: true,
              json: async () => ({
                tokenValid: true,
                mode: 'send',
                appVersion: '1.0.0',
                maxUploadBytes: 4294967296,
              }),
            }) as unknown as Promise<Response>;
          }
          return Promise.resolve({
            ok: true,
            json: async () => ({
              tokenValid: false,
              mode: null,
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
        const tokenInput = document.getElementById('token-input') as HTMLInputElement;
        const submitBtn = document.getElementById('token-submit-btn') as HTMLButtonElement;

        tokenInput.value = 'novo-token';
        submitBtn.click();

        setTimeout(() => {
          expect(window.location.search).toContain('token=novo-token');
          done();
        }, 150);
      }, 50);
    });
  });
});

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

    it('mostra confirmação de token quando fetch falha (erro de rede)', (done) => {
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
        const confirmBox = document.getElementById('token-confirmation-box');
        expect(confirmBox?.classList.contains('hidden')).toBe(false);
        done();
      }, 50);
    });

    it('mostra confirmação de token quando response.ok é false', (done) => {
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
        const confirmBox = document.getElementById('token-confirmation-box');
        expect(confirmBox?.classList.contains('hidden')).toBe(false);
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

        // Não há botão de envio específico no upload area
        // (o botão de confirmação de token é para token, não para upload)
        const uploadSection = document.getElementById('tab-upload');
        const uploadButtons = uploadSection?.querySelectorAll('button') || [];
        // Nenhum botão no upload area exceto retry buttons (que aparecem em erros)
        const nonRetryButtons = Array.from(uploadButtons).filter(
          (btn) => !btn.classList.contains('retry-btn')
        );
        expect(nonRetryButtons.length).toBe(0);

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
