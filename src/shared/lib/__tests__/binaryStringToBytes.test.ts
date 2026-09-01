import { binaryStringToBytes } from '../binaryStringToBytes';

describe('binaryStringToBytes', () => {
  it('retorna um Uint8Array vazio para uma string vazia', () => {
    const result = binaryStringToBytes('');

    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(0);
  });

  it('converte uma string de 1 char corretamente', () => {
    const result = binaryStringToBytes('A');

    expect(result.length).toBe(1);
    expect(result[0]).toBe(0x41);
  });

  it('converte um char code de 1 byte pouco antes do limite ASCII (0x7f)', () => {
    const result = binaryStringToBytes(String.fromCharCode(0x7f));

    expect(result.length).toBe(1);
    expect(result[0]).toBe(0x7f);
  });

  it('converte um único char code >= 0x80 para um único byte de saída, sem reinterpretação UTF-8', () => {
    // Este é o caso crítico: se houvesse qualquer passagem por UTF-8 (Buffer.from(s, 'utf8'),
    // TextEncoder, etc.), um char code como 0xff viraria 2 bytes de saída (0xc3 0xbf em UTF-8),
    // não 1. binaryStringToBytes deve produzir exatamente 1 byte de saída por char de entrada.
    const result = binaryStringToBytes(String.fromCharCode(0xff));

    expect(result.length).toBe(1);
    expect(result[0]).toBe(0xff);
  });

  it('converte todos os 256 valores de byte (0-255) preservando cada valor exatamente, sem expansão multi-byte', () => {
    // String "binary" (latin1): um char code = um byte. Constrói uma string contendo,
    // em ordem, os char codes 0..255 — cobre toda a faixa de um byte, incluindo todos
    // os valores >= 0x80 que a codificação UTF-8 padrão do nativo Android corrompia
    // (bug de T-701: jpeg/mov corrompidos ao chegar no host).
    const allByteValues = Array.from({ length: 256 }, (_, i) => i);
    const binaryString = String.fromCharCode(...allByteValues);

    const result = binaryStringToBytes(binaryString);

    // Nenhum byte >= 0x80 pode virar mais de 1 byte de saída: o comprimento do
    // Uint8Array resultante deve ser exatamente igual ao número de chars de entrada,
    // nunca maior (o que aconteceria com reinterpretação UTF-8 de bytes altos).
    expect(result.length).toBe(binaryString.length);
    expect(result.length).toBe(256);
    expect(Array.from(result)).toEqual(allByteValues);
  });

  it('preserva bytes >= 0x80 individualmente em uma sequência mista com bytes ASCII', () => {
    // Magic bytes de JPEG (mesmos usados no teste de integração de fileRepositoryFactory
    // para T-701) intercalados com bytes ASCII, para garantir que a conversão não trata
    // bytes altos e baixos de forma diferente dentro da mesma string.
    const rawBytes = [0x41, 0xff, 0xd8, 0x42, 0xff, 0xe0, 0x00, 0x10, 0x80, 0x43];
    const binaryString = String.fromCharCode(...rawBytes);

    const result = binaryStringToBytes(binaryString);

    expect(result.length).toBe(rawBytes.length);
    expect(Array.from(result)).toEqual(rawBytes);
  });

  it('mascara corretamente com & 0xff mesmo que o char code exceda 0xff (defensivo)', () => {
    // Char codes de string "binary" nunca deveriam exceder 0xff na prática (invariante
    // de quem produz a string, ver nativeHttpModule.ts), mas a implementação aplica
    // `& 0xff` explicitamente — este teste documenta esse comportamento defensivo.
    const result = binaryStringToBytes(String.fromCharCode(0x1ff));

    expect(result[0]).toBe(0xff);
  });

  it('não perde nem desloca bytes em uma string grande (verifica ausência de erro de índice/off-by-one)', () => {
    // Alguns milhares de chars, com um padrão que repete todos os 256 valores de byte,
    // para detectar qualquer off-by-one no loop manual (índice inicial errado, laço
    // terminando um elemento antes/depois do esperado, etc.).
    const size = 5000;
    const expected = Array.from({ length: size }, (_, i) => i % 256);
    const binaryString = String.fromCharCode(...expected);

    const result = binaryStringToBytes(binaryString);

    expect(result.length).toBe(size);
    // Confere o primeiro, o último e um índice do meio individualmente (localiza
    // rapidamente um off-by-one caso o teste falhe) além da comparação completa.
    expect(result[0]).toBe(expected[0]);
    expect(result[size - 1]).toBe(expected[size - 1]);
    expect(result[Math.floor(size / 2)]).toBe(expected[Math.floor(size / 2)]);
    expect(Array.from(result)).toEqual(expected);
  });

  it('retorna uma nova instância de Uint8Array a cada chamada (não reutiliza buffer entre chamadas)', () => {
    const first = binaryStringToBytes('ab');
    const second = binaryStringToBytes('cd');

    expect(first).not.toBe(second);
    expect(Array.from(first)).toEqual([0x61, 0x62]);
    expect(Array.from(second)).toEqual([0x63, 0x64]);
  });
});
