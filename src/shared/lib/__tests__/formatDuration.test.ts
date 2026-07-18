import { formatDuration } from '../formatDuration';

describe('formatDuration', () => {
  it('should format zero seconds', () => {
    expect(formatDuration(0)).toBe('0s');
  });

  it('should format seconds only (< 60s)', () => {
    expect(formatDuration(1)).toBe('1s');
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(59)).toBe('59s');
  });

  it('should format minutes and seconds', () => {
    expect(formatDuration(60)).toBe('1m');
    expect(formatDuration(61)).toBe('1m 1s');
    expect(formatDuration(65)).toBe('1m 5s');
    expect(formatDuration(90)).toBe('1m 30s');
    expect(formatDuration(150)).toBe('2m 30s');
    expect(formatDuration(3599)).toBe('59m 59s');
  });

  it('should format hours, minutes and seconds', () => {
    expect(formatDuration(3600)).toBe('1h');
    expect(formatDuration(3601)).toBe('1h 1s');
    expect(formatDuration(3661)).toBe('1h 1m 1s');
    expect(formatDuration(3665)).toBe('1h 1m 5s');
    expect(formatDuration(7325)).toBe('2h 2m 5s');
    expect(formatDuration(86399)).toBe('23h 59m 59s');
  });

  it('should handle negative numbers by using absolute value', () => {
    expect(formatDuration(-45)).toBe('45s');
    expect(formatDuration(-150)).toBe('2m 30s');
    expect(formatDuration(-3661)).toBe('1h 1m 1s');
  });

  it('should handle decimal seconds by flooring', () => {
    expect(formatDuration(45.7)).toBe('45s');
    expect(formatDuration(150.2)).toBe('2m 30s');
    expect(formatDuration(61.9)).toBe('1m 1s');
  });

  it('should handle very large durations', () => {
    // 100 hours
    expect(formatDuration(360000)).toBe('100h');
    // 100 hours 30 minutes 45 seconds
    expect(formatDuration(361845)).toBe('100h 30m 45s');
  });

  it('should omit zero components at the end', () => {
    expect(formatDuration(3600)).toBe('1h');
    expect(formatDuration(3660)).toBe('1h 1m');
    expect(formatDuration(60)).toBe('1m');
  });
});
