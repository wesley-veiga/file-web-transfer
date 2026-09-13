/**
 * Testes de sanidade para `WEB_UI_HTML` (T-501, T-909).
 *
 * `WEB_UI_HTML` é uma string estática (HTML/CSS/JS servido em `GET /`, ver
 * `apiSetup.ts` → `registerWebUiRoute`), sem lógica condicional própria no
 * TypeScript — não há branches a cobrir aqui. Estes testes confirmam apenas que os
 * marcadores estruturais esperados pela spec (HU-03: tema claro/escuro, sessionId,
 * painéis de upload/download, banner de desconexão) estão presentes e que a página
 * não depende de nenhum recurso externo (CDN, fontes remotas, scripts de terceiros)
 * — autocontida como exige a tarefa.
 *
 * O comportamento do `<script>` embutido (fetch de `/api/session`, renderização
 * condicional por modo) é puramente client-side e roda no navegador do dispositivo
 * convidado; testado em jsdom em `webUiUpload.jsdom.test.ts` e
 * `webUiDownload.jsdom.test.ts` (e `webUiMode.jsdom.test.ts` para T-909).
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

  it('contém os painéis de upload e download (renderização condicional por modo, T-909)', () => {
    expect(WEB_UI_HTML).toContain('id="tab-upload"');
    expect(WEB_UI_HTML).toContain('id="tab-download"');
    expect(WEB_UI_HTML).toContain('Toque para escolher arquivos ou arraste aqui');
  });

  it('declara suporte a tema claro/escuro via prefers-color-scheme', () => {
    expect(WEB_UI_HTML).toContain('prefers-color-scheme: dark');
  });

  it('declara viewport responsivo e largura mínima >= 320px', () => {
    expect(WEB_UI_HTML).toContain('width=device-width, initial-scale=1');
    expect(WEB_UI_HTML).toMatch(/min-width:\s*320px/);
  });

  it('busca a sessão via fetch("/api/session?token=...") no script embutido (T-909)', () => {
    expect(WEB_UI_HTML).toContain('/api/session');
    expect(WEB_UI_HTML).toContain('getTokenFromUrl');
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
