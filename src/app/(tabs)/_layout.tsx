import { Tabs } from 'expo-router';
import { Text } from 'react-native';

/**
 * Navegação por abas do host (T-701 — bug real encontrado em teste manual: as
 * telas de Transferências/Compartilhados/Recebidos existiam e tinham testes
 * aprovados, mas nunca estavam conectadas a nenhuma rota navegável).
 *
 * `tabBarIcon` é obrigatório na prática: quando ausente, o `<Tabs>` do
 * expo-router (react-navigation por baixo) cai no fallback `MissingIcon`
 * (node_modules/expo-router/build/react-navigation/bottom-tabs/views/BottomTabBar.js)
 * — um glifo Unicode que a fonte do sistema no Android não tem, renderizando
 * como o quadrado-com-X de "caractere ausente" (bug real visto em teste manual
 * em dispositivo, T-701). Não há `@expo/vector-icons` (nem outra lib de
 * ícones) instalada no projeto, então usamos emoji simples via `<Text>` — sem
 * depender de fonte de ícones vetoriais, que exigiria linkar assets nativos.
 */
function TabIcon({ symbol, size }: { symbol: string; size: number }) {
  return <Text style={{ fontSize: size }}>{symbol}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Servidor',
          tabBarIcon: ({ size }) => <TabIcon symbol="🖥️" size={size} />,
        }}
      />
      <Tabs.Screen
        name="transferencias"
        options={{
          title: 'Transferências',
          tabBarIcon: ({ size }) => <TabIcon symbol="🔁" size={size} />,
        }}
      />
      <Tabs.Screen
        name="compartilhados"
        options={{
          title: 'Compartilhados',
          tabBarIcon: ({ size }) => <TabIcon symbol="📤" size={size} />,
        }}
      />
      <Tabs.Screen
        name="recebidos"
        options={{
          title: 'Recebidos',
          tabBarIcon: ({ size }) => <TabIcon symbol="📥" size={size} />,
        }}
      />
    </Tabs>
  );
}
