/**
 * Testes de sanidade para `WEB_UI_HTML` (T-501).
 *
 * `WEB_UI_HTML` é uma string estática (HTML/CSS/JS servido em `GET /`, ver
 * `apiSetup.ts` → `registerWebUiRoute`), sem lógica condicional própria no
 * TypeScript — não há branches a cobrir aqui. Estes testes confirmam apenas que os
 * marcadores estruturais esperados pela spec (HU-03: tema claro/escuro, sessionId,
 * abas, banner de desconexão) estão presentes e que a página não depende de nenhum
 * recurso externo (CDN, fontes remotas, scripts de terceiros) — autocontida como
 * exige a tarefa.
 *
 * O comportamento do `<script>` embutido (fetch de `/api/session`, troca de abas) é
 * puramente client-side e roda no navegador do dispositivo convidado; não há
 * infraestrutura de teste (jsdom) configurada no projeto para simulá-lo aqui — fica
 * coberto pelo teste manual de fogo (T-701).
 */

import { WEB_UI_HTML } from '../webUiHtml';

describe('WEB_UI_HTML', () => {
  it('é uma string não vazia', () => {
    expect(typeof WEB_UI_HTML).toBe('string');
    expect(WEB_UI_HTML.length).toBeGreaterThan(0);
  });

  it('declara um documento HTML5 com o título "Transfer Files"', () => {
    expect(WEB_UI_HTML).toMatch(/<!doctype html>/i);
    expect(WEB_UI_HTML).toContain('<title>Transfer Files</title>');
  });

  it('contém o elemento que exibe o sessionId (id="session-value")', () => {
    expect(WEB_UI_HTML).toContain('id="session-value"');
  });

  it('contém o banner de desconexão oculto por padrão (id="disconnected-banner", classe "hidden")', () => {
    expect(WEB_UI_HTML).toContain('id="disconnected-banner"');
    expect(WEB_UI_HTML).toMatch(/id="disconnected-banner"\s+class="hidden"/);
  });

  it('contém as duas abas "Enviar arquivos" e "Baixar arquivos"', () => {
    expect(WEB_UI_HTML).toContain('Enviar arquivos');
    expect(WEB_UI_HTML).toContain('Baixar arquivos');
  });

  it('declara suporte a tema claro/escuro via prefers-color-scheme', () => {
    expect(WEB_UI_HTML).toContain('prefers-color-scheme: dark');
  });

  it('declara viewport responsivo e largura mínima >= 320px', () => {
    expect(WEB_UI_HTML).toContain('width=device-width, initial-scale=1');
    expect(WEB_UI_HTML).toMatch(/min-width:\s*320px/);
  });

  it('busca o sessionId via fetch("/api/session") no script embutido', () => {
    expect(WEB_UI_HTML).toContain('fetch("/api/session")');
  });

  it('não referencia nenhum recurso externo via http(s):// (sem CDN, sem fontes remotas)', () => {
    expect(WEB_UI_HTML).not.toMatch(/https?:\/\//);
  });

  it('não referencia CDNs conhecidos por nome (cdn., unpkg.com, jsdelivr, googleapis)', () => {
    expect(WEB_UI_HTML.toLowerCase()).not.toMatch(/cdn\.|unpkg\.com|jsdelivr|googleapis/);
  });

  it('não importa nenhum script ou stylesheet externo (sem <script src=, sem <link rel="stylesheet")', () => {
    expect(WEB_UI_HTML).not.toMatch(/<script\s+[^>]*src=/i);
    expect(WEB_UI_HTML).not.toMatch(/<link\s+[^>]*rel=["']stylesheet["']/i);
  });
});
