import { useEffect, useState } from 'react';
import * as Network from 'expo-network';

export interface NetworkStatus {
  isConnected: boolean;
  ssid: string | null;
}

/**
 * Hook que monitora o status da rede disponível no dispositivo.
 * Retorna se há rede disponível (Wi-Fi ou móvel).
 *
 * `ssid` sempre retorna `null`: `expo-network` (a lib usada aqui) nunca expôs esse
 * campo em `NetworkState` (só `type`/`isConnected`/`isInternetReachable`) — obter o
 * SSID real exigiria um módulo nativo dedicado (ex.: `react-native-wifi-reborn`),
 * que no Android também exige permissão de localização em runtime. Fica como
 * limitação conhecida (HU-01) até essa decisão de produto/permissão ser tomada;
 * o campo é mantido na interface para não quebrar quem já lê `networkStatus.ssid`.
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
            ssid: null,
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
          ssid: null,
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
