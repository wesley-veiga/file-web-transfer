import { formatBytes, formatSpeed, formatDuration } from '../index';

describe('Edge cases for formatting utilities', () => {
  describe('formatBytes - critical unit boundaries', () => {
    // B to KB boundary
    it('should format 1023 B (just before KB boundary)', () => {
      expect(formatBytes(1023)).toBe('1023 B');
    });

    it('should format 1024 B (exact KB boundary)', () => {
      expect(formatBytes(1024)).toBe('1 KB');
    });

    it('should format 1126 B (1.1 KB, with decimal)', () => {
      expect(formatBytes(1126)).toBe('1.1 KB');
    });

    // KB to MB boundary
    it('should format 1048575 B (just before MB boundary, 1024 KB)', () => {
      const result = formatBytes(1048575);
      expect(result).toBe('1024 KB');
    });

    it('should format 1048576 B (exact MB boundary)', () => {
      expect(formatBytes(1048576)).toBe('1 MB');
    });

    it('should format 1048577 B (just after MB boundary)', () => {
      const result = formatBytes(1048577);
      expect(result).toMatch(/^1(\.\d)? MB$/);
    });

    // MB to GB boundary
    it('should format 1073741823 B (1024 MB - 1)', () => {
      const result = formatBytes(1073741823);
      expect(result).toBe('1024 MB');
    });

    it('should format 1073741824 B (exact GB boundary)', () => {
      expect(formatBytes(1073741824)).toBe('1 GB');
    });

    // GB to TB boundary
    it('should format 1099511627775 B (1024 GB - 1)', () => {
      const result = formatBytes(1099511627775);
      expect(result).toBe('1024 GB');
    });

    it('should format 1099511627776 B (exact TB boundary)', () => {
      expect(formatBytes(1099511627776)).toBe('1 TB');
    });
  });

  describe('formatSpeed - extreme values', () => {
    it('should format 0 B/s', () => {
      expect(formatSpeed(0)).toBe('0 B/s');
    });

    it('should format very high speeds (2 GB/s)', () => {
      const result = formatSpeed(1073741824 * 2);
      expect(result).toBe('2 GB/s');
    });

    it('should format 10 GB/s', () => {
      const result = formatSpeed(1073741824 * 10);
      expect(result).toBe('10 GB/s');
    });

    it('should handle fractional GB/s', () => {
      // 1.5 GB/s
      const result = formatSpeed(Math.floor(1073741824 * 1.5));
      expect(result).toBe('1.5 GB/s');
    });

    it('should handle speeds at unit boundaries', () => {
      // Exactly 1 KB/s
      expect(formatSpeed(1024)).toBe('1 KB/s');
      // Exactly 1 MB/s
      expect(formatSpeed(1048576)).toBe('1 MB/s');
      // Exactly 1 GB/s
      expect(formatSpeed(1073741824)).toBe('1 GB/s');
    });
  });

  describe('formatDuration - critical time boundaries', () => {
    it('should format 0 seconds', () => {
      expect(formatDuration(0)).toBe('0s');
    });

    it('should format exactly 59 seconds (just before minute)', () => {
      expect(formatDuration(59)).toBe('59s');
    });

    it('should format exactly 60 seconds (minute boundary)', () => {
      expect(formatDuration(60)).toBe('1m');
    });

    it('should format exactly 61 seconds (just after minute boundary)', () => {
      expect(formatDuration(61)).toBe('1m 1s');
    });

    it('should format exactly 3599 seconds (just before hour)', () => {
      expect(formatDuration(3599)).toBe('59m 59s');
    });

    it('should format exactly 3600 seconds (hour boundary)', () => {
      expect(formatDuration(3600)).toBe('1h');
    });

    it('should format exactly 3601 seconds (just after hour boundary)', () => {
      expect(formatDuration(3601)).toBe('1h 1s');
    });

    it('should format multi-day duration (86400 seconds = 1 day)', () => {
      expect(formatDuration(86400)).toBe('24h');
    });

    it('should format 90061 seconds (25h 1m 1s)', () => {
      expect(formatDuration(90061)).toBe('25h 1m 1s');
    });

    it('should format very large duration (100 days)', () => {
      const result = formatDuration(100 * 86400);
      expect(result).toBe('2400h');
    });

    it('should omit trailing zero components correctly', () => {
      // 1 hour, 5 minutes, 0 seconds
      expect(formatDuration(3900)).toBe('1h 5m');
      // 2 hours, 0 minutes, 30 seconds
      expect(formatDuration(7230)).toBe('2h 30s');
      // 1 hour, 0 minutes, 0 seconds
      expect(formatDuration(3600)).toBe('1h');
    });

    it('should handle very small durations', () => {
      expect(formatDuration(1)).toBe('1s');
      expect(formatDuration(2)).toBe('2s');
    });

    it('should handle fractional seconds by flooring', () => {
      expect(formatDuration(1.9)).toBe('1s');
      expect(formatDuration(59.9)).toBe('59s');
      expect(formatDuration(60.1)).toBe('1m');
    });
  });

  describe('All utilities with negative values', () => {
    it('formatBytes should use absolute value for negative bytes', () => {
      expect(formatBytes(-1024)).toBe('1 KB');
      expect(formatBytes(-1048576)).toBe('1 MB');
    });

    it('formatSpeed should use absolute value for negative speed', () => {
      expect(formatSpeed(-1024)).toBe('1 KB/s');
      expect(formatSpeed(-1048576)).toBe('1 MB/s');
    });

    it('formatDuration should use absolute value for negative seconds', () => {
      expect(formatDuration(-60)).toBe('1m');
      expect(formatDuration(-3600)).toBe('1h');
      expect(formatDuration(-3661)).toBe('1h 1m 1s');
    });
  });
});
