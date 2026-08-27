import { create } from 'zustand';
import type { ServerInfo, ServerStatus, ServerError } from '../types';

/** Represents valid state transitions in the server state machine */
type StateTransition = `${ServerStatus}→${ServerStatus}`;

/** Validate if a transition from one status to another is allowed */
export function isValidTransition(from: ServerStatus, to: ServerStatus): boolean {
  const validTransitions: StateTransition[] = [
    // Main flow: idle → starting → running → stopping → idle
    'idle→starting',
    'starting→running',
    'running→stopping',
    'stopping→idle',
    // Error can be reached from any state
    'idle→error',
    'starting→error',
    'running→error',
    'stopping→error',
    // Recovery from error
    'error→idle',
  ];

  return validTransitions.includes(`${from}→${to}`);
}

/** Initial state for ServerInfo */
function getInitialServerInfo(): ServerInfo {
  return {
    status: 'idle',
    networkMode: null,
    ip: null,
    port: null,
    url: null,
    sessionId: null,
    startedAt: null,
    error: null,
  };
}

interface ServerStore {
  serverInfo: ServerInfo;

  /** Request to start the server: idle → starting */
  startRequested: () => void;

  /** Server started successfully: starting → running
   * @param info Partial ServerInfo to merge with the state
   */
  started: (info: Partial<ServerInfo>) => void;

  /** Request to stop the server: running → stopping */
  stopRequested: () => void;

  /** Server stopped: stopping → idle, reset fields */
  stopped: () => void;

  /** Server encountered an error (any state → error) */
  failed: (error: ServerError) => void;

  /** Reset from error state: error → idle */
  reset: () => void;
}

export const useServerStore = create<ServerStore>((set, get) => ({
  serverInfo: getInitialServerInfo(),

  startRequested: () => {
    set((state) => {
      const from = state.serverInfo.status;
      const to: ServerStatus = 'starting';

      if (!isValidTransition(from, to)) {
        console.warn(`[ServerStore] Invalid transition: ${from} → ${to}`);
        return state;
      }

      return {
        serverInfo: {
          ...state.serverInfo,
          status: to,
        },
      };
    });
  },

  started: (info) => {
    set((state) => {
      const from = state.serverInfo.status;
      const to: ServerStatus = 'running';

      if (!isValidTransition(from, to)) {
        console.warn(`[ServerStore] Invalid transition: ${from} → ${to}`);
        return state;
      }

      return {
        serverInfo: {
          ...state.serverInfo,
          ...info,
          status: to,
        },
      };
    });
  },

  stopRequested: () => {
    set((state) => {
      const from = state.serverInfo.status;
      const to: ServerStatus = 'stopping';

      if (!isValidTransition(from, to)) {
        console.warn(`[ServerStore] Invalid transition: ${from} → ${to}`);
        return state;
      }

      return {
        serverInfo: {
          ...state.serverInfo,
          status: to,
        },
      };
    });
  },

  stopped: () => {
    set((state) => {
      const from = state.serverInfo.status;
      const to: ServerStatus = 'idle';

      if (!isValidTransition(from, to)) {
        console.warn(`[ServerStore] Invalid transition: ${from} → ${to}`);
        return state;
      }

      return {
        serverInfo: {
          ...state.serverInfo,
          status: to,
          networkMode: null,
          ip: null,
          port: null,
          url: null,
          sessionId: null,
          startedAt: null,
          error: null,
        },
      };
    });
  },

  failed: (error) => {
    set((state) => {
      const from = state.serverInfo.status;
      const to: ServerStatus = 'error';

      if (!isValidTransition(from, to)) {
        console.warn(`[ServerStore] Invalid transition: ${from} → ${to}`);
        return state;
      }

      return {
        serverInfo: {
          ...state.serverInfo,
          status: to,
          error,
        },
      };
    });
  },

  reset: () => {
    // Reset is an administrative action that always succeeds (unconditional)
    set({
      serverInfo: getInitialServerInfo(),
    });
  },
}));
