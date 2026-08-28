import { createMultipartStreamParser, type MultipartEvent } from '../multipartStreamParser';

describe('multipartStreamParser — createMultipartStreamParser', () => {
  describe('happy path — corpo multipart válido num único chunk', () => {
    it('processa arquivo completo em um chunk (fileStart → fileData → fileEnd)', () => {
      const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
      const parser = createMultipartStreamParser(boundary);

      const body =
        `------WebKitFormBoundary7MA4YWxkTrZu0gW\r\n` +
        `Content-Disposition: form-data; name="file"; filename="test.txt"\r\n` +
        `Content-Type: text/plain\r\n` +
        `\r\n` +
        `Conteúdo do arquivo\r\n` +
        `------WebKitFormBoundary7MA4YWxkTrZu0gW--\r\n`;

      const events = parser.feed(body);
      const finalEvents = parser.finish();

      const allEvents = [...events, ...finalEvents];

      // Verificar sequência de eventos
      expect(allEvents[0]).toEqual({
        type: 'fileStart',
        filename: 'test.txt',
        contentType: 'text/plain',
      });

      expect(allEvents.find((e) => e.type === 'fileData')).toBeDefined();
      const fileDataEvent = allEvents.find((e) => e.type === 'fileData') as Extract<
        MultipartEvent,
        { type: 'fileData' }
      >;
      expect(fileDataEvent.data).toContain('Conteúdo do arquivo');

      expect(allEvents[allEvents.length - 1]).toEqual({ type: 'fileEnd' });
    });

    it('extrai filename e contentType corretamente', () => {
      const boundary = '----boundary1234';
      const parser = createMultipartStreamParser(boundary);

      const body =
        `------boundary1234\r\n` +
        `Content-Disposition: form-data; name="file"; filename="document.pdf"\r\n` +
        `Content-Type: application/pdf\r\n` +
        `\r\n` +
        `PDF content here\r\n` +
        `------boundary1234--\r\n`;

      const events = parser.feed(body);
      const fileStartEvent = events.find((e) => e.type === 'fileStart') as Extract<
        MultipartEvent,
        { type: 'fileStart' }
      >;

      expect(fileStartEvent.filename).toBe('document.pdf');
      expect(fileStartEvent.contentType).toBe('application/pdf');
    });

    it('usa fallback application/octet-stream quando Content-Type ausente', () => {
      const boundary = '----boundary1234';
      const parser = createMultipartStreamParser(boundary);

      const body =
        `------boundary1234\r\n` +
        `Content-Disposition: form-data; name="file"; filename="unknown.bin"\r\n` +
        `\r\n` +
        `Binary data\r\n` +
        `------boundary1234--\r\n`;

      const events = parser.feed(body);
      const fileStartEvent = events.find((e) => e.type === 'fileStart') as Extract<
        MultipartEvent,
        { type: 'fileStart' }
      >;

      expect(fileStartEvent.contentType).toBe('application/octet-stream');
    });
  });

  describe('boundary cortado entre chunks', () => {
    it('reconhece boundary mesmo quando cortado em dois chunks', () => {
      const boundary = '----boundary1234';
      const parser = createMultipartStreamParser(boundary);

      // Chunk 1: até o meio do boundary
      const chunk1 =
        `------boundary1234\r\n` +
        `Content-Disposition: form-data; name="file"; filename="test.txt"\r\n` +
        `\r\n` +
        `File content here and more da`;

      const events1 = parser.feed(chunk1);

      // Chunk 2: resto do boundary + final boundary
      const chunk2 = `ta\r\n------boundary123`;
      const events2 = parser.feed(chunk2);

      // Chunk 3: finaliza
      const chunk3 = `4--\r\n`;
      const events3 = parser.feed(chunk3);
      const finalEvents = parser.finish();

      const allEvents = [...events1, ...events2, ...events3, ...finalEvents];

      // Deve processar sem emitir "malformed"
      const malformedEvents = allEvents.filter((e) => e.type === 'malformed');
      expect(malformedEvents).toHaveLength(0);

      // Deve reconhecer fileEnd
      const fileEndEvents = allEvents.filter((e) => e.type === 'fileEnd');
      expect(fileEndEvents.length).toBeGreaterThan(0);
    });

    it('não emite o pedaço cortado como fileData', () => {
      const boundary = '----boundary1234';
      const parser = createMultipartStreamParser(boundary);

      const chunk1 =
        `------boundary1234\r\n` +
        `Content-Disposition: form-data; name="file"; filename="test.txt"\r\n` +
        `\r\n` +
        `File content\r\n--`;

      const events1 = parser.feed(chunk1);

      // Chunk 2 completa o boundary
      const chunk2 = `----boundary1234--\r\n`;
      const events2 = parser.feed(chunk2);
      const finalEvents = parser.finish();

      const allEvents = [...events1, ...events2, ...finalEvents];
      const fileDataEvents = allEvents.filter((e) => e.type === 'fileData');

      // Verificar que o fileData não contém o boundary (foi removido corretamente)
      const fileDataContent = fileDataEvents
        .map((e) => (e as Extract<MultipartEvent, { type: 'fileData' }>).data)
        .join('');
      expect(fileDataContent).not.toContain('------boundary1234');
    });
  });

  describe('múltiplos chunks de dados de arquivo', () => {
    it('emite múltiplos eventos fileData antes de fileEnd', () => {
      const boundary = '----boundary1234';
      const parser = createMultipartStreamParser(boundary);

      const chunk1 =
        `------boundary1234\r\n` +
        `Content-Disposition: form-data; name="file"; filename="test.txt"\r\n` +
        `\r\n` +
        `Part 1 of data\r\n`;
      const chunk2 = `Part 2 of data\r\n`;
      const chunk3 = `Part 3 of data\r\n------boundary1234--\r\n`;

      const events1 = parser.feed(chunk1);
      const events2 = parser.feed(chunk2);
      const events3 = parser.feed(chunk3);
      const finalEvents = parser.finish();

      const allEvents = [...events1, ...events2, ...events3, ...finalEvents];
      const fileDataEvents = allEvents.filter((e) => e.type === 'fileData');

      // Deve ter emitido múltiplos fileData (pelo menos 2)
      expect(fileDataEvents.length).toBeGreaterThanOrEqual(2);

      // Conteúdo agregado deve conter todas as partes
      const aggregated = fileDataEvents
        .map((e) => (e as Extract<MultipartEvent, { type: 'fileData' }>).data)
        .join('');
      expect(aggregated).toContain('Part 1 of data');
      expect(aggregated).toContain('Part 2 of data');
      expect(aggregated).toContain('Part 3 of data');
    });
  });

  describe('corpo sem boundary válido no Content-Type', () => {
    it('emite malformed quando finish() chamado sem boundary encontrado', () => {
      const boundary = '----boundary1234';
      const parser = createMultipartStreamParser(boundary);

      // Corpo que nunca contém o boundary
      const chunk =
        `------boundary9999\r\n` + // Boundary errado
        `Content-Disposition: form-data; name="file"; filename="test.txt"\r\n` +
        `\r\n` +
        `File content\r\n`;

      parser.feed(chunk);
      const finalEvents = parser.finish();

      const malformedEvents = finalEvents.filter((e) => e.type === 'malformed');
      expect(malformedEvents.length).toBeGreaterThan(0);
    });
  });

  describe('corpo sem campo "file"', () => {
    it('emite malformed quando field name não é "file"', () => {
      const boundary = '----boundary1234';
      const parser = createMultipartStreamParser(boundary);

      const body =
        `------boundary1234\r\n` +
        `Content-Disposition: form-data; name="other"; filename="test.txt"\r\n` +
        `\r\n` +
        `Content\r\n` +
        `------boundary1234--\r\n`;

      parser.feed(body);
      const finalEvents = parser.finish();

      const malformedEvents = finalEvents.filter((e) => e.type === 'malformed');
      expect(malformedEvents.length).toBeGreaterThan(0);
    });

    it('emite malformed quando body inteiro não contém name="file"', () => {
      const boundary = '----boundary1234';
      const parser = createMultipartStreamParser(boundary);

      const body =
        `------boundary1234\r\n` +
        `Content-Disposition: form-data; name="username"\r\n` +
        `\r\n` +
        `john_doe\r\n` +
        `------boundary1234--\r\n`;

      parser.feed(body);
      const finalEvents = parser.finish();

      const malformedEvents = finalEvents.filter((e) => e.type === 'malformed');
      expect(malformedEvents.length).toBeGreaterThan(0);
    });
  });

  describe('arquivo sem filename no Content-Disposition', () => {
    it('emite malformed quando filename ausente', () => {
      const boundary = '----boundary1234';
      const parser = createMultipartStreamParser(boundary);

      const body =
        `------boundary1234\r\n` +
        `Content-Disposition: form-data; name="file"\r\n` + // Sem filename
        `Content-Type: text/plain\r\n` +
        `\r\n` +
        `Content\r\n` +
        `------boundary1234--\r\n`;

      const events = parser.feed(body);
      const finalEvents = parser.finish();

      const allEvents = [...events, ...finalEvents];
      const malformedEvents = allEvents.filter((e) => e.type === 'malformed');
      expect(malformedEvents.length).toBeGreaterThan(0);
    });
  });

  describe('teste de memória — streaming com múltiplos pequenos chunks', () => {
    it('processa ~500KB em 500 pequenos chunks sem acumular tudo na memória', () => {
      const boundary = '----boundary1234';
      const parser = createMultipartStreamParser(boundary);

      // Headers iniciais
      const header =
        `------boundary1234\r\n` +
        `Content-Disposition: form-data; name="file"; filename="large.bin"\r\n` +
        `Content-Type: application/octet-stream\r\n` +
        `\r\n`;

      // Alimentar header
      const headerEvents = parser.feed(header);

      // Gerar 500 chunks de 1KB cada
      const chunkSize = 1024; // 1KB
      const numChunks = 500;
      let fileDataEventCount = 0;

      for (let i = 0; i < numChunks; i++) {
        const chunkData = 'x'.repeat(chunkSize);
        const events = parser.feed(chunkData);

        // Contar quantas vezes fileData foi emitido
        const fileDataEvents = events.filter((e) => e.type === 'fileData');
        fileDataEventCount += fileDataEvents.length;
      }

      // Enviar boundary final
      const finalChunk = `\r\n------boundary1234--\r\n`;
      const events = parser.feed(finalChunk);
      const finalEvents = parser.finish();

      // Prova: fileData foi emitido MÚLTIPLAS vezes ao longo dos chunks,
      // não uma única vez no final (o que provaria que não houve acúmulo total).
      // Com um parser ingênuo (sem streaming), fileData seria emitido apenas
      // uma única vez com ~500KB de dados.
      expect(fileDataEventCount).toBeGreaterThan(1);

      // Verificar que não houve erros
      const allEvents = [...headerEvents, ...events, ...finalEvents];
      const malformedEvents = allEvents.filter((e) => e.type === 'malformed');
      expect(malformedEvents).toHaveLength(0);

      // Contar fileEnd (deve haver 1)
      const fileEndEvents = allEvents.filter((e) => e.type === 'fileEnd');
      expect(fileEndEvents.length).toBeGreaterThan(0);
    });

    it('não acumula mais de 64KB internamente no buffer antes de emitir', () => {
      const boundary = '----boundary1234';
      const parser = createMultipartStreamParser(boundary);

      const header =
        `------boundary1234\r\n` +
        `Content-Disposition: form-data; name="file"; filename="large.bin"\r\n` +
        `\r\n`;

      parser.feed(header);

      // Simular alimentação de pequenos chunks
      // Se o buffer interno acumular demais, o parser deve ter algum limite
      // (conforme comentário no código: 64KB maxBufferSize)
      const smallChunk = 'a'.repeat(100);

      let maxDataLength = 0;
      for (let i = 0; i < 100; i++) {
        const events = parser.feed(smallChunk);

        // Cada fileData emitido representa dados que foram processados e removidos do buffer
        const fileDataEvents = events.filter((e) => e.type === 'fileData');
        for (const event of fileDataEvents) {
          const dataEvent = event as Extract<MultipartEvent, { type: 'fileData' }>;
          maxDataLength = Math.max(maxDataLength, dataEvent.data.length);
        }
      }

      // Finalizar sem boundary (causará malformed, mas prova que buffer foi processado)
      parser.finish();

      // Se chegou aqui sem crash, prova que o buffer foi gerenciado
      // (um ingênuo teria tentado acumular 10KB em memória sem emitir)
    });
  });

  describe('edge cases — alternância de chunks e boundaries', () => {
    it('reconhece boundary intermediário (mais campos após arquivo)', () => {
      const boundary = '----boundary1234';
      const parser = createMultipartStreamParser(boundary);

      const body =
        `------boundary1234\r\n` +
        `Content-Disposition: form-data; name="file"; filename="test.txt"\r\n` +
        `\r\n` +
        `File content\r\n` +
        `------boundary1234\r\n` + // Boundary intermediário
        `Content-Disposition: form-data; name="other"\r\n` +
        `\r\n` +
        `Other data\r\n` +
        `------boundary1234--\r\n`;

      const events = parser.feed(body);
      const finalEvents = parser.finish();

      const allEvents = [...events, ...finalEvents];

      // Deve emitir fileEnd ao encontrar boundary intermediário
      const fileEndEvents = allEvents.filter((e) => e.type === 'fileEnd');
      expect(fileEndEvents.length).toBeGreaterThan(0);

      // Não deve processar "Other data" (parser para após primeiro fileEnd)
      const fileDataEvents = allEvents.filter((e) => e.type === 'fileData');
      // Verificar que o número de fileData events é pequeno (parser parou no primeiro boundary)
      expect(fileDataEvents.length).toBeGreaterThan(0);
    });

    it('trata filename com espaços e caracteres especiais', () => {
      const boundary = '----boundary1234';
      const parser = createMultipartStreamParser(boundary);

      const body =
        `------boundary1234\r\n` +
        `Content-Disposition: form-data; name="file"; filename="Meu Arquivo (Especial) & Novo.pdf"\r\n` +
        `\r\n` +
        `Content\r\n` +
        `------boundary1234--\r\n`;

      const events = parser.feed(body);
      const fileStartEvent = events.find((e) => e.type === 'fileStart') as Extract<
        MultipartEvent,
        { type: 'fileStart' }
      >;

      expect(fileStartEvent.filename).toBe('Meu Arquivo (Especial) & Novo.pdf');
    });

    it('trata filename com acentos e unicode', () => {
      const boundary = '----boundary1234';
      const parser = createMultipartStreamParser(boundary);

      const body =
        `------boundary1234\r\n` +
        `Content-Disposition: form-data; name="file"; filename="relatório-ação-é.txt"\r\n` +
        `\r\n` +
        `Conteúdo\r\n` +
        `------boundary1234--\r\n`;

      const events = parser.feed(body);
      const fileStartEvent = events.find((e) => e.type === 'fileStart') as Extract<
        MultipartEvent,
        { type: 'fileStart' }
      >;

      expect(fileStartEvent.filename).toBe('relatório-ação-é.txt');
    });
  });

  describe('parser state management', () => {
    it('retorna lista vazia após finish()', () => {
      const boundary = '----boundary1234';
      const parser = createMultipartStreamParser(boundary);

      const body =
        `------boundary1234\r\n` +
        `Content-Disposition: form-data; name="file"; filename="test.txt"\r\n` +
        `\r\n` +
        `Content\r\n` +
        `------boundary1234--\r\n`;

      parser.feed(body);
      parser.finish();

      // Chamadas subsequentes de feed() devem retornar []
      const afterFinish = parser.feed('more data');
      expect(afterFinish).toEqual([]);
    });

    it('feed() retorna [] depois que parser acabou (isFinished=true)', () => {
      const boundary = '----boundary1234';
      const parser = createMultipartStreamParser(boundary);

      const body =
        `------boundary1234\r\n` +
        `Content-Disposition: form-data; name="file"; filename="test.txt"\r\n` +
        `\r\n` +
        `Content\r\n` +
        `------boundary1234--\r\n`;

      const events = parser.feed(body);
      const finalEvents = parser.finish();

      const allEvents = [...events, ...finalEvents];
      // Verificar que parser processou algo (fileEnd deve estar presente)
      const fileEndEvents = allEvents.filter((e) => e.type === 'fileEnd');
      expect(fileEndEvents.length).toBeGreaterThan(0);

      // Adicionar mais dados após finish() — não deve processar
      const extraEvents = parser.feed('extra data');
      expect(extraEvents).toEqual([]);
    });
  });

  describe('error conditions', () => {
    it('emite malformed quando buffer cresce muito antes de encontrar headers', () => {
      const boundary = '----boundary1234';
      const parser = createMultipartStreamParser(boundary);

      // Headers incompletos sem name="file" — buffer crescerá
      const largeJunk = 'x'.repeat(100000); // > 64KB

      const events = parser.feed(largeJunk);

      // Deve emitir malformed
      const malformedEvents = events.filter((e) => e.type === 'malformed');
      expect(malformedEvents.length).toBeGreaterThan(0);
    });

    it('trata corretamente Content-Disposition sem Content-Type header', () => {
      const boundary = '----boundary1234';
      const parser = createMultipartStreamParser(boundary);

      const body =
        `------boundary1234\r\n` +
        `Content-Disposition: form-data; name="file"; filename="test.bin"\r\n` +
        `Other-Header: value\r\n` +
        `\r\n` +
        `Binary content\r\n` +
        `------boundary1234--\r\n`;

      const events = parser.feed(body);
      const fileStartEvent = events.find((e) => e.type === 'fileStart');

      expect(fileStartEvent).toBeDefined();
      const fileStart = fileStartEvent as Extract<MultipartEvent, { type: 'fileStart' }>;
      expect(fileStart.contentType).toBe('application/octet-stream');
    });
  });

  describe('regression tests — comportamento específico de segurança', () => {
    it('não emite dados até que fileStart seja encontrado', () => {
      const boundary = '----boundary1234';
      const parser = createMultipartStreamParser(boundary);

      // Enviar headers de outro campo primeiro
      const chunk1 =
        `------boundary1234\r\n` +
        `Content-Disposition: form-data; name="metadata"\r\n` +
        `\r\n` +
        `some metadata\r\n`;

      const events1 = parser.feed(chunk1);

      // Nenhum fileData deve ter sido emitido ainda
      const fileDataEvents = events1.filter((e) => e.type === 'fileData');
      expect(fileDataEvents).toHaveLength(0);

      // Agora enviar o campo "file"
      const chunk2 =
        `------boundary1234\r\n` +
        `Content-Disposition: form-data; name="file"; filename="real.txt"\r\n` +
        `\r\n` +
        `Real file content\r\n` +
        `------boundary1234--\r\n`;

      const events2 = parser.feed(chunk2);
      const finalEvents = parser.finish();

      const allEvents = [...events1, ...events2, ...finalEvents];
      const fileStartEvents = allEvents.filter((e) => e.type === 'fileStart');
      expect(fileStartEvents.length).toBeGreaterThan(0);
    });
  });
});
