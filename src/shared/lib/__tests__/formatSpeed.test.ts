import { formatSpeed } from '../formatSpeed';

describe('formatSpeed', () => {
  it('should format zero speed', () => {
    expect(formatSpeed(0)).toBe('0 B/s');
  });

  it('should format bytes per second', () => {
    expect(formatSpeed(512)).toBe('512 B/s');
    expect(formatSpeed(1)).toBe('1 B/s');
  });

  it('should format kilobytes per second', () => {
    expect(formatSpeed(1024)).toBe('1 KB/s');
    expect(formatSpeed(1536)).toBe('1.5 KB/s');
    expect(formatSpeed(10240)).toBe('10 KB/s');
  });

  it('should format megabytes per second', () => {
    expect(formatSpeed(1048576)).toBe('1 MB/s');
    expect(formatSpeed(5242880)).toBe('5 MB/s');
    expect(formatSpeed(10485760)).toBe('10 MB/s');
  });

  it('should format gigabytes per second', () => {
    expect(formatSpeed(1073741824)).toBe('1 GB/s');
  });

  it('should handle negative numbers by using absolute value', () => {
    expect(formatSpeed(-1024)).toBe('1 KB/s');
    expect(formatSpeed(-512)).toBe('512 B/s');
  });

  it('should handle decimal values consistently', () => {
    expect(formatSpeed(2560)).toBe('2.5 KB/s');
    expect(formatSpeed(2048)).toBe('2 KB/s');
    expect(formatSpeed(20480)).toBe('20 KB/s');
  });

  it('should format realistic transfer speeds', () => {
    // 1 MB/s = 1048576 B/s
    expect(formatSpeed(1048576)).toBe('1 MB/s');
    // 10 MB/s
    expect(formatSpeed(10485760)).toBe('10 MB/s');
    // 100 MB/s
    expect(formatSpeed(104857600)).toBe('100 MB/s');
  });
});
