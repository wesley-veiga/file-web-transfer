import * as libExports from '../index';

describe('shared/lib barrel exports', () => {
  it('should export formatBytes', () => {
    expect(typeof libExports.formatBytes).toBe('function');
  });

  it('should export formatSpeed', () => {
    expect(typeof libExports.formatSpeed).toBe('function');
  });

  it('should export formatDuration', () => {
    expect(typeof libExports.formatDuration).toBe('function');
  });

  it('should export all three functions with correct behavior', () => {
    expect(libExports.formatBytes(1024)).toBe('1 KB');
    expect(libExports.formatSpeed(1024)).toBe('1 KB/s');
    expect(libExports.formatDuration(60)).toBe('1m');
  });
});
