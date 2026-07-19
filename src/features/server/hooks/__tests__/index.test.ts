/**
 * Barrel export test for server hooks (T-204)
 *
 * Ensures that the barrel export properly re-exports all hooks
 */

import { useNetworkStatus } from '../index';

describe('server/hooks barrel export', () => {
  it('exports useNetworkStatus', () => {
    expect(typeof useNetworkStatus).toBe('function');
  });

  it('useNetworkStatus is the correct hook', () => {
    expect(useNetworkStatus.name).toBe('useNetworkStatus');
  });
});
