import { sanitizeFileName, resolveDuplicateName } from '../index';

describe('shared/lib — barrel exports', () => {
  it('should export sanitizeFileName from barrel', () => {
    expect(sanitizeFileName).toBeDefined();
    expect(typeof sanitizeFileName).toBe('function');
  });

  it('should export resolveDuplicateName from barrel', () => {
    expect(resolveDuplicateName).toBeDefined();
    expect(typeof resolveDuplicateName).toBe('function');
  });

  it('should call sanitizeFileName via barrel correctly', () => {
    const result = sanitizeFileName('../../etc/passwd');
    expect(result).toBe('passwd');
  });

  it('should call resolveDuplicateName via barrel correctly', () => {
    const result = resolveDuplicateName('file.txt', ['file.txt']);
    expect(result).toBe('file (1).txt');
  });
});
