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
/**
 * Achado em teste manual (T-701): com só `fontSize`, o emoji aparecia cortado
 * no topo/base do ícone. Causa: Android adiciona um padding vertical extra ao
 * redor do texto por padrão (`includeFontPadding`), e glifos de emoji (fonte
 * Noto Color Emoji) têm uma caixa vertical naturalmente maior que glifos
 * latinos no mesmo `fontSize` — dentro do wrapper de tamanho fixo do
 * react-navigation (`TabBarIcon.js`), isso estourava a área do ícone.
 * `includeFontPadding: false` remove esse padding extra do Android;
 * `lineHeight` igual ao `fontSize` (em vez de deixar a fonte decidir) e
 * `textAlignVertical: 'center'` centralizam o glifo na caixa disponível; um
 * `fontSize` levemente menor que o `size` pedido dá folga para a caixa maior
 * do glifo de emoji não estourar de novo.
 */
function TabIcon({ symbol, size }: { symbol: string; size: number }) {
  return (
    <Text
      style={{
        fontSize: size * 0.85,
        lineHeight: size,
        includeFontPadding: false,
        textAlign: 'center',
        textAlignVertical: 'center',
        width: size,
      }}
    >
      {symbol}
    </Text>
  );
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
