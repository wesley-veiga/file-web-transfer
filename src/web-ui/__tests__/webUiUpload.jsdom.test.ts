/**
 * Testes comportamentais do upload da interface web (T-502).
 *
 * Roda no project Jest "web-ui" (ver `jest.config.js`), ambiente jsdom real com
 * `runScripts: 'dangerously'` — o `<script>` embutido em `WEB_UI_HTML` é carregado via
 * `document.write` e executa de verdade (fila sequencial, XHR, mapeamento de erro),
 * ao contrário de `webUiHtml.test.ts` (T-501), que só verifica marcadores de texto no
 * project "app" (sem DOM).
 *
 * `XMLHttpRequest` é substituído por um fake controlável manualmente (`FakeXhr`) para
 * provar precisamente a ordem de eventos da fila sequencial — o jsdom real dispara
 * requisições de rede de verdade, o que violaria o determinismo exigido (sem rede real).
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
  // jsdom calcula `size` a partir do conteúdo do Blob; para simular tamanhos grandes sem
  // alocar memória de verdade, sobrescrevemos a propriedade somente leitura.
  Object.defineProperty(file, 'size', { value: size, configurable: true });
  return file;
}

function setInputFiles(input: HTMLInputElement, files: File[]): void {
  Object.defineProperty(input, 'files', { value: files, configurable: true });
}

function fireEvent(target: EventTarget, type: string): void {
  target.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
}

function getItems(): HTMLLIElement[] {
  return Array.from(document.querySelectorAll('#upload-list li'));
}

function statusTextOf(item: Element): string {
  return item.querySelector('.upload-item-status-text')?.textContent ?? '';
}

function progressWidthOf(item: Element): string {
  const fill = item.querySelector('.progress-fill') as HTMLElement | null;
  return fill?.style.width ?? '';
}

function retryButtonOf(item: Element): HTMLButtonElement | null {
  return item.querySelector('.retry-btn');
}

describe('upload na web-ui', () => {
  let originalXhr: typeof XMLHttpRequest;

  beforeEach(() => {
    FakeXhr.instances = [];
    originalXhr = window.XMLHttpRequest;
    (window as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = FakeXhr;

    // Mocke fetch ANTES de carregar a página, porque loadSession() chama fetch('/api/session')
    // assim que o script roda (durante o document.write abaixo).
    window.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        sessionId: 'sessao-teste',
        appVersion: '1.0.0',
        maxUploadBytes: 4294967296,
      }),
    }) as unknown as typeof fetch;

    document.open();
    document.write(WEB_UI_HTML);
    document.close();
  });

  afterEach(() => {
    (window as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = originalXhr;
  });

  describe('seleção de arquivo via input', () => {
    it('adiciona um item à lista com nome, tamanho formatado e já começa a enviar (fila processada de forma síncrona)', () => {
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      const file = makeFile('foto.jpg', 2048);
      setInputFiles(fileInput, [file]);

      fireEvent(fileInput, 'change');

      const items = getItems();
      expect(items).toHaveLength(1);
      expect(items[0].querySelector('.upload-item-name')?.textContent).toBe('foto.jpg');
      expect(items[0].querySelector('.upload-item-size')?.textContent).toBe('2.0 KB');
      // processUploadQueue() roda de forma síncrona dentro do handler de 'change': o item
      // já está "uploading" (status "Enviando…") e o XHR já foi aberto quando a lista é
      // inspecionada — não fica "Na fila".
      expect(statusTextOf(items[0])).toBe('Enviando…');
      expect(FakeXhr.instances).toHaveLength(1);
    });

    it('limpa o valor do input após a seleção, para permitir selecionar o mesmo arquivo de novo', () => {
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      setInputFiles(fileInput, [makeFile('a.txt', 10)]);

      fireEvent(fileInput, 'change');

      expect(fileInput.value).toBe('');
    });
  });

  describe('fila sequencial', () => {
    it('processa uploads um de cada vez: só cria/abre o segundo XHR depois que o primeiro termina', () => {
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      setInputFiles(fileInput, [makeFile('um.txt', 10), makeFile('dois.txt', 20)]);

      fireEvent(fileInput, 'change');

      // Apenas o primeiro upload foi iniciado.
      expect(FakeXhr.instances).toHaveLength(1);
      expect(FakeXhr.instances[0].url).toBe('/api/upload');
      expect(FakeXhr.instances[0].method).toBe('POST');

      let items = getItems();
      expect(statusTextOf(items[0])).toBe('Enviando…');
      expect(statusTextOf(items[1])).toBe('Na fila');

      // Completa o primeiro upload.
      FakeXhr.instances[0].status = 201;
      FakeXhr.instances[0].onload?.();

      // Só agora o segundo XHR é criado/aberto.
      expect(FakeXhr.instances).toHaveLength(2);
      items = getItems();
      expect(statusTextOf(items[0])).toBe('Concluído');
      expect(statusTextOf(items[1])).toBe('Enviando…');
    });

    it('nunca tem dois uploads abertos ao mesmo tempo mesmo com 3 arquivos selecionados juntos', () => {
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      setInputFiles(fileInput, [makeFile('a.txt', 1), makeFile('b.txt', 2), makeFile('c.txt', 3)]);

      fireEvent(fileInput, 'change');
      expect(FakeXhr.instances).toHaveLength(1);

      FakeXhr.instances[0].status = 201;
      FakeXhr.instances[0].onload?.();
      expect(FakeXhr.instances).toHaveLength(2);

      FakeXhr.instances[1].status = 201;
      FakeXhr.instances[1].onload?.();
      expect(FakeXhr.instances).toHaveLength(3);
    });
  });

  describe('progresso', () => {
    it('reflete o progresso do upload na largura da barra (.progress-fill)', () => {
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      setInputFiles(fileInput, [makeFile('video.mp4', 1000)]);
      fireEvent(fileInput, 'change');

      FakeXhr.instances[0].upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 });

      const items = getItems();
      expect(progressWidthOf(items[0])).toBe('50%');
    });

    it('ignora eventos de progresso não computáveis (lengthComputable: false)', () => {
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      setInputFiles(fileInput, [makeFile('video.mp4', 1000)]);
      fireEvent(fileInput, 'change');

      FakeXhr.instances[0].upload.onprogress?.({ lengthComputable: false, loaded: 50, total: 100 });

      const items = getItems();
      expect(progressWidthOf(items[0])).toBe('0%');
    });
  });

  describe('sucesso', () => {
    it('marca o item como "Concluído", barra em 100% e sem botão de tentar novamente', () => {
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      setInputFiles(fileInput, [makeFile('doc.pdf', 500)]);
      fireEvent(fileInput, 'change');

      FakeXhr.instances[0].status = 201;
      FakeXhr.instances[0].onload?.();

      const items = getItems();
      expect(statusTextOf(items[0])).toBe('Concluído');
      expect(progressWidthOf(items[0])).toBe('100%');
      expect(items[0].classList.contains('error')).toBe(false);
      expect(retryButtonOf(items[0])).toBeNull();
    });
  });

  describe('cada código de erro HTTP exibe mensagem específica e botão de tentar novamente', () => {
    function selectAndFailWith(status: number, code: string, message: string): HTMLLIElement {
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      setInputFiles(fileInput, [makeFile('arquivo.bin', 100)]);
      fireEvent(fileInput, 'change');

      const xhr = FakeXhr.instances[FakeXhr.instances.length - 1];
      xhr.status = status;
      xhr.responseText = JSON.stringify({ error: { code, message } });
      xhr.onload?.();

      return getItems()[getItems().length - 1];
    }

    it('413 FILE_TOO_LARGE → "Arquivo muito grande"', () => {
      const item = selectAndFailWith(413, 'FILE_TOO_LARGE', 'excede o limite');
      expect(statusTextOf(item)).toBe('Arquivo muito grande');
      expect(item.classList.contains('error')).toBe(true);
      expect(retryButtonOf(item)).not.toBeNull();
    });

    it('422 INVALID_FILENAME → "Nome de arquivo inválido"', () => {
      const item = selectAndFailWith(422, 'INVALID_FILENAME', 'nome inválido após sanitização');
      expect(statusTextOf(item)).toBe('Nome de arquivo inválido');
      expect(retryButtonOf(item)).not.toBeNull();
    });

    it('507 INSUFFICIENT_STORAGE → "Sem espaço no dispositivo host"', () => {
      const item = selectAndFailWith(507, 'INSUFFICIENT_STORAGE', 'disco cheio');
      expect(statusTextOf(item)).toBe('Sem espaço no dispositivo host');
      expect(retryButtonOf(item)).not.toBeNull();
    });

    it('código desconhecido com message customizada → exibe a message literal', () => {
      const item = selectAndFailWith(500, 'UNKNOWN_ERROR', 'Algo inesperado aconteceu no host');
      expect(statusTextOf(item)).toBe('Algo inesperado aconteceu no host');
      expect(retryButtonOf(item)).not.toBeNull();
    });

    it('400 INVALID_MULTIPART sem mensagem específica mapeada e sem message → cai no fallback "Falha no envio"', () => {
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      setInputFiles(fileInput, [makeFile('arquivo.bin', 100)]);
      fireEvent(fileInput, 'change');

      const xhr = FakeXhr.instances[0];
      xhr.status = 400;
      xhr.responseText = JSON.stringify({ error: { code: 'INVALID_MULTIPART', message: '' } });
      xhr.onload?.();

      const item = getItems()[0];
      expect(statusTextOf(item)).toBe('Falha no envio');
      expect(retryButtonOf(item)).not.toBeNull();
    });
  });

  describe('resposta de erro malformada', () => {
    it('não lança exceção e cai no fallback "Falha no envio" quando responseText não é JSON válido', () => {
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      setInputFiles(fileInput, [makeFile('arquivo.bin', 100)]);
      fireEvent(fileInput, 'change');

      const xhr = FakeXhr.instances[0];
      xhr.status = 500;
      xhr.responseText = 'não é json';

      expect(() => xhr.onload?.()).not.toThrow();

      const item = getItems()[0];
      expect(statusTextOf(item)).toBe('Falha no envio');
      expect(item.classList.contains('error')).toBe(true);
    });
  });

  describe('erro de rede e abort', () => {
    it('erro de rede (onerror) exibe "Conexão perdida", distinta das mensagens de erro HTTP, e botão de retry', () => {
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      setInputFiles(fileInput, [makeFile('arquivo.bin', 100)]);
      fireEvent(fileInput, 'change');

      FakeXhr.instances[0].onerror?.();

      const item = getItems()[0];
      expect(statusTextOf(item)).toBe('Conexão perdida');
      expect(statusTextOf(item)).not.toBe('Falha no envio');
      expect(retryButtonOf(item)).not.toBeNull();
    });

    it('abort (onabort) exibe "Conexão perdida" e botão de retry', () => {
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      setInputFiles(fileInput, [makeFile('arquivo.bin', 100)]);
      fireEvent(fileInput, 'change');

      FakeXhr.instances[0].onabort?.();

      const item = getItems()[0];
      expect(statusTextOf(item)).toBe('Conexão perdida');
      expect(retryButtonOf(item)).not.toBeNull();
    });
  });

  describe('"Tentar novamente"', () => {
    it('abre um novo XHR para o mesmo arquivo ao clicar em retry, sem reenviar itens já concluídos', () => {
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      const fileA = makeFile('a.txt', 10);
      const fileB = makeFile('b.txt', 20);
      setInputFiles(fileInput, [fileA, fileB]);
      fireEvent(fileInput, 'change');

      // Primeiro (a.txt) falha.
      FakeXhr.instances[0].status = 413;
      FakeXhr.instances[0].responseText = JSON.stringify({
        error: { code: 'FILE_TOO_LARGE', message: 'grande demais' },
      });
      FakeXhr.instances[0].onload?.();

      // Segundo (b.txt) é iniciado automaticamente e concluído com sucesso.
      expect(FakeXhr.instances).toHaveLength(2);
      FakeXhr.instances[1].status = 201;
      FakeXhr.instances[1].onload?.();

      let items = getItems();
      expect(statusTextOf(items[0])).toBe('Arquivo muito grande');
      expect(statusTextOf(items[1])).toBe('Concluído');

      const retryBtn = retryButtonOf(items[0]);
      expect(retryBtn).not.toBeNull();
      retryBtn?.click();

      // Um novo XHR (o terceiro) foi aberto, referente ao item de a.txt novamente.
      expect(FakeXhr.instances).toHaveLength(3);
      const retryFormData = FakeXhr.instances[2].sentBody as FormData;
      expect(retryFormData.get('file')).toBe(fileA);

      items = getItems();
      expect(statusTextOf(items[0])).toBe('Enviando…');
      // O item já concluído continua intocado (não voltou para a fila nem reenviado).
      expect(statusTextOf(items[1])).toBe('Concluído');
    });

    it('não reenvia um item que não está em estado de erro (clique ignorado)', () => {
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      setInputFiles(fileInput, [makeFile('a.txt', 10)]);
      fireEvent(fileInput, 'change');

      FakeXhr.instances[0].status = 201;
      FakeXhr.instances[0].onload?.();

      expect(retryButtonOf(getItems()[0])).toBeNull();
      expect(FakeXhr.instances).toHaveLength(1);
    });
  });

  describe('drag-and-drop', () => {
    it('adiciona a classe "drag-active" ao drop-zone em dragover', () => {
      const dropZone = document.getElementById('drop-zone') as HTMLDivElement;
      const event = new Event('dragover', { bubbles: true, cancelable: true });
      dropZone.dispatchEvent(event);

      expect(dropZone.classList.contains('drag-active')).toBe(true);
    });

    it('remove a classe "drag-active" em dragleave', () => {
      const dropZone = document.getElementById('drop-zone') as HTMLDivElement;
      dropZone.dispatchEvent(new Event('dragover', { bubbles: true, cancelable: true }));
      expect(dropZone.classList.contains('drag-active')).toBe(true);

      dropZone.dispatchEvent(new Event('dragleave', { bubbles: true, cancelable: true }));
      expect(dropZone.classList.contains('drag-active')).toBe(false);
    });

    it('em drop, chama preventDefault, remove drag-active e enfileira os arquivos soltos', () => {
      const dropZone = document.getElementById('drop-zone') as HTMLDivElement;
      dropZone.dispatchEvent(new Event('dragover', { bubbles: true, cancelable: true }));

      const dropEvent = new Event('drop', { bubbles: true, cancelable: true }) as Event & {
        dataTransfer?: { files: File[] };
      };
      dropEvent.dataTransfer = { files: [makeFile('solto.png', 300)] };
      const preventDefaultSpy = jest.spyOn(dropEvent, 'preventDefault');

      dropZone.dispatchEvent(dropEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(dropZone.classList.contains('drag-active')).toBe(false);

      const items = getItems();
      expect(items).toHaveLength(1);
      expect(items[0].querySelector('.upload-item-name')?.textContent).toBe('solto.png');
    });
  });

  describe('acessibilidade do drop zone', () => {
    it('Enter no drop-zone focado aciona fileInput.click()', () => {
      const dropZone = document.getElementById('drop-zone') as HTMLDivElement;
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      const clickSpy = jest.spyOn(fileInput, 'click').mockImplementation(() => {});

      const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      dropZone.dispatchEvent(event);

      expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    it('espaço no drop-zone focado aciona fileInput.click()', () => {
      const dropZone = document.getElementById('drop-zone') as HTMLDivElement;
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      const clickSpy = jest.spyOn(fileInput, 'click').mockImplementation(() => {});

      const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
      dropZone.dispatchEvent(event);

      expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    it('outras teclas não acionam fileInput.click()', () => {
      const dropZone = document.getElementById('drop-zone') as HTMLDivElement;
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      const clickSpy = jest.spyOn(fileInput, 'click').mockImplementation(() => {});

      const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
      dropZone.dispatchEvent(event);

      expect(clickSpy).not.toHaveBeenCalled();
    });
  });

  describe('FormData enviado no upload', () => {
    it('contém o campo "file" com o File original', () => {
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      const file = makeFile('contrato.pdf', 4096, 'application/pdf');
      setInputFiles(fileInput, [file]);
      fireEvent(fileInput, 'change');

      const formData = FakeXhr.instances[0].sentBody as FormData;
      expect(formData.get('file')).toBe(file);
    });
  });
});
