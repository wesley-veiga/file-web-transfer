import { sanitizeFileName } from '../sanitizeFileName';

describe('sanitizeFileName - Advanced Security Vectors', () => {
  describe('extreme length cases', () => {
    it('should handle extremely long names (>1000 chars) without extension', () => {
      const veryLongName = 'a'.repeat(1000);
      const result = sanitizeFileName(veryLongName);
      expect(result.length).toBe(255);
      expect(result).toBe('a'.repeat(255));
    });

    it('should handle extremely long names with extension preserved', () => {
      const veryLongName = 'a'.repeat(1000) + '.pdf';
      const result = sanitizeFileName(veryLongName);
      expect(result.length).toBe(255);
      expect(result.endsWith('.pdf')).toBe(true);
      expect(result).toBe('a'.repeat(251) + '.pdf');
    });

    it('should handle names at exactly the boundary (255 chars)', () => {
      const exactName = 'b'.repeat(251) + '.txt';
      const result = sanitizeFileName(exactName);
      expect(result.length).toBe(255);
      expect(result).toBe(exactName);
    });

    it('should handle names just over the boundary (256 chars)', () => {
      const overName = 'c'.repeat(252) + '.txt';
      const result = sanitizeFileName(overName);
      expect(result.length).toBe(255);
      expect(result.endsWith('.txt')).toBe(true);
    });
  });

  describe('null bytes in various positions', () => {
    it('should remove null bytes from the beginning', () => {
      expect(sanitizeFileName('\x00\x00file.txt')).toBe('file.txt');
    });

    it('should remove null bytes from the middle', () => {
      expect(sanitizeFileName('file\x00middle\x00name.txt')).toBe('filemiddlename.txt');
    });

    it('should remove null bytes from the end', () => {
      expect(sanitizeFileName('file.txt\x00\x00')).toBe('file.txt');
    });

    it('should remove all null bytes even if scattered throughout', () => {
      expect(sanitizeFileName('\x00f\x00i\x00l\x00e\x00.\x00t\x00x\x00t\x00')).toBe('file.txt');
    });
  });

  describe('control characters edge cases', () => {
    it('should remove all control characters from 0x00 to 0x1F', () => {
      let testString = 'file';
      for (let i = 0; i <= 0x1f; i++) {
        testString += String.fromCharCode(i);
      }
      testString += '.txt';
      const result = sanitizeFileName(testString);
      expect(result).toBe('file.txt');
      // Verify no control characters remain
      for (let i = 0; i <= 0x1f; i++) {
        expect(result).not.toContain(String.fromCharCode(i));
      }
    });

    it('should remove DEL character (0x7F)', () => {
      const testString = 'file\x7F.txt';
      const result = sanitizeFileName(testString);
      expect(result).toBe('file.txt');
      expect(result).not.toContain('\x7F');
    });

    it('should preserve printable characters in extended ASCII range (>0x7F)', () => {
      // Characters like ™, ©, etc. should be preserved
      const testString = 'file™©®.txt';
      const result = sanitizeFileName(testString);
      expect(result).toBe('file™©®.txt');
    });
  });

  describe('path traversal variants and bypasses', () => {
    it('should extract basename when given percent-encoded path', () => {
      // %2e%2e is not treated as .. unless decoded separately
      const result = sanitizeFileName('%2e%2e/file.txt');
      expect(result).toBe('file.txt');
    });

    it('should handle unicode path traversal attempts', () => {
      // Unicode dot: ．(U+FF0E fullwidth full stop) is NOT treated as path separator
      const result = sanitizeFileName('..．．/file.txt');
      // After basename extraction at /, we get 'file.txt'
      expect(result).toBe('file.txt');
    });

    it('should handle multiple consecutive path separators', () => {
      expect(sanitizeFileName('///file.txt')).toBe('file.txt');
      expect(sanitizeFileName('\\\\\\file.txt')).toBe('file.txt');
    });

    it('should handle path traversal followed by safe characters', () => {
      expect(sanitizeFileName('../../file.txt')).toBe('file.txt');
      expect(sanitizeFileName('../../../file.txt')).toBe('file.txt');
    });

    it('should handle path traversal embedded in filename', () => {
      expect(sanitizeFileName('my..file.txt')).toBe('myfile.txt');
      expect(sanitizeFileName('..hidden.txt')).toBe('hidden.txt');
    });
  });

  describe('whitespace handling', () => {
    it('should handle trailing whitespace with extension', () => {
      expect(sanitizeFileName('file.txt   ')).toBe('file.txt');
      expect(sanitizeFileName('file.txt\t\n\r')).toBe('file.txt');
    });

    it('should handle internal whitespace preservation', () => {
      expect(sanitizeFileName('my  file.txt')).toBe('my  file.txt');
      expect(sanitizeFileName('file  with  spaces.pdf')).toBe('file  with  spaces.pdf');
    });

    it('should handle mixed whitespace types', () => {
      expect(sanitizeFileName('  \t\n file.txt \r  ')).toBe('file.txt');
    });
  });

  describe('special filesystem characters', () => {
    it('should preserve hyphens and underscores', () => {
      expect(sanitizeFileName('file-_name_-123.txt')).toBe('file-_name_-123.txt');
    });

    it('should preserve parentheses and brackets', () => {
      expect(sanitizeFileName('file(1)[2]{3}.txt')).toBe('file(1)[2]{3}.txt');
    });

    it('should preserve numbers in filenames', () => {
      expect(sanitizeFileName('file123456.txt')).toBe('file123456.txt');
    });
  });

  describe('empty-like results after sanitization', () => {
    it('should handle filename that becomes empty after removing all components', () => {
      expect(sanitizeFileName('\x00\x01\x02\x03')).toBe('arquivo');
    });

    it('should handle filename with only dots after path removal', () => {
      expect(sanitizeFileName('.../.../.../...')).toBe('arquivo');
    });

    it('should handle filename with only path separators', () => {
      expect(sanitizeFileName('///')).toBe('arquivo');
      expect(sanitizeFileName('\\\\\\')).toBe('arquivo');
    });

    it('should handle filename with only control chars and separators', () => {
      expect(sanitizeFileName('/\x00\x01\\\x02/')).toBe('arquivo');
    });

    it('should handle path with trailing separator returning empty basename', () => {
      expect(sanitizeFileName('../../file.txt/')).toBe('arquivo');
      expect(sanitizeFileName('path/to/dir\\')).toBe('arquivo');
    });
  });

  describe('extension handling edge cases', () => {
    it('should handle file with many dots', () => {
      const result = sanitizeFileName('file.tar.gz.bak.txt');
      expect(result).toBe('file.tar.gz.bak.txt');
      expect(result.endsWith('.txt')).toBe(true);
    });

    it('should handle file starting with dot (hidden file)', () => {
      expect(sanitizeFileName('.hidden')).toBe('.hidden');
      expect(sanitizeFileName('.hidden.txt')).toBe('.hidden.txt');
    });

    it('should not treat dot-only names as having extension', () => {
      expect(sanitizeFileName('.')).toBe('arquivo');
      expect(sanitizeFileName('..')).toBe('arquivo');
      expect(sanitizeFileName('...')).toBe('arquivo');
    });

    it('should handle double extension correctly', () => {
      const result = sanitizeFileName('archive.tar.gz');
      expect(result).toBe('archive.tar.gz');
      expect(result.endsWith('.gz')).toBe(true);
    });
  });

  describe('combined attack scenarios', () => {
    it('should handle path traversal + null bytes + length attack', () => {
      const attack = '../../\x00' + 'a'.repeat(300) + '.txt';
      const result = sanitizeFileName(attack);
      expect(result.length).toBeLessThanOrEqual(255);
      expect(result).not.toContain('..');
      expect(result).not.toContain('\x00');
      expect(result.endsWith('.txt')).toBe(true);
    });

    it('should handle control chars + path separators + whitespace', () => {
      const attack = '  \x01\x02\x03/../\x7F file.txt \x00';
      const result = sanitizeFileName(attack);
      expect(result).toBe('file.txt');
    });

    it('should handle unicode + path traversal + length', () => {
      const attack = '../../文件' + 'a'.repeat(500) + '.pdf';
      const result = sanitizeFileName(attack);
      expect(result.length).toBeLessThanOrEqual(255);
      expect(result).not.toContain('..');
      expect(result.endsWith('.pdf')).toBe(true);
    });
  });

  describe('filesystem boundary conditions', () => {
    it('should handle exactly 255 byte string', () => {
      const name255 = 'x'.repeat(255);
      expect(sanitizeFileName(name255).length).toBe(255);
    });

    it('should handle 254 byte string with extension', () => {
      const name = 'y'.repeat(250) + '.txt';
      const result = sanitizeFileName(name);
      expect(result.length).toBe(254);
    });

    it('should preserve multi-byte UTF-8 characters within limit', () => {
      // Each emoji is typically 4 bytes in UTF-8
      const emoji = '😀'.repeat(50) + '.txt'; // ~200+ bytes
      const result = sanitizeFileName(emoji);
      expect(result).toContain('😀');
      expect(result.endsWith('.txt')).toBe(true);
    });
  });
});
