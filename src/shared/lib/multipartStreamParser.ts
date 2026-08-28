/**
 * Parser multipart com streaming para uploads de arquivo grande.
 *
 * Processa multipart/form-data body incrementalmente, recebendo chunks
 * e mantendo um buffer interno LIMITADO (nunca o corpo inteiro).
 *
 * Especialmente robusta para boundaries cortados entre chunks.
 * Implementação pura (sem I/O, sem efeitos colaterais exceto buffer interno).
 *
 * Padrão de uso:
 *   const parser = createMultipartStreamParser('----boundary1234');
 *   chunk1.forEach(chunk => {
 *     const events = parser.feed(chunk);
 *     // processar eventos incrementalmente
 *   });
 *   const finalEvents = parser.finish(); // fechar parser, retorna último evento se houver
 *
 * Eventos emitidos:
 *   - { type: 'fileStart', filename, contentType } — descoberto field "file"
 *   - { type: 'fileData', data } — corpo do arquivo (raw data como string)
 *   - { type: 'fileEnd' } — encerrado o arquivo (boundary encontrado)
 *   - { type: 'malformed' } — corpo não bate em RFC 2388 (sem boundary, sem "file", etc)
 */

export type MultipartEvent =
  | { type: 'fileStart'; filename: string; contentType: string }
  | { type: 'fileData'; data: string }
  | { type: 'fileEnd' }
  | { type: 'malformed' };

/**
 * Cria um parser multipart com streaming.
 *
 * @param boundary — A string de boundary (ex.: "----WebKitFormBoundary...") extraída de Content-Type header.
 *   Nota: o boundary no body multipart é prefixado com "--" (CRLF--<boundary>CRLF),
 *   então o parser o adiciona automaticamente.
 *
 * @returns { feed, finish } — funções para alimentar chunks e finalizar parsing.
 */
export function createMultipartStreamParser(boundary: string): {
  feed: (chunkData: string) => MultipartEvent[];
  finish: () => MultipartEvent[];
} {
  // Buffer interno — mantém dados suficientes para detectar boundary cortado entre chunks
  let buffer = '';

  // Estado do parser
  let foundFileStart = false;
  let currentFilename = '';
  let currentContentType = '';
  let inFileBody = false;
  let isFinished = false;

  // Marker para boundary com CRLF
  const boundaryMarker = `\r\n--${boundary}`;
  // Tamanho máximo do buffer (evita leak de memória)
  const maxBufferSize = 64 * 1024; // 64 KB para detectar boundaries + headers + pequena quantidade de data

  /**
   * Alimenta um chunk ao parser.
   * Retorna lista de eventos gerados pelo chunk.
   */
  function feed(chunkData: string): MultipartEvent[] {
    if (isFinished) {
      return [];
    }

    const events: MultipartEvent[] = [];
    buffer += chunkData;

    // Se o buffer cresceu muito além do necessário, emite erro
    if (buffer.length > maxBufferSize && !inFileBody) {
      events.push({ type: 'malformed' });
      isFinished = true;
      return events;
    }

    // Processar eventos do buffer
    const processedEvents = processBuffer();
    events.push(...processedEvents);

    return events;
  }

  /**
   * Processa o buffer interno e extrai eventos.
   */
  function processBuffer(): MultipartEvent[] {
    const events: MultipartEvent[] = [];

    // Estado: procurando field "file" (headers)
    if (!foundFileStart) {
      // Procurar primeira ocorrência de "name=\"file\""
      const fileFieldIndex = buffer.indexOf('name="file"');
      if (fileFieldIndex === -1) {
        return events;
      }

      // Procurar Content-Disposition antes de name="file"
      const dispositionStart = buffer.lastIndexOf('Content-Disposition:', fileFieldIndex);
      if (dispositionStart === -1) {
        events.push({ type: 'malformed' });
        isFinished = true;
        return events;
      }

      // Extrair filename do header
      // Formato: Content-Disposition: form-data; name="file"; filename="myfile.txt"
      const filenameMatch =
        buffer.substring(dispositionStart).match(/filename="([^"]*)"/) ||
        buffer.substring(dispositionStart).match(/filename=([^;\r\n]*)/);

      if (!filenameMatch) {
        // Arquivo sem filename é malformado para nosso caso
        events.push({ type: 'malformed' });
        isFinished = true;
        return events;
      }

      currentFilename = filenameMatch[1];

      // Procurar Content-Type do arquivo (entre filename e próximo boundary/CRLF CRLF)
      const headerEndIndex = buffer.indexOf('\r\n\r\n', dispositionStart);
      if (headerEndIndex === -1) {
        // Headers incompletos, aguardar mais dados
        return events;
      }

      const headerSection = buffer.substring(dispositionStart, headerEndIndex);
      const contentTypeMatch = headerSection.match(/Content-Type:\s*([^\r\n]*)/);
      currentContentType = contentTypeMatch
        ? contentTypeMatch[1].trim()
        : 'application/octet-stream';

      // Marcar que encontrou o field "file"
      foundFileStart = true;
      inFileBody = true;
      events.push({
        type: 'fileStart',
        filename: currentFilename,
        contentType: currentContentType,
      });

      // Remover headers do buffer (tudo até "\r\n\r\n" inclusivo)
      buffer = buffer.substring(headerEndIndex + 4);

      // Continuar processando para emitir fileData
      return events.concat(processBuffer());
    }

    // Estado: dentro do corpo do arquivo (inFileBody)
    if (inFileBody) {
      // Procurar boundary final ou intermediário
      const boundaryIndex = buffer.indexOf(boundaryMarker);

      if (boundaryIndex === -1) {
        // Boundary não encontrado neste chunk
        // Emitir tudo exceto os últimos bytes (que podem ser início de boundary)
        const keepSize = boundaryMarker.length - 1; // manter último byte em caso de boundary cortado
        if (buffer.length > keepSize) {
          const dataToEmit = buffer.substring(0, buffer.length - keepSize);
          events.push({ type: 'fileData', data: dataToEmit });
          buffer = buffer.substring(buffer.length - keepSize);
        }
        return events;
      }

      // Boundary encontrado
      const dataBeforeBoundary = buffer.substring(0, boundaryIndex);

      // Emitir dados antes do boundary
      if (dataBeforeBoundary) {
        events.push({ type: 'fileData', data: dataBeforeBoundary });
      }

      // Remover dados emitidos + boundary do buffer
      buffer = buffer.substring(boundaryIndex + boundaryMarker.length);

      // Verificar se é final boundary (--<boundary>--)
      if (buffer.startsWith('--')) {
        // Final boundary encontrado
        events.push({ type: 'fileEnd' });
        inFileBody = false;
        isFinished = true;
      } else {
        // Boundary intermediário (mais campos), mas esperamos apenas "file"
        // Parar parsing
        events.push({ type: 'fileEnd' });
        inFileBody = false;
        isFinished = true;
      }

      return events;
    }

    return events;
  }

  /**
   * Finaliza o parsing.
   * Chamado após o último chunk (chunk.isLast === true).
   */
  function finish(): MultipartEvent[] {
    if (isFinished) {
      return [];
    }

    const events: MultipartEvent[] = [];

    // Se estamos dentro do corpo e temos buffer restante, emitir como dados
    if (inFileBody && buffer.length > 0) {
      events.push({ type: 'fileData', data: buffer });
      buffer = '';
    }

    if (inFileBody) {
      // Se terminou enquanto inFileBody, é malformado (boundary final ausente)
      events.push({ type: 'malformed' });
    } else if (!foundFileStart) {
      // Nunca encontrou field "file"
      events.push({ type: 'malformed' });
    }

    isFinished = true;
    return events;
  }

  return { feed, finish };
}
