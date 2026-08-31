/**
 * Testes de src/app/(tabs)/_layout.tsx — navegação por abas (T-701).
 *
 * T-701 encontrou, em teste manual num dispositivo real, que as telas de
 * Transferências/Compartilhados/Recebidos (já testadas e aprovadas em T-603,
 * T-302 e T-303) nunca estavam conectadas a nenhuma rota navegável: o app só
 * tinha a Home. Esta suíte cobre a navegação em si — não a lógica interna
 * das telas de destino, já coberta em seus próprios arquivos de teste.
 *
 * `jest.setup.ts` mocka `expo-router` globalmente, mas sem exportar `Tabs`
 * (o projeto, até T-701, só usava `Stack`). O mock abaixo sobrescreve
 * `expo-router` apenas para este arquivo de teste, acrescentando `Tabs` e
 * `Tabs.Screen` como componentes inspecionáveis (repassam `name`/`options`
 * como props do elemento renderizado), o suficiente para um layout puramente
 * declarativo como este — sem precisar montar um navigator real completo.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import TabsLayout from '../_layout';

interface TabScreenOptions {
  title?: string;
  tabBarIcon?: (props: { focused: boolean; size: number; color: string }) => React.ReactNode;
}

jest.mock('expo-router', () => {
  const ReactActual = jest.requireActual('react');

  const TabsScreen = (props: { name: string; options?: TabScreenOptions }) =>
    ReactActual.createElement('Tabs.Screen', { name: props.name, ...props.options });

  const Tabs = (props: { children?: React.ReactNode }) =>
    ReactActual.createElement('Tabs', null, props.children);
  Tabs.Screen = TabsScreen;

  return { Tabs };
});

/** Busca todos os nós host `Tabs.Screen` renderizados pelo mock de `expo-router`. */
function findTabScreens(container: {
  queryAll: (predicate: (i: { type: string }) => boolean) => unknown[];
}) {
  return container.queryAll((instance) => instance.type === 'Tabs.Screen') as {
    props: Record<string, unknown> & Partial<TabScreenOptions>;
  }[];
}

describe('TabsLayout ((tabs)/_layout.tsx)', () => {
  it('renderiza sem lançar erro', async () => {
    await expect(render(<TabsLayout />)).resolves.toBeDefined();
  });

  it('exporta uma função default nomeada TabsLayout', () => {
    expect(typeof TabsLayout).toBe('function');
    expect(TabsLayout.name).toBe('TabsLayout');
  });

  it('declara exatamente 3 abas (Tabs.Screen)', async () => {
    // "Transferências" deixou de ser uma aba (T-701): agora é um popup aberto
    // por um botão flutuante na tela Servidor — ver src/app/(tabs)/index.tsx.
    const { container } = await render(<TabsLayout />);
    const screens = findTabScreens(container);
    expect(screens).toHaveLength(3);
  });

  it.each([
    ['index', 'Servidor'],
    ['compartilhados', 'Compartilhados'],
    ['recebidos', 'Recebidos'],
  ])('declara a aba "%s" com title "%s"', async (name, title) => {
    const { container } = await render(<TabsLayout />);
    const screens = findTabScreens(container);
    const match = screens.find((screen) => screen.props.name === name);

    expect(match).toBeDefined();
    expect(match?.props.title).toBe(title);
  });

  it('mantém a ordem das abas: Servidor, Compartilhados, Recebidos', async () => {
    const { container } = await render(<TabsLayout />);
    const screens = findTabScreens(container);

    expect(screens.map((screen) => screen.props.name)).toEqual([
      'index',
      'compartilhados',
      'recebidos',
    ]);
  });

  it('não declara nenhuma aba com título vazio', async () => {
    const { container } = await render(<TabsLayout />);
    const screens = findTabScreens(container);

    expect(screens.length).toBeGreaterThan(0);
    screens.forEach((screen) => {
      expect(screen.props.title).toBeTruthy();
    });
  });

  it('declara `tabBarIcon` em todas as abas (regressão do MissingIcon, T-701)', async () => {
    // Sem `tabBarIcon`, o <Tabs> do expo-router cai no fallback `MissingIcon` do
    // react-navigation — um glifo que a fonte do Android não renderiza, aparecendo
    // como o quadrado-com-X visto em teste manual em dispositivo real.
    const { container } = await render(<TabsLayout />);
    const screens = findTabScreens(container);

    expect(screens.length).toBeGreaterThan(0);
    screens.forEach((screen) => {
      expect(typeof screen.props.tabBarIcon).toBe('function');
    });
  });

  it('cada `tabBarIcon` retorna um elemento com um símbolo definido ao ser chamado', async () => {
    const { container } = await render(<TabsLayout />);
    const screens = findTabScreens(container);

    screens.forEach((screen) => {
      const icon = screen.props.tabBarIcon?.({ focused: false, size: 24, color: '#000' }) as
        React.ReactElement<{ symbol: string }> | undefined;

      expect(icon).toBeDefined();
      expect(icon?.props.symbol).toBeTruthy();
    });
  });

  it('ícone usa `includeFontPadding: false` e `lineHeight` fixo, evitando o corte de emoji no Android (T-701)', async () => {
    // Achado em teste manual em dispositivo real: sem esses ajustes, o padding
    // vertical extra que o Android soma ao redor do texto por padrão cortava o
    // topo/base do emoji dentro da caixa de tamanho fixo do ícone da aba.
    const { container } = await render(<TabsLayout />);
    const screens = findTabScreens(container);
    const icon = screens[0].props.tabBarIcon?.({ focused: false, size: 24, color: '#000' }) as
      React.ReactElement | undefined;

    const { container: iconContainer } = await render(icon as React.ReactElement);
    const textNodes = iconContainer.queryAll((instance) => instance.type === 'Text') as {
      props: { style?: { includeFontPadding?: boolean; lineHeight?: number } };
    }[];

    expect(textNodes.length).toBeGreaterThan(0);
    const style = textNodes[0].props.style;
    expect(style?.includeFontPadding).toBe(false);
    expect(style?.lineHeight).toBeGreaterThan(0);
  });
});
