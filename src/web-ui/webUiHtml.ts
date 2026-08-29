/**
 * HTML/CSS/JS autocontido da interface web (T-501), servido em `GET /` pelo servidor
 * embarcado (ver `registerWebUiRoute` em `apiSetup.ts`, que importa `WEB_UI_HTML` daqui).
 *
 * Vive em `src/web-ui/` — o elemento `web-ui` já estava previsto em
 * `eslint-plugin-boundaries` (`boundaries/elements` em `eslint.config.js`, apontando para
 * `src/web-ui/**`), só faltava a política liberando `app` a importar dele (adicionada
 * junto com este arquivo). A pasta `web-ui/` na raiz do repo (só `.gitkeep`) é o diagrama
 * conceitual da constituição, anterior à decisão concreta de onde o TypeScript real
 * moraria — não recebe código.
 *
 * O HTML/CSS/JS dentro da constante é escrito à mão, sem framework, sem CDN e sem
 * bundler — documento web puro, autocontido num único arquivo.
 */

export const WEB_UI_HTML = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Transfer Files</title>
<style>
  :root {
    --bg: #f5f5f7;
    --fg: #1c1c1e;
    --muted: #6e6e73;
    --accent: #0a84ff;
    --card-bg: #ffffff;
    --border: #d2d2d7;
    --danger-bg: #ffe5e5;
    --danger-fg: #8a0000;
  }

  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #1c1c1e;
      --fg: #f5f5f7;
      --muted: #a1a1a6;
      --accent: #0a84ff;
      --card-bg: #2c2c2e;
      --border: #3a3a3c;
      --danger-bg: #4a1414;
      --danger-fg: #ff8a8a;
    }
  }

  * {
    box-sizing: border-box;
  }

  html, body {
    margin: 0;
    padding: 0;
  }

  body {
    background: var(--bg);
    color: var(--fg);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    line-height: 1.5;
    min-width: 320px;
  }

  .container {
    max-width: 640px;
    margin: 0 auto;
    padding: 1rem;
    width: 100%;
  }

  header {
    margin-bottom: 1rem;
  }

  h1 {
    font-size: 1.25rem;
    margin: 0 0 0.75rem 0;
  }

  .session-badge {
    display: inline-flex;
    flex-direction: column;
    gap: 0.15rem;
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    padding: 0.75rem 1rem;
    width: 100%;
  }

  .session-badge .label {
    font-size: 0.75rem;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .session-badge .value {
    font-size: 1.1rem;
    font-weight: 600;
    word-break: break-word;
  }

  #disconnected-banner {
    background: var(--danger-bg);
    color: var(--danger-fg);
    border-radius: 0.5rem;
    padding: 0.6rem 0.85rem;
    margin-bottom: 1rem;
    font-size: 0.9rem;
  }

  .hidden {
    display: none;
  }

  nav.tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  nav.tabs button {
    flex: 1;
    padding: 0.65rem 0.5rem;
    font-size: 0.95rem;
    font-family: inherit;
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    background: var(--card-bg);
    color: var(--fg);
    cursor: pointer;
  }

  nav.tabs button.active {
    background: var(--accent);
    color: #ffffff;
    border-color: var(--accent);
  }

  section.tab-panel {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    padding: 1rem;
  }

  section.tab-panel.hidden {
    display: none;
  }

  .placeholder {
    color: var(--muted);
    text-align: center;
    padding: 2rem 0.5rem;
  }
</style>
</head>
<body>
<div class="container">
  <div id="disconnected-banner" class="hidden">Servidor desconectado — verifique o app no celular host</div>

  <header>
    <h1>Transfer Files</h1>
    <div class="session-badge">
      <span class="label">Sessão</span>
      <span class="value" id="session-value">Carregando sessão…</span>
    </div>
  </header>

  <nav class="tabs">
    <button type="button" id="tab-upload-btn" class="active">Enviar arquivos</button>
    <button type="button" id="tab-download-btn">Baixar arquivos</button>
  </nav>

  <section id="tab-upload" class="tab-panel">
    <p class="placeholder">Em breve</p>
  </section>

  <section id="tab-download" class="tab-panel hidden">
    <p class="placeholder">Em breve</p>
  </section>
</div>

<script>
(function () {
  "use strict";

  function setupTabs() {
    var uploadBtn = document.getElementById("tab-upload-btn");
    var downloadBtn = document.getElementById("tab-download-btn");
    var uploadPanel = document.getElementById("tab-upload");
    var downloadPanel = document.getElementById("tab-download");

    function showUpload() {
      uploadBtn.classList.add("active");
      downloadBtn.classList.remove("active");
      uploadPanel.classList.remove("hidden");
      downloadPanel.classList.add("hidden");
    }

    function showDownload() {
      downloadBtn.classList.add("active");
      uploadBtn.classList.remove("active");
      downloadPanel.classList.remove("hidden");
      uploadPanel.classList.add("hidden");
    }

    uploadBtn.addEventListener("click", showUpload);
    downloadBtn.addEventListener("click", showDownload);
  }

  function loadSession() {
    var sessionValue = document.getElementById("session-value");

    fetch("/api/session")
      .then(function (response) {
        if (!response.ok) {
          throw new Error("status " + response.status);
        }
        return response.json();
      })
      .then(function (data) {
        if (data && typeof data.sessionId === "string") {
          sessionValue.textContent = data.sessionId;
        } else {
          sessionValue.textContent = "Sessão indisponível";
        }
      })
      .catch(function () {
        sessionValue.textContent = "Sessão indisponível";
      });
  }

  setupTabs();
  loadSession();
})();
</script>
</body>
</html>
`;
