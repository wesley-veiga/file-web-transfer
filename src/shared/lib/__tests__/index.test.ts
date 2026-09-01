import {
  sanitizeFileName,
  resolveDuplicateName,
  generateSessionId,
  createMultipartStreamParser,
  binaryStringToBytes,
} from '../index';

describe('shared/lib — barrel exports', () => {
  it('should export sanitizeFileName from barrel', () => {
    expect(sanitizeFileName).toBeDefined();
    expect(typeof sanitizeFileName).toBe('function');
  });

  it('should export resolveDuplicateName from barrel', () => {
    expect(resolveDuplicateName).toBeDefined();
    expect(typeof resolveDuplicateName).toBe('function');
  });

  it('should export generateSessionId from barrel', () => {
    expect(generateSessionId).toBeDefined();
    expect(typeof generateSessionId).toBe('function');
  });

  it('should call sanitizeFileName via barrel correctly', () => {
    const result = sanitizeFileName('../../etc/passwd');
    expect(result).toBe('passwd');
  });

  it('should call resolveDuplicateName via barrel correctly', () => {
    const result = resolveDuplicateName('file.txt', ['file.txt']);
    expect(result).toBe('file (1).txt');
  });

  it('should call generateSessionId via barrel correctly', () => {
    const sessionId = generateSessionId(() => 0.5);
    // Verifica que é string no formato palavra-NN
    expect(typeof sessionId).toBe('string');
    expect(sessionId).toMatch(/^[a-záàâãéèêíïóôõöúçñ]+-\d{2}$/);
    // Com rng 0.5: palavra no índice 20 e número 50
    expect(sessionId).toMatch(/-50$/);
  });

  it('should generate different sessionIds with different RNG values via barrel', () => {
    const id1 = generateSessionId(() => 0.1);
    const id2 = generateSessionId(() => 0.9);
    // Devem ser diferentes (diferentes valores de RNG)
    expect(id1).not.toBe(id2);
    // Ambos devem ser válidos
    expect(id1).toMatch(/^[a-záàâãéèêíïóôõöúçñ]+-\d{2}$/);
    expect(id2).toMatch(/^[a-záàâãéèêíïóôõöúçñ]+-\d{2}$/);
  });

  it('should export createMultipartStreamParser from barrel', () => {
    expect(createMultipartStreamParser).toBeDefined();
    expect(typeof createMultipartStreamParser).toBe('function');
  });

  it('should call createMultipartStreamParser via barrel correctly', () => {
    const parser = createMultipartStreamParser('boundary');
    expect(typeof parser.feed).toBe('function');
    expect(typeof parser.finish).toBe('function');
  });

  it('should export binaryStringToBytes from barrel', () => {
    expect(binaryStringToBytes).toBeDefined();
    expect(typeof binaryStringToBytes).toBe('function');
  });

  it('should call binaryStringToBytes via barrel correctly', () => {
    const result = binaryStringToBytes(String.fromCharCode(0x41, 0xff));
    expect(Array.from(result)).toEqual([0x41, 0xff]);
  });
});
