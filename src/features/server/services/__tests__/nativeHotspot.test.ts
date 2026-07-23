/**
 * Tests for nativeHotspot.ts
 * Verifies that the NativeHotspot stub interface throws "not implemented" errors
 */

import { NativeHotspot } from '../nativeHotspot';

describe('NativeHotspot stub', () => {
  it('should have startLocalOnlyHotspot method', () => {
    expect(NativeHotspot.startLocalOnlyHotspot).toBeDefined();
    expect(typeof NativeHotspot.startLocalOnlyHotspot).toBe('function');
  });

  it('should have stopLocalOnlyHotspot method', () => {
    expect(NativeHotspot.stopLocalOnlyHotspot).toBeDefined();
    expect(typeof NativeHotspot.stopLocalOnlyHotspot).toBe('function');
  });

  it('should have getHotspotConfig method', () => {
    expect(NativeHotspot.getHotspotConfig).toBeDefined();
    expect(typeof NativeHotspot.getHotspotConfig).toBe('function');
  });

  it('startLocalOnlyHotspot should throw "not implemented" error', async () => {
    await expect(NativeHotspot.startLocalOnlyHotspot()).rejects.toThrow('not implemented');
  });

  it('stopLocalOnlyHotspot should throw "not implemented" error', async () => {
    await expect(NativeHotspot.stopLocalOnlyHotspot()).rejects.toThrow('not implemented');
  });

  it('getHotspotConfig should throw "not implemented" error', async () => {
    await expect(NativeHotspot.getHotspotConfig()).rejects.toThrow('not implemented');
  });
});
