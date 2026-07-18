import { resolveDuplicateName } from '../resolveDuplicateName';

describe('resolveDuplicateName - Advanced Scenarios', () => {
  describe('collision with same suffix pattern', () => {
    it('should handle desired name already containing (1) suffix', () => {
      // When the desired name already has (1), it should find the next available number
      const existing = ['photo (1).jpg', 'photo (2).jpg'];
      // Desired name is "photo (1).jpg" which already exists, so should become "photo (1) (1).jpg"
      const result = resolveDuplicateName('photo (1).jpg', existing);
      expect(result).toBe('photo (1) (1).jpg');
    });

    it('should handle cascading (n) suffixes', () => {
      const existing = ['file (1).txt', 'file (1) (1).txt', 'file (1) (1) (1).txt'];
      const result = resolveDuplicateName('file (1).txt', existing);
      // Basename becomes "file (1)", so it finds "file (1) (2).txt"
      expect(result).toBe('file (1) (2).txt');
    });

    it('should resolve conflict when desired name already has suffix', () => {
      const existing = ['photo (1).jpg'];
      const result = resolveDuplicateName('photo (1).jpg', existing);
      // Since photo (1).jpg exists, resolve to photo (1) (1).jpg
      expect(result).toBe('photo (1) (1).jpg');
    });
  });

  describe('empty and edge case list scenarios', () => {
    it('should handle empty existing names list', () => {
      expect(resolveDuplicateName('file.txt', [])).toBe('file.txt');
    });

    it('should handle list with only different names', () => {
      const existing = ['other.txt'];
      expect(resolveDuplicateName('file.txt', existing)).toBe('file.txt');
    });

    it('should resolve correctly when only a similar name exists', () => {
      const existing = ['file_backup.txt'];
      expect(resolveDuplicateName('file.txt', existing)).toBe('file.txt');
    });
  });

  describe('files without extension with various patterns', () => {
    it('should resolve conflict for files without extension', () => {
      const existing = ['Makefile'];
      expect(resolveDuplicateName('Makefile', existing)).toBe('Makefile (1)');
    });

    it('should continue incrementing for names without extension', () => {
      const existing = ['Makefile', 'Makefile (1)', 'Makefile (2)'];
      expect(resolveDuplicateName('Makefile', existing)).toBe('Makefile (3)');
    });

    it('should handle conflict where suffix pattern goes out of order', () => {
      // Existing files: file, file (2), file (3) - missing (1)
      // Should find the first available (1)
      const existing = ['Makefile', 'Makefile (2)', 'Makefile (3)'];
      expect(resolveDuplicateName('Makefile', existing)).toBe('Makefile (1)');
    });
  });

  describe('extension boundary cases', () => {
    it('should handle file with extremely long extension', () => {
      const longExtension = 'file.' + 'x'.repeat(100);
      const existing = [longExtension];
      const result = resolveDuplicateName(longExtension, existing);
      expect(result).toContain(' (1)');
      expect(result.endsWith('x'.repeat(100))).toBe(true);
    });

    it('should handle file with multiple extensions correctly', () => {
      const existing = ['archive.tar.gz'];
      const result = resolveDuplicateName('archive.tar.gz', existing);
      expect(result).toBe('archive.tar (1).gz');
    });

    it('should handle file with dot at the very end', () => {
      const existing = ['file.'];
      const result = resolveDuplicateName('file.', existing);
      // When filename ends with dot, everything is basename, empty extension
      expect(result).toBe('file. (1)');
    });
  });

  describe('unicode and special character filenames', () => {
    it('should handle unicode filenames with conflict', () => {
      const existing = ['文件.pdf', '文件 (1).pdf'];
      const result = resolveDuplicateName('文件.pdf', existing);
      expect(result).toBe('文件 (2).pdf');
    });

    it('should handle emoji filenames', () => {
      const existing = ['😀.jpg', '😀 (1).jpg'];
      const result = resolveDuplicateName('😀.jpg', existing);
      expect(result).toBe('😀 (2).jpg');
    });

    it('should handle mixed unicode and ASCII', () => {
      const existing = ['café_file_café.txt'];
      const result = resolveDuplicateName('café_file_café.txt', existing);
      expect(result).toBe('café_file_café (1).txt');
    });

    it('should handle filenames with special symbols', () => {
      const existing = ['file!@#$%^&*.txt'];
      const result = resolveDuplicateName('file!@#$%^&*.txt', existing);
      expect(result).toBe('file!@#$%^&* (1).txt');
    });
  });

  describe('case sensitivity', () => {
    it('should treat filenames as case-sensitive', () => {
      const existing = ['File.txt'];
      // If the system is case-sensitive, File.txt and file.txt are different
      const result = resolveDuplicateName('file.txt', existing);
      expect(result).toBe('file.txt');
    });

    it('should not resolve conflict when only case differs', () => {
      const existing = ['FILE.TXT'];
      const result = resolveDuplicateName('file.txt', existing);
      expect(result).toBe('file.txt'); // No conflict if case-sensitive
    });
  });

  describe('large scale conflicts', () => {
    it('should efficiently resolve hundreds of duplicates', () => {
      const existing = Array.from({ length: 500 }, (_, i) => {
        if (i === 0) return 'file.txt';
        return `file (${i}).txt`;
      });
      const result = resolveDuplicateName('file.txt', existing);
      expect(result).toBe('file (500).txt');
    });

    it('should handle realistic upload scenario with 1000+ files', () => {
      // Simulate many files being uploaded with same name
      const received: string[] = [];
      for (let i = 0; i < 100; i++) {
        const resolved = resolveDuplicateName('photo.jpg', received);
        received.push(resolved);
      }
      // Check that we have unique names
      expect(new Set(received).size).toBe(100);
      // Check that last one is photo (99).jpg
      expect(received[received.length - 1]).toBe('photo (99).jpg');
    });
  });

  describe('real-world scenarios from spec', () => {
    it('should resolve single duplicate correctly', () => {
      const existing = ['file.txt'];
      expect(resolveDuplicateName('file.txt', existing)).toBe('file (1).txt');
    });

    it('should resolve multiple concurrent uploads of same file', () => {
      const received: string[] = [];
      const fileName = 'resume.pdf';

      // Simulate uploading the same file 5 times
      for (let i = 0; i < 5; i++) {
        const resolved = resolveDuplicateName(fileName, received);
        received.push(resolved);
      }

      expect(received).toEqual([
        'resume.pdf',
        'resume (1).pdf',
        'resume (2).pdf',
        'resume (3).pdf',
        'resume (4).pdf',
      ]);
    });

    it('should handle mixed file types in directory', () => {
      const existing = [
        'photo.jpg',
        'photo (1).jpg',
        'photo (2).jpg',
        'photo.png',
        'photo (1).png',
        'document.pdf',
      ];

      expect(resolveDuplicateName('photo.jpg', existing)).toBe('photo (3).jpg');
      expect(resolveDuplicateName('photo.png', existing)).toBe('photo (2).png');
      expect(resolveDuplicateName('document.pdf', existing)).toBe('document (1).pdf');
    });
  });

  describe('partial name collisions', () => {
    it('should not confuse similar names', () => {
      const existing = [
        'photo.jpg',
        'photo (1).jpg',
        'photo_backup.jpg',
        'photo-copy.jpg',
        'photo2.jpg',
      ];

      expect(resolveDuplicateName('photo.jpg', existing)).toBe('photo (2).jpg');
      expect(resolveDuplicateName('photo_backup.jpg', existing)).toBe('photo_backup (1).jpg');
      expect(resolveDuplicateName('photo-copy.jpg', existing)).toBe('photo-copy (1).jpg');
    });

    it('should handle when suffix pattern exists but desired name does not', () => {
      const existing = ['file (1).txt', 'file (2).txt', 'file (3).txt'];
      // Desired name "file.txt" does not exist, so return as-is
      expect(resolveDuplicateName('file.txt', existing)).toBe('file.txt');
    });
  });
});
