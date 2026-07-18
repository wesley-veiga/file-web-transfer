import { resolveDuplicateName } from '../resolveDuplicateName';

describe('resolveDuplicateName', () => {
  describe('no conflict', () => {
    it('should return unchanged name if not in existing list', () => {
      expect(resolveDuplicateName('photo.jpg', [])).toBe('photo.jpg');
      expect(resolveDuplicateName('file.txt', ['other.txt'])).toBe('file.txt');
    });

    it('should return unchanged name for empty existing list', () => {
      expect(resolveDuplicateName('document.pdf', [])).toBe('document.pdf');
    });
  });

  describe('conflict with extension', () => {
    it('should append (1) suffix when name exists', () => {
      expect(resolveDuplicateName('photo.jpg', ['photo.jpg'])).toBe(
        'photo (1).jpg'
      );
    });

    it('should append (2) suffix when (1) exists', () => {
      expect(
        resolveDuplicateName('photo.jpg', ['photo.jpg', 'photo (1).jpg'])
      ).toBe('photo (2).jpg');
    });

    it('should continue incrementing suffix', () => {
      const existing = [
        'photo.jpg',
        'photo (1).jpg',
        'photo (2).jpg',
        'photo (3).jpg',
      ];
      expect(resolveDuplicateName('photo.jpg', existing)).toBe(
        'photo (4).jpg'
      );
    });

    it('should handle multiple dots in filename', () => {
      const existing = ['file.name.with.dots.txt'];
      expect(resolveDuplicateName('file.name.with.dots.txt', existing)).toBe(
        'file.name.with.dots (1).txt'
      );
    });

    it('should preserve correct extension position', () => {
      const result = resolveDuplicateName('document.pdf', ['document.pdf']);
      expect(result).toBe('document (1).pdf');
      expect(result.endsWith('.pdf')).toBe(true);
    });
  });

  describe('conflict without extension', () => {
    it('should append (1) suffix when name without extension exists', () => {
      expect(resolveDuplicateName('README', ['README'])).toBe('README (1)');
    });

    it('should continue incrementing for names without extension', () => {
      const existing = ['Makefile', 'Makefile (1)', 'Makefile (2)'];
      expect(resolveDuplicateName('Makefile', existing)).toBe('Makefile (3)');
    });
  });

  describe('hidden files (starting with dot)', () => {
    it('should handle hidden files with extension', () => {
      expect(resolveDuplicateName('.gitignore', ['.gitignore'])).toBe(
        '.gitignore (1)'
      );
    });

    it('should handle hidden files without secondary extension', () => {
      expect(resolveDuplicateName('.env', ['.env'])).toBe('.env (1)');
    });

    it('should handle dotfiles with actual extensions', () => {
      expect(resolveDuplicateName('.config.json', ['.config.json'])).toBe(
        '.config (1).json'
      );
    });
  });

  describe('edge cases', () => {
    it('should handle single character names', () => {
      expect(resolveDuplicateName('a', ['a'])).toBe('a (1)');
    });

    it('should handle single character extensions', () => {
      expect(resolveDuplicateName('file.x', ['file.x'])).toBe('file (1).x');
    });

    it('should handle names with spaces', () => {
      expect(
        resolveDuplicateName('my document.pdf', ['my document.pdf'])
      ).toBe('my document (1).pdf');
    });

    it('should handle names with special characters', () => {
      expect(
        resolveDuplicateName('file-name_123.txt', ['file-name_123.txt'])
      ).toBe('file-name_123 (1).txt');
    });

    it('should handle unicode filenames', () => {
      expect(
        resolveDuplicateName('arquivo_maçã.txt', ['arquivo_maçã.txt'])
      ).toBe('arquivo_maçã (1).txt');
    });
  });

  describe('large counter values', () => {
    it('should handle large suffix numbers', () => {
      const existing = Array.from({ length: 100 }, (_, i) => {
        if (i === 0) return 'file.txt';
        return `file (${i}).txt`;
      });
      expect(resolveDuplicateName('file.txt', existing)).toBe('file (100).txt');
    });
  });

  describe('real-world scenarios', () => {
    it('should resolve multiple uploads of same file', () => {
      const received: string[] = [];
      let fileName = 'photo.jpg';

      // Simulate uploading the same file 3 times
      for (let i = 0; i < 3; i++) {
        const resolved = resolveDuplicateName(fileName, received);
        received.push(resolved);
      }

      expect(received).toEqual(['photo.jpg', 'photo (1).jpg', 'photo (2).jpg']);
    });

    it('should handle mixed files in directory', () => {
      const existing = [
        'photo.jpg',
        'photo (1).jpg',
        'document.pdf',
        'photo.png',
      ];

      expect(resolveDuplicateName('photo.jpg', existing)).toBe(
        'photo (2).jpg'
      );
      expect(resolveDuplicateName('document.pdf', existing)).toBe(
        'document (1).pdf'
      );
      expect(resolveDuplicateName('photo.png', existing)).toBe(
        'photo (1).png'
      );
    });

    it('should not conflict with similar filenames', () => {
      const existing = [
        'photo.jpg',
        'photo (1).jpg',
        'photo_backup.jpg',
        'photo-original.jpg',
      ];

      expect(resolveDuplicateName('photo.jpg', existing)).toBe(
        'photo (2).jpg'
      );
      expect(resolveDuplicateName('photo_backup.jpg', existing)).toBe(
        'photo_backup (1).jpg'
      );
    });
  });
});
