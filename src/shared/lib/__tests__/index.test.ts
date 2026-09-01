import {
  sanitizeFileName,
  resolveDuplicateName,
  generateSessionId,
  createMultipartStreamParser,
  hashFileSha256,
  IncrementalSha256,
  type HashableFileSystem,
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

  it('should export IncrementalSha256 from barrel and compute a hash (T-805)', () => {
    expect(IncrementalSha256).toBeDefined();

    const hasher = new IncrementalSha256();
    hasher.update(Buffer.from('abc', 'utf8'));

    expect(hasher.digest()).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('should export hashFileSha256 from barrel and hash a mocked file (T-805)', async () => {
    expect(hashFileSha256).toBeDefined();

    const content = Buffer.from('conteúdo via barrel', 'utf8');
    const fs: HashableFileSystem = {
      getInfoAsync: async () => ({ exists: true, size: content.length }),
      readAsStringAsync: async () => content.toString('base64'),
    };

    const hash = await hashFileSha256('file:///via-barrel.txt', fs);

    expect(typeof hash).toBe('string');
    expect(hash).toHaveLength(64);
  });
});
