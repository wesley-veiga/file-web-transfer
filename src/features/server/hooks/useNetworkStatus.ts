import { useEffect, useState } from 'react';
import * as Network from 'expo-network';

export interface NetworkStatus {
  isConnected: boolean;
  ssid: string | null;
}

/**
 * Hook que monitora o status da rede disponível no dispositivo.
 * Retorna se há rede disponível (Wi-Fi ou móvel) e o SSID quando possível.
 *
 * Nota: SSID nem sempre está disponível em iOS sem permissões adicionais,
 * mas a informação de conectividade sempre funciona.
 */
export function useNetworkStatus(): NetworkStatus {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isConnected: false,
    ssid: null,
  });

  useEffect(() => {
    let isMounted = true;

    const checkNetworkStatus = async () => {
      try {
        const state = await Network.getNetworkStateAsync();

        if (isMounted) {
          setNetworkStatus({
            isConnected: state.isConnected ?? false,
            ssid: (state as unknown as Record<string, unknown>).ssid
              ? String((state as unknown as Record<string, unknown>).ssid)
              : null,
          });
        }
      } catch {
        if (isMounted) {
          setNetworkStatus({
            isConnected: false,
            ssid: null,
          });
        }
      }
    };

    checkNetworkStatus();

    const subscription = Network.addNetworkStateListener((state) => {
      if (isMounted) {
        setNetworkStatus({
          isConnected: state.isConnected ?? false,
          ssid: (state as unknown as Record<string, unknown>).ssid
            ? String((state as unknown as Record<string, unknown>).ssid)
            : null,
        });
      }
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  return networkStatus;
}
