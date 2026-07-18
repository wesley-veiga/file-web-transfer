import { formatBytes } from '../formatBytes';

describe('formatBytes', () => {
  it('should format zero bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('should format bytes as B', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1)).toBe('1 B');
  });

  it('should format kilobytes', () => {
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(10240)).toBe('10 KB');
  });

  it('should format megabytes', () => {
    expect(formatBytes(1048576)).toBe('1 MB');
    expect(formatBytes(5242880)).toBe('5 MB');
    expect(formatBytes(10485760)).toBe('10 MB');
  });

  it('should format gigabytes', () => {
    expect(formatBytes(1073741824)).toBe('1 GB');
    expect(formatBytes(1610612736)).toBe('1.5 GB');
  });

  it('should format terabytes', () => {
    expect(formatBytes(1099511627776)).toBe('1 TB');
  });

  it('should handle negative numbers by using absolute value', () => {
    expect(formatBytes(-1024)).toBe('1 KB');
    expect(formatBytes(-512)).toBe('512 B');
  });

  it('should handle very large numbers', () => {
    // 1024 TB
    expect(formatBytes(1099511627776 * 1024)).toBe('1024 TB');
  });

  it('should handle decimal values consistently', () => {
    expect(formatBytes(2560)).toBe('2.5 KB');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(20480)).toBe('20 KB');
  });
});
