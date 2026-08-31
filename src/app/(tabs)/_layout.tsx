import { Tabs } from 'expo-router';

/**
 * Navegação por abas do host (T-701 — bug real encontrado em teste manual: as
 * telas de Transferências/Compartilhados/Recebidos existiam e tinham testes
 * aprovados, mas nunca estavam conectadas a nenhuma rota navegável).
 *
 * Sem ícones: não há `@expo/vector-icons` (nem outra lib de ícones) instalada
 * no projeto — as abas usam apenas rótulo em texto (`title`).
 */
export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: 'Servidor' }} />
      <Tabs.Screen name="transferencias" options={{ title: 'Transferências' }} />
      <Tabs.Screen name="compartilhados" options={{ title: 'Compartilhados' }} />
      <Tabs.Screen name="recebidos" options={{ title: 'Recebidos' }} />
    </Tabs>
  );
}
