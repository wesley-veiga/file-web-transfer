import { sanitizeFileName } from '../sanitizeFileName';

describe('sanitizeFileName', () => {
  describe('basic safe filenames', () => {
    it('should return unchanged safe filenames', () => {
      expect(sanitizeFileName('photo.jpg')).toBe('photo.jpg');
      expect(sanitizeFileName('document.pdf')).toBe('document.pdf');
      expect(sanitizeFileName('file-name_123.txt')).toBe('file-name_123.txt');
    });

    it('should handle filenames without extension', () => {
      expect(sanitizeFileName('README')).toBe('README');
      expect(sanitizeFileName('Makefile')).toBe('Makefile');
    });
  });

  describe('path traversal attacks', () => {
    it('should extract basename and remove path traversal (forward slash)', () => {
      expect(sanitizeFileName('../../etc/passwd')).toBe('passwd');
      expect(sanitizeFileName('../../../file.txt')).toBe('file.txt');
    });

    it('should extract basename and remove path traversal (backslash)', () => {
      expect(sanitizeFileName('..\\..\\windows\\system32\\config')).toBe(
        'config'
      );
      expect(sanitizeFileName('dir\\..\\..\\file.txt')).toBe('file.txt');
    });

    it('should handle mixed path separators', () => {
      expect(sanitizeFileName('dir/..\\another\\file.txt')).toBe('file.txt');
      expect(sanitizeFileName('../dir\\../file.txt')).toBe('file.txt');
    });

    it('should remove ".." sequences from basename', () => {
      expect(sanitizeFileName('foo/../../bar')).toBe('bar');
      expect(sanitizeFileName('file..name.txt')).toBe('filename.txt');
    });

    it('should handle complex traversal patterns', () => {
      expect(sanitizeFileName('../../..\\..\\.txt')).toBe('.txt');
      expect(sanitizeFileName('/etc/passwd')).toBe('passwd');
      expect(sanitizeFileName('\\etc\\passwd')).toBe('passwd');
    });
  });

  describe('control characters', () => {
    it('should remove null bytes', () => {
      expect(sanitizeFileName('file\x00.txt')).toBe('file.txt');
      expect(sanitizeFileName('\x00\x00file.txt')).toBe('file.txt');
      expect(sanitizeFileName('file\x00name\x00.txt')).toBe('filename.txt');
    });

    it('should remove other control characters (0x00-0x1F)', () => {
      expect(sanitizeFileName('file\x01.txt')).toBe('file.txt');
      expect(sanitizeFileName('file\x1F.txt')).toBe('file.txt');
      expect(sanitizeFileName('file\t\n\r.txt')).toBe('file.txt');
      expect(sanitizeFileName('\x01\x02\x03file.txt')).toBe('file.txt');
    });

    it('should remove DEL character (0x7F)', () => {
      expect(sanitizeFileName('file\x7F.txt')).toBe('file.txt');
      expect(sanitizeFileName('file\x7Fname.txt')).toBe('filename.txt');
    });

    it('should handle filenames with only control characters', () => {
      expect(sanitizeFileName('\x00\x01\x02')).toBe('arquivo');
      expect(sanitizeFileName('\x7F\x7F\x7F')).toBe('arquivo');
    });
  });

  describe('empty and whitespace-only names', () => {
    it('should handle empty string', () => {
      expect(sanitizeFileName('')).toBe('arquivo');
    });

    it('should handle whitespace-only filenames', () => {
      expect(sanitizeFileName('   ')).toBe('arquivo');
      expect(sanitizeFileName('\t\n\r')).toBe('arquivo');
    });

    it('should handle names that become empty after sanitization', () => {
      expect(sanitizeFileName('...')).toBe('arquivo');
      expect(sanitizeFileName('..')).toBe('arquivo');
      expect(sanitizeFileName('.')).toBe('arquivo');
      expect(sanitizeFileName('   ..   ')).toBe('arquivo');
    });
  });

  describe('truncation to 255 chars', () => {
    it('should not truncate names under 255 chars', () => {
      const name255 = 'a'.repeat(255);
      expect(sanitizeFileName(name255)).toBe(name255);
      expect(sanitizeFileName(name255).length).toBe(255);
    });

    it('should truncate names over 255 chars without extension', () => {
      const name300 = 'a'.repeat(300);
      expect(sanitizeFileName(name300).length).toBe(255);
      expect(sanitizeFileName(name300)).toBe('a'.repeat(255));
    });

    it('should preserve extension when truncating', () => {
      const longName = 'a'.repeat(300) + '.pdf';
      const result = sanitizeFileName(longName);
      expect(result.endsWith('.pdf')).toBe(true);
      expect(result.length).toBe(255);
      expect(result).toBe('a'.repeat(251) + '.pdf');
    });

    it('should handle long extensions', () => {
      const longExtension = 'a'.repeat(200) + '.' + 'b'.repeat(100);
      const result = sanitizeFileName(longExtension);
      expect(result.length).toBe(255);
    });

    it('should handle extension-only truncation edge case', () => {
      const veryLongExtension = 'a' + '.' + 'b'.repeat(300);
      const result = sanitizeFileName(veryLongExtension);
      expect(result.length).toBe(255);
    });
  });

  describe('special cases', () => {
    it('should handle names with leading/trailing spaces', () => {
      expect(sanitizeFileName('  file.txt  ')).toBe('file.txt');
      expect(sanitizeFileName('\n\rfile.txt\n\r')).toBe('file.txt');
    });

    it('should handle names with multiple dots', () => {
      expect(sanitizeFileName('file.name.with.dots.txt')).toBe(
        'file.name.with.dots.txt'
      );
    });

    it('should handle hidden files (starting with dot)', () => {
      expect(sanitizeFileName('.gitignore')).toBe('.gitignore');
      expect(sanitizeFileName('.env')).toBe('.env');
    });

    it('should handle unicode characters (should be preserved)', () => {
      expect(sanitizeFileName('arquivo_maçã.txt')).toBe('arquivo_maçã.txt');
      expect(sanitizeFileName('文件.pdf')).toBe('文件.pdf');
      expect(sanitizeFileName('ñoño_emoji_😀.txt')).toBe('ñoño_emoji_😀.txt');
    });

    it('should combine multiple sanitization rules', () => {
      // Path traversal + control chars + length
      const complex = '../../\x00' + 'a'.repeat(300) + '.txt';
      const result = sanitizeFileName(complex);
      expect(result.length).toBeLessThanOrEqual(255);
      expect(result.endsWith('.txt')).toBe(true);
      expect(result).not.toContain('..');
      expect(result).not.toContain('\x00');
    });
  });

  describe('regression: edge cases from spec', () => {
    it('should handle "..\\..\\windows\\system32\\config" correctly', () => {
      const result = sanitizeFileName('..\\..\\windows\\system32\\config');
      expect(result).toBe('config');
      expect(result).not.toContain('\\');
      expect(result).not.toContain('/');
      expect(result).not.toContain('..');
    });

    it('should handle "foo/../../bar" correctly', () => {
      const result = sanitizeFileName('foo/../../bar');
      expect(result).toBe('bar');
      expect(result).not.toContain('/');
      expect(result).not.toContain('..');
    });

    it('should safely handle names that are only dots and path separators', () => {
      expect(sanitizeFileName('../..')).toBe('arquivo');
      expect(sanitizeFileName('/./')).toBe('arquivo');
      expect(sanitizeFileName('\\.\\')).toBe('arquivo');
    });
  });
});
