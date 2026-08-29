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

  .drop-zone {
    border: 2px dashed var(--border);
    border-radius: 0.75rem;
    padding: 2rem 1rem;
    text-align: center;
    color: var(--muted);
    cursor: pointer;
    margin-bottom: 1rem;
    transition: border-color 0.15s ease, color 0.15s ease;
  }

  .drop-zone p {
    margin: 0;
  }

  .drop-zone.drag-active {
    border-color: var(--accent);
    color: var(--fg);
  }

  .drop-zone:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .upload-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .upload-item {
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    padding: 0.75rem;
  }

  .upload-item.error {
    background: var(--danger-bg);
    border-color: var(--danger-fg);
  }

  .upload-item-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.5rem;
    margin-bottom: 0.4rem;
    font-size: 0.9rem;
  }

  .upload-item-name {
    font-weight: 600;
    word-break: break-word;
    flex: 1;
  }

  .upload-item-size {
    color: var(--muted);
    font-size: 0.8rem;
    white-space: nowrap;
  }

  .progress-track {
    background: var(--border);
    border-radius: 999px;
    height: 0.4rem;
    overflow: hidden;
    margin: 0.4rem 0;
  }

  .progress-fill {
    background: var(--accent);
    height: 100%;
    width: 0%;
    transition: width 0.2s ease;
  }

  .upload-item.error .progress-fill {
    background: var(--danger-fg);
  }

  .upload-item-status {
    font-size: 0.8rem;
    color: var(--muted);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
  }

  .upload-item.error .upload-item-status-text {
    color: var(--danger-fg);
  }

  .retry-btn {
    background: var(--card-bg);
    border: 1px solid var(--danger-fg);
    color: var(--danger-fg);
    border-radius: 0.4rem;
    padding: 0.3rem 0.6rem;
    font-size: 0.8rem;
    font-family: inherit;
    cursor: pointer;
    flex-shrink: 0;
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
    <div id="drop-zone" class="drop-zone" tabindex="0" role="button" aria-label="Selecionar arquivos para enviar">
      <p>Toque para escolher arquivos ou arraste aqui</p>
    </div>
    <input type="file" id="file-input" multiple class="hidden">
    <ul id="upload-list" class="upload-list"></ul>
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

  var uploadQueue = [];
  var nextUploadId = 1;
  var isUploading = false;

  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) {
      return "0 B";
    }
    var units = ["B", "KB", "MB", "GB", "TB"];
    var exponent = Math.floor(Math.log(bytes) / Math.log(1024));
    exponent = Math.min(exponent, units.length - 1);
    var value = bytes / Math.pow(1024, exponent);
    var formatted = exponent === 0 ? String(value) : value.toFixed(1);
    return formatted + " " + units[exponent];
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function mapUploadErrorCode(code, message) {
    if (code === "FILE_TOO_LARGE") {
      return "Arquivo muito grande";
    }
    if (code === "INVALID_FILENAME") {
      return "Nome de arquivo inválido";
    }
    if (code === "INSUFFICIENT_STORAGE") {
      return "Sem espaço no dispositivo host";
    }
    if (message) {
      return message;
    }
    return "Falha no envio";
  }

  function renderUploadList() {
    var list = document.getElementById("upload-list");
    if (!uploadQueue.length) {
      list.innerHTML = "";
      return;
    }

    var html = uploadQueue
      .map(function (item) {
        var itemClass = "upload-item" + (item.status === "error" ? " error" : "");
        var retryButton =
          item.status === "error"
            ? '<button type="button" class="retry-btn" data-retry-id="' +
              item.id +
              '">Tentar novamente</button>'
            : "";

        return (
          '<li class="' + itemClass + '" data-id="' + item.id + '">' +
          '<div class="upload-item-header">' +
          '<span class="upload-item-name">' + escapeHtml(item.file.name) + "</span>" +
          '<span class="upload-item-size">' + formatBytes(item.file.size) + "</span>" +
          "</div>" +
          '<div class="progress-track"><div class="progress-fill" style="width: ' +
          item.progress +
          '%"></div></div>' +
          '<div class="upload-item-status">' +
          '<span class="upload-item-status-text">' + escapeHtml(item.statusText) + "</span>" +
          retryButton +
          "</div>" +
          "</li>"
        );
      })
      .join("");

    list.innerHTML = html;
  }

  function uploadFile(item, done) {
    var xhr = new XMLHttpRequest();
    var formData = new FormData();
    formData.append("file", item.file);

    xhr.upload.onprogress = function (e) {
      if (e.lengthComputable) {
        item.progress = Math.round((e.loaded / e.total) * 100);
        renderUploadList();
      }
    };

    xhr.onload = function () {
      if (xhr.status === 201) {
        item.status = "done";
        item.progress = 100;
        item.statusText = "Concluído";
        renderUploadList();
        done();
        return;
      }

      var errorMessage = "Falha no envio";
      try {
        var parsed = JSON.parse(xhr.responseText);
        if (parsed && parsed.error) {
          errorMessage = mapUploadErrorCode(parsed.error.code, parsed.error.message);
        }
      } catch (parseError) {
        errorMessage = "Falha no envio";
      }

      item.status = "error";
      item.statusText = errorMessage;
      renderUploadList();
      done();
    };

    xhr.onerror = function () {
      item.status = "error";
      item.statusText = "Conexão perdida";
      renderUploadList();
      done();
    };

    xhr.onabort = function () {
      item.status = "error";
      item.statusText = "Conexão perdida";
      renderUploadList();
      done();
    };

    xhr.open("POST", "/api/upload");
    xhr.send(formData);
  }

  function processUploadQueue() {
    if (isUploading) {
      return;
    }

    var next = null;
    for (var i = 0; i < uploadQueue.length; i++) {
      if (uploadQueue[i].status === "queued") {
        next = uploadQueue[i];
        break;
      }
    }

    if (!next) {
      return;
    }

    isUploading = true;
    next.status = "uploading";
    next.progress = 0;
    next.statusText = "Enviando…";
    renderUploadList();

    uploadFile(next, function () {
      isUploading = false;
      processUploadQueue();
    });
  }

  function addFilesToQueue(fileList) {
    var files = Array.prototype.slice.call(fileList);
    files.forEach(function (file) {
      uploadQueue.push({
        id: nextUploadId++,
        file: file,
        status: "queued",
        progress: 0,
        statusText: "Na fila",
      });
    });
    renderUploadList();
    processUploadQueue();
  }

  function retryUpload(id) {
    var item = null;
    for (var i = 0; i < uploadQueue.length; i++) {
      if (uploadQueue[i].id === id) {
        item = uploadQueue[i];
        break;
      }
    }

    if (!item || item.status !== "error") {
      return;
    }

    item.status = "queued";
    item.progress = 0;
    item.statusText = "Na fila";
    renderUploadList();
    processUploadQueue();
  }

  function setupUpload() {
    var dropZone = document.getElementById("drop-zone");
    var fileInput = document.getElementById("file-input");
    var uploadList = document.getElementById("upload-list");

    dropZone.addEventListener("click", function () {
      fileInput.click();
    });

    dropZone.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        fileInput.click();
      }
    });

    fileInput.addEventListener("change", function () {
      if (fileInput.files && fileInput.files.length) {
        addFilesToQueue(fileInput.files);
      }
      fileInput.value = "";
    });

    dropZone.addEventListener("dragover", function (e) {
      e.preventDefault();
      dropZone.classList.add("drag-active");
    });

    dropZone.addEventListener("dragleave", function () {
      dropZone.classList.remove("drag-active");
    });

    dropZone.addEventListener("drop", function (e) {
      e.preventDefault();
      dropZone.classList.remove("drag-active");
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
        addFilesToQueue(e.dataTransfer.files);
      }
    });

    uploadList.addEventListener("click", function (e) {
      var target = e.target;
      if (target && target.classList && target.classList.contains("retry-btn")) {
        var id = Number(target.getAttribute("data-retry-id"));
        retryUpload(id);
      }
    });
  }

  setupTabs();
  loadSession();
  setupUpload();
})();
</script>
</body>
</html>
`;
