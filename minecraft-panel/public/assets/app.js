/* ==========================================================================
   BT Minecraft Panel — client
   Vanilla JS, no dependencies. Progressive: every page renders server-side,
   this file adds live status, console streaming, the file manager and dialogs.
   ========================================================================== */
(function () {
  "use strict";

  const meta = (name) => {
    const el = document.querySelector(`meta[name="${name}"]`);
    return el ? el.content : "";
  };

  const BASE = (meta("app-base") || "/").replace(/\/+$/, "");
  const CSRF = meta("csrf-token");
  const url = (path) => `${BASE}/${String(path).replace(/^\/+/, "")}`;

  /* ---------------------------------------------------------------- utils */

  const $ = (selector, scope) => (scope || document).querySelector(selector);
  const $$ = (selector, scope) => Array.from((scope || document).querySelectorAll(selector));

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[ch]));
  }

  function formatBytes(bytes) {
    const value = Number(bytes) || 0;
    if (value < 1024) return `${value} B`;
    const units = ["KB", "MB", "GB", "TB"];
    let size = value / 1024;
    let index = 0;
    while (size >= 1024 && index < units.length - 1) {
      size /= 1024;
      index += 1;
    }
    return `${size.toFixed(size >= 100 ? 0 : 1)} ${units[index]}`;
  }

  function formatDuration(seconds) {
    const total = Math.max(0, Number(seconds) || 0);
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    if (days > 0) return `${days}d ${String(hours).padStart(2, "0")}h`;
    if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
    if (minutes > 0) return `${minutes}m ${total % 60}s`;
    return `${total}s`;
  }

  /* ---------------------------------------------------------------- toasts */

  const toastHost = $("#toasts");

  function toast(message, type = "ok", timeout = 5200) {
    if (!toastHost) return;
    const node = document.createElement("div");
    node.className = `toast ${type === "err" ? "err" : "ok"}`;
    node.innerHTML = `<div style="flex:1">${escapeHtml(message)}</div>`;
    const close = document.createElement("button");
    close.className = "t-close";
    close.type = "button";
    close.setAttribute("aria-label", "Dismiss");
    close.textContent = "×";
    close.addEventListener("click", () => node.remove());
    node.appendChild(close);
    toastHost.appendChild(node);
    window.setTimeout(() => node.remove(), timeout);
  }

  const flash = $("[data-flash]");
  if (flash) {
    const type = flash.dataset.flash === "err" ? "err" : "ok";
    window.setTimeout(() => toast(flash.textContent.trim(), type), 120);
  }

  /* ------------------------------------------------------------------ api */

  async function api(path, options = {}) {
    const method = options.method || "GET";
    const headers = Object.assign({ Accept: "application/json" }, options.headers || {});
    let body = options.body;

    if (body && !(body instanceof FormData) && typeof body !== "string") {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(body);
    }
    if (!["GET", "HEAD"].includes(method)) {
      headers["X-CSRF-Token"] = CSRF;
    }

    let response;
    try {
      response = await fetch(path, { method, headers, body, credentials: "same-origin" });
    } catch (error) {
      throw new Error("Network error — check that the panel is reachable.");
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      let data = null;
      try {
        data = await response.json();
      } catch (error) {
        data = null;
      }
      if (!response.ok) {
        throw new Error((data && data.error) || `Request failed (${response.status})`);
      }
      return data;
    }

    if (response.status === 401) {
      window.location.href = url("login");
      throw new Error("Session expired");
    }
    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
    }
    return response;
  }

  /* ---------------------------------------------------------------- modal */

  const modalRoot = $("#modal-root");
  const modalTitle = $("#modal-title");
  const modalBody = $("#modal-body");
  const modalFooter = $("#modal-footer");
  let modalOnClose = null;

  function closeModal() {
    if (!modalRoot) return;
    modalRoot.classList.remove("open");
    if (modalBody) modalBody.innerHTML = "";
    if (modalFooter) modalFooter.innerHTML = "";
    if (typeof modalOnClose === "function") {
      const callback = modalOnClose;
      modalOnClose = null;
      callback();
    }
  }

  function openModal(config) {
    if (!modalRoot) return;
    modalTitle.textContent = config.title || "";
    modalBody.innerHTML = "";
    modalFooter.innerHTML = "";
    if (typeof config.body === "string") {
      modalBody.innerHTML = config.body;
    } else if (config.body instanceof Node) {
      modalBody.appendChild(config.body);
    }
    (config.buttons || []).forEach((button) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = `btn ${button.class || "ghost"}`;
      el.textContent = button.label;
      el.addEventListener("click", () => button.onClick(el));
      modalFooter.appendChild(el);
    });
    modalRoot.querySelector(".modal").classList.toggle("wide", !!config.wide);
    modalRoot.classList.add("open");
    modalOnClose = config.onClose || null;
    const focusTarget = modalBody.querySelector("input, textarea, select");
    if (focusTarget) window.setTimeout(() => focusTarget.focus(), 40);
    return { close: closeModal, body: modalBody, footer: modalFooter };
  }

  if (modalRoot) {
    modalRoot.addEventListener("click", (event) => {
      if (event.target === modalRoot || event.target.closest("[data-close-modal]")) closeModal();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && modalRoot.classList.contains("open")) closeModal();
    });
  }

  function confirmDialog(config) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      const body = document.createElement("div");
      body.innerHTML = `
        <p class="muted" style="margin-top:0">${escapeHtml(config.message || "")}</p>
        ${config.requireText ? `
          <div class="field">
            <label for="confirm-text">Type <strong>${escapeHtml(config.requireText)}</strong> to confirm</label>
            <input id="confirm-text" type="text" autocomplete="off">
          </div>` : ""}`;
      const handle = openModal({
        title: config.title || "Confirm",
        body,
        onClose: () => finish(false),
        buttons: [
          { label: config.cancelLabel || "Cancel", class: "ghost", onClick: () => { finish(false); closeModal(); } },
          {
            label: config.confirmLabel || "Confirm",
            class: config.danger ? "danger" : "",
            onClick: () => {
              if (config.requireText) {
                const input = $("#confirm-text", body);
                if (!input || input.value.trim() !== config.requireText) {
                  toast(`Type “${config.requireText}” exactly to continue.`, "err");
                  return;
                }
              }
              finish(true);
              closeModal();
            },
          },
        ],
      });
      if (handle && config.requireText) {
        const input = $("#confirm-text", body);
        if (input) {
          input.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              modalFooter.lastElementChild.click();
            }
          });
        }
      }
    });
  }

  function textPrompt(config) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      const body = document.createElement("div");
      body.innerHTML = `
        ${config.message ? `<p class="muted" style="margin-top:0">${escapeHtml(config.message)}</p>` : ""}
        <div class="field">
          <label for="prompt-value">${escapeHtml(config.label || "Value")}</label>
          <input id="prompt-value" type="text" value="${escapeHtml(config.value || "")}" autocomplete="off">
        </div>`;
      openModal({
        title: config.title || "Enter a value",
        body,
        onClose: () => finish(null),
        buttons: [
          { label: "Cancel", class: "ghost", onClick: () => { finish(null); closeModal(); } },
          {
            label: config.confirmLabel || "Save",
            onClick: () => {
              const input = $("#prompt-value", body);
              finish(input ? input.value : null);
              closeModal();
            },
          },
        ],
      });
    });
  }

  /* ---------------------------------------------------------------- theme */

  $$("[data-theme-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const current = document.documentElement.dataset.theme === "light" ? "dark" : "light";
      document.documentElement.dataset.theme = current;
      try {
        localStorage.setItem("btp-theme", current);
      } catch (error) {
        /* storage may be blocked */
      }
    });
  });

  /* ------------------------------------------------------------- ajax forms */

  $$("[data-ajax-form]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const errorBox = $("[data-form-error]", form);
      const submit = form.querySelector('[type="submit"]');
      if (errorBox) errorBox.classList.remove("show");
      if (submit) submit.disabled = true;

      try {
        const response = await api(form.dataset.endpoint, {
          method: "POST",
          body: new FormData(form),
          headers: { Accept: "application/json" },
        });
        const target = (response && response.redirected && response.url) || url("dashboard");
        window.location.href = target;
      } catch (error) {
        if (errorBox) {
          errorBox.textContent = error.message;
          errorBox.classList.add("show");
        } else {
          toast(error.message, "err");
        }
        if (submit) submit.disabled = false;
      }
    });
  });

  /* ------------------------------------------------------------- modal open */

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-open-modal]");
    if (!trigger) return;
    const kind = trigger.dataset.openModal;
    const template = document.getElementById(`${kind}-form-template`);
    if (!template) return;
    const fragment = template.content.cloneNode(true);
    const body = document.createElement("div");
    body.appendChild(fragment);

    const submitLabel = kind === "create-user" ? "Create user" : "Create server";
    openModal({
      title: kind === "create-user" ? "Add panel user" : "Create Minecraft server",
      body,
      buttons: [
        { label: "Cancel", class: "ghost", onClick: () => closeModal() },
        {
          label: submitLabel,
          onClick: (button) => {
            const form = $("form", body);
            if (!form) return;
            submitModalForm(form, button);
          },
        },
      ],
    });
  });

  async function submitModalForm(form, button) {
    const errorBox = $("[data-form-error]", form);
    if (errorBox) errorBox.classList.remove("show");
    button.disabled = true;
    const original = button.textContent;
    button.textContent = "Working…";

    const isUserForm = form.hasAttribute("data-create-user");
    const payload = {};
    new FormData(form).forEach((value, key) => {
      payload[key] = value;
    });
    if (form.querySelector('[name="accept_eula"]')) {
      payload.accept_eula = !!form.querySelector('[name="accept_eula"]').checked;
    }
    if (payload.memory_mb) payload.memory_mb = Number(payload.memory_mb);
    if (payload.port) payload.port = Number(payload.port);

    try {
      if (isUserForm) {
        await api(url("api/users"), { method: "POST", body: payload });
        toast("User created.");
        window.setTimeout(() => window.location.reload(), 500);
      } else {
        const result = await api(url("api/servers"), { method: "POST", body: payload });
        toast("Server created. Installing files is the next step.");
        closeModal();
        window.location.href = url(`servers/${result.server.id}`);
      }
    } catch (error) {
      if (errorBox) {
        errorBox.textContent = error.message;
        errorBox.classList.add("show");
      } else {
        toast(error.message, "err");
      }
      button.disabled = false;
      button.textContent = original;
    }
  }

  /* ----------------------------------------------------------------- power */

  document.addEventListener("click", async (event) => {
    const trigger = event.target.closest("[data-power]");
    if (!trigger) return;
    const serverId = trigger.dataset.server;
    const action = trigger.dataset.power;
    if (!serverId || !action) return;

    const labels = { start: "Starting…", stop: "Stopping…", restart: "Restarting…", kill: "Killing…" };
    const original = trigger.textContent;
    trigger.disabled = true;
    trigger.textContent = labels[action] || "Working…";

    try {
      const result = await api(url(`api/servers/${serverId}/power`), { method: "POST", body: { action } });
      toast(`${action.charAt(0).toUpperCase()}${action.slice(1)} sent. State: ${result.status.state}.`);
      window.setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      toast(error.message, "err");
      trigger.disabled = false;
      trigger.textContent = original;
    }
  });

  /* --------------------------------------------------------------- install */

  document.addEventListener("click", async (event) => {
    const trigger = event.target.closest("[data-install-server]");
    if (!trigger) return;
    const serverId = trigger.dataset.server;
    const ok = await confirmDialog({
      title: "Install server files",
      message: "The panel downloads the selected server software and replaces server.jar. The server must be stopped.",
      confirmLabel: "Download & install",
    });
    if (!ok) return;

    const original = trigger.textContent;
    trigger.disabled = true;
    trigger.textContent = "Downloading…";
    try {
      const result = await api(url(`api/servers/${serverId}/install`), { method: "POST" });
      toast(result.message || "Server files installed.");
      window.setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      toast(error.message, "err", 9000);
      trigger.disabled = false;
      trigger.textContent = original;
    }
  });

  /* -------------------------------------------------------------- tabs */

  const serverPage = $("[data-server-page]");

  function activateTab(name) {
    if (!serverPage) return;
    $$("[data-tab]").forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === name));
    $$("[data-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.panel !== name;
    });
    if (name === "files" && filesState.serverId && !filesState.loaded) {
      loadFiles("");
    }
    if (name === "console" && consoleState.serverId) {
      pollConsole();
    }
  }

  $$("[data-tab]").forEach((tab) => {
    tab.addEventListener("click", () => {
      activateTab(tab.dataset.tab);
      if (window.history.replaceState) {
        window.history.replaceState(null, "", `#${tab.dataset.tab}`);
      }
    });
  });
  $$("[data-tab-jump]").forEach((button) => {
    button.addEventListener("click", () => {
      activateTab(button.dataset.tabJump);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
  if (serverPage && window.location.hash) {
    const initial = window.location.hash.replace("#", "");
    if ($$("[data-tab]").some((tab) => tab.dataset.tab === initial)) activateTab(initial);
  }

  /* ------------------------------------------------------------ live status */

  function paintStatus(serverId, status) {
    const running = status && status.state === "running";
    $$(`[data-server-card][data-server-id="${serverId}"]`).forEach((card) => {
      const badge = $("[data-status-badge]", card);
      if (badge) {
        badge.className = `badge ${running ? "ok" : "off"}`;
        badge.innerHTML = `<span class="dot ${running ? "on" : "off"}"></span>${running ? "Running" : "Stopped"}`;
      }
      const uptime = $("[data-uptime]", card);
      if (uptime) uptime.textContent = running ? formatDuration(status.uptime) : "—";
      const memory = $("[data-memory]", card);
      if (memory) {
        memory.textContent = `${formatBytes(status.memory_bytes)} / ${card.dataset.memoryLimit || "—"}`;
      }
    });

    if (serverPage && serverPage.dataset.serverId === serverId) {
      const badge = $("[data-live-badge]", serverPage);
      if (badge) {
        badge.className = `badge ${running ? "ok" : "off"}`;
        badge.innerHTML = `<span class="dot ${running ? "on" : "off"}"></span>${running ? "Running" : "Stopped"}`;
      }
      const uptime = $("[data-live-uptime]", serverPage);
      if (uptime) uptime.textContent = running ? formatDuration(status.uptime) : "stopped";
      const state = $("[data-console-state]");
      if (state) state.textContent = running ? "live" : "offline";
    }
  }

  let statusTimer = null;
  async function refreshStatuses() {
    try {
      const data = await api(url("api/servers"));
      (data.servers || []).forEach((server) => paintStatus(server.id, server.status));
    } catch (error) {
      /* stay quiet: background refresh should not spam toasts */
    }
  }

  if ($("[data-server-card]") || serverPage) {
    statusTimer = window.setInterval(refreshStatuses, 12000);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && statusTimer) {
        window.clearInterval(statusTimer);
        statusTimer = null;
      } else if (!statusTimer && ($("[data-server-card]") || serverPage)) {
        statusTimer = window.setInterval(refreshStatuses, 12000);
      }
    });
  }

  $("[data-refresh-stats]")?.addEventListener("click", refreshStatuses);

  /* -------------------------------------------------------------- console */

  const consoleState = {
    serverId: serverPage ? serverPage.dataset.serverId : null,
    offset: serverPage ? Number(serverPage.dataset.consoleOffset || 0) : 0,
    timer: null,
    history: [],
    historyIndex: -1,
  };

  const consoleLog = $("[data-console-log]");
  const consolePreview = $("[data-console-preview]");
  const consoleInput = $("[data-console-input]");
  const followCheckbox = $("[data-console-follow]");

  function classify(line) {
    if (/joined the game/i.test(line)) return "join";
    if (/\/\s*(ERROR|SEVERE|FATAL)\b/i.test(line) || /Exception|Caused by:/.test(line)) return "error";
    if (/\/\s*(WARN|WARNING)\b/i.test(line)) return "warn";
    if (/\/\s*INFO\b/i.test(line)) return "info";
    return "";
  }

  function appendConsole(target, text, isCommand) {
    if (!target || !text) return;
    let anchor = target.querySelector(".console-empty");
    if (anchor) anchor.remove();
    const fragment = document.createDocumentFragment();
    text.split(/\r?\n/).forEach((raw) => {
      const line = raw.replace(/\x1b\[[0-9;]*m/g, "");
      if (!line.trim()) return;
      const div = document.createElement("div");
      div.className = `line ${isCommand ? "cmd" : classify(line)}`;
      div.textContent = isCommand ? `> ${line}` : line;
      fragment.appendChild(div);
    });
    target.appendChild(fragment);
    const maxLines = 1200;
    while (target.childElementCount > maxLines) target.removeChild(target.firstElementChild);
    if (!followCheckbox || followCheckbox.checked) {
      target.scrollTop = target.scrollHeight;
    }
    if (consolePreview) {
      consolePreview.appendChild(fragment.cloneNode(true));
      while (consolePreview.childElementCount > 120) consolePreview.removeChild(consolePreview.firstElementChild);
      consolePreview.scrollTop = consolePreview.scrollHeight;
    }
  }

  async function pollConsole() {
    if (!consoleState.serverId) return;
    try {
      const data = await api(url(`api/servers/${consoleState.serverId}/console?since=${consoleState.offset}`));
      if (data.offset < consoleState.offset) {
        consoleState.offset = data.offset;
        if (consoleLog) consoleLog.innerHTML = "";
      }
      if (data.data) appendConsole(consoleLog, data.data, false);
      consoleState.offset = data.offset;
      if (data.status) paintStatus(consoleState.serverId, data.status);
    } catch (error) {
      /* offline or transient — retry on next tick */
    } finally {
      const delay = document.hidden ? 20000 : 3000;
      consoleState.timer = window.setTimeout(pollConsole, delay);
    }
  }

  if (consoleState.serverId) {
    pollConsole();
  }

  $("[data-console-clear]")?.addEventListener("click", () => {
    if (consoleLog) consoleLog.innerHTML = "";
    if (consolePreview) consolePreview.innerHTML = "";
  });

  $("[data-console-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const command = (consoleInput?.value || "").trim();
    if (!command || !consoleState.serverId) return;
    consoleState.history.push(command);
    consoleState.historyIndex = -1;
    appendConsole(consoleLog, command, true);
    if (consoleInput) consoleInput.value = "";
    try {
      const data = await api(url(`api/servers/${consoleState.serverId}/console`), {
        method: "POST",
        body: { command },
      });
      if (data.reply) appendConsole(consoleLog, data.reply, false);
    } catch (error) {
      toast(error.message, "err");
    }
  });

  if (consoleInput) {
    consoleInput.addEventListener("keydown", (event) => {
      const { history } = consoleState;
      if (event.key === "ArrowUp" && history.length) {
        event.preventDefault();
        consoleState.historyIndex = consoleState.historyIndex < 0
          ? history.length - 1
          : Math.max(0, consoleState.historyIndex - 1);
        consoleInput.value = history[consoleState.historyIndex];
      } else if (event.key === "ArrowDown" && history.length) {
        event.preventDefault();
        if (consoleState.historyIndex < 0) return;
        consoleState.historyIndex += 1;
        if (consoleState.historyIndex >= history.length) {
          consoleState.historyIndex = -1;
          consoleInput.value = "";
        } else {
          consoleInput.value = history[consoleState.historyIndex];
        }
      }
    });
  }

  /* ----------------------------------------------------------------- files */

  const filesState = {
    serverId: serverPage ? serverPage.dataset.serverId : null,
    path: "",
    loaded: false,
    usage: 0,
  };

  const fileList = $("[data-file-list]");
  const filePath = $("[data-file-path]");
  const fileUsage = $("[data-file-usage]");
  const fileInput = $("[data-file-input]");

  function fileIcon(entry) {
    if (entry.type === "dir") return "folder";
    if (entry.extension === "jar") return "cpu";
    if (entry.extension === "log" || entry.extension === "txt") return "file";
    if (entry.extension === "gz" || entry.extension === "zip") return "archive";
    return "file";
  }

  function iconSvg(name) {
    const paths = {
      folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
      file: '<path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h5"/>',
      cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
      archive: '<rect x="3" y="3.5" width="18" height="5" rx="1.5"/><path d="M4.5 8.5V19a1.5 1.5 0 0 0 1.5 1.5h12A1.5 1.5 0 0 0 19.5 19V8.5"/>',
    };
    return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.file}</svg>`;
  }

  function renderBreadcrumbs(path) {
    if (!filePath) return;
    filePath.innerHTML = "";
    const root = document.createElement("button");
    root.type = "button";
    root.textContent = "/";
    root.dataset.filePathGo = "";
    filePath.appendChild(root);
    const parts = path ? path.split("/").filter(Boolean) : [];
    parts.forEach((part, index) => {
      const separator = document.createElement("span");
      separator.textContent = "/";
      filePath.appendChild(separator);
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = part;
      button.dataset.filePathGo = parts.slice(0, index + 1).join("/");
      filePath.appendChild(button);
    });
  }

  async function loadFiles(path) {
    if (!filesState.serverId || !fileList) return;
    fileList.innerHTML = '<div class="empty"><span class="spinner"></span> <span class="muted" style="margin-left:8px">Loading files…</span></div>';
    try {
      const data = await api(url(`api/servers/${filesState.serverId}/files?path=${encodeURIComponent(path)}`));
      filesState.path = data.path || "";
      filesState.loaded = true;
      filesState.usage = data.usage_bytes || 0;
      renderBreadcrumbs(filesState.path);
      if (fileUsage) fileUsage.textContent = `${formatBytes(filesState.usage)} used`;
      renderFiles(data.entries || []);
    } catch (error) {
      fileList.innerHTML = `<div class="empty"><p class="muted">${escapeHtml(error.message)}</p></div>`;
    }
  }

  function renderFiles(entries) {
    if (!fileList) return;
    fileList.innerHTML = "";
    if (!entries.length) {
      fileList.innerHTML = '<div class="empty muted">This folder is empty.</div>';
      return;
    }
    entries.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "file-row";

      const name = document.createElement("div");
      name.className = `file-name ${entry.type === "dir" ? "dir" : ""}`;
      name.dataset.fileEntry = entry.path;
      name.dataset.fileType = entry.type;
      name.innerHTML = `${iconSvg(fileIcon(entry))}<span></span>`;
      name.querySelector("span").textContent = entry.name;

      const size = document.createElement("div");
      size.className = "num";
      size.textContent = entry.type === "dir" ? "folder" : formatBytes(entry.size);

      const modified = document.createElement("div");
      modified.className = "num file-modified";
      modified.textContent = new Date(entry.modified * 1000).toLocaleDateString();

      const actions = document.createElement("div");
      actions.className = "file-actions";

      if (entry.type === "file") {
        actions.innerHTML = `
          <button class="ghost-btn sm" type="button" data-file-edit="${escapeHtml(entry.path)}" title="Edit">✎</button>
          <a class="ghost-btn sm" href="${url(`api/servers/${filesState.serverId}/files/download?path=${encodeURIComponent(entry.path)}`)}" title="Download">↓</a>
          <button class="ghost-btn sm" type="button" data-file-delete="${escapeHtml(entry.path)}" title="Delete">×</button>`;
      } else {
        actions.innerHTML = `
          <button class="ghost-btn sm" type="button" data-file-delete="${escapeHtml(entry.path)}" title="Delete">×</button>`;
      }

      row.append(name, size, modified, actions);
      fileList.appendChild(row);
    });
  }

  document.addEventListener("click", (event) => {
    const dirTarget = event.target.closest("[data-file-entry]");
    if (dirTarget && dirTarget.dataset.fileType === "dir" && !event.target.closest("button, a")) {
      loadFiles(dirTarget.dataset.fileEntry);
      return;
    }

    const crumb = event.target.closest("[data-file-path-go]");
    if (crumb) {
      loadFiles(crumb.dataset.filePathGo);
      return;
    }

    const edit = event.target.closest("[data-file-edit]");
    if (edit) {
      openFileEditor(edit.dataset.fileEdit);
      return;
    }

    const remove = event.target.closest("[data-file-delete]");
    if (remove) {
      deleteFile(remove.dataset.fileDelete);
    }
  });

  async function openFileEditor(path) {
    try {
      const data = await api(url(`api/servers/${filesState.serverId}/files/content?path=${encodeURIComponent(path)}`));
      const wrapper = document.createElement("div");
      wrapper.innerHTML = `<textarea class="code" spellcheck="false"></textarea>`;
      const textarea = wrapper.querySelector("textarea");
      textarea.value = data.content;
      openModal({
        title: data.name,
        body: wrapper,
        wide: true,
        buttons: [
          { label: "Cancel", class: "ghost", onClick: () => closeModal() },
          {
            label: "Save file",
            onClick: async (button) => {
              button.disabled = true;
              try {
                await api(url(`api/servers/${filesState.serverId}/files/content`), {
                  method: "PUT",
                  body: { path, content: textarea.value },
                });
                toast("File saved.");
                closeModal();
              } catch (error) {
                toast(error.message, "err");
                button.disabled = false;
              }
            },
          },
        ],
      });
    } catch (error) {
      toast(error.message, "err");
    }
  }

  async function deleteFile(path) {
    const ok = await confirmDialog({
      title: "Delete entry",
      message: `Delete “${path}”? Folders are removed with everything inside.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await api(url(`api/servers/${filesState.serverId}/files/delete`), {
        method: "POST",
        body: { path, recursive: true },
      });
      toast("Deleted.");
      loadFiles(filesState.path);
    } catch (error) {
      toast(error.message, "err");
    }
  }

  $("[data-file-refresh]")?.addEventListener("click", () => loadFiles(filesState.path));

  $("[data-file-mkdir]")?.addEventListener("click", async () => {
    const name = await textPrompt({ title: "New folder", label: "Folder name", confirmLabel: "Create" });
    if (!name) return;
    const path = [filesState.path, name.trim()].filter(Boolean).join("/");
    try {
      await api(url(`api/servers/${filesState.serverId}/files/mkdir`), { method: "POST", body: { path } });
      toast("Folder created.");
      loadFiles(filesState.path);
    } catch (error) {
      toast(error.message, "err");
    }
  });

  $("[data-file-up]")?.addEventListener("click", () => fileInput?.click());

  fileInput?.addEventListener("change", async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("path", filesState.path);
    try {
      await api(url(`api/servers/${filesState.serverId}/files/upload`), { method: "POST", body: formData });
      toast(`Uploaded ${file.name}.`);
      loadFiles(filesState.path);
    } catch (error) {
      toast(error.message, "err");
    } finally {
      fileInput.value = "";
    }
  });

  /* --------------------------------------------------------------- backups */

  const backupRows = $("[data-backup-rows]");

  async function loadBackups() {
    if (!filesState.serverId || !backupRows) return;
    try {
      const data = await api(url(`api/servers/${filesState.serverId}/backups`));
      renderBackups(data.backups || []);
    } catch (error) {
      toast(error.message, "err");
    }
  }

  function renderBackups(backups) {
    if (!backupRows) return;
    if (!backups.length) {
      backupRows.innerHTML = '<tr><td colspan="4"><div class="empty muted">No backups yet.</div></td></tr>';
      return;
    }
    backupRows.innerHTML = "";
    backups.forEach((backup) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td class="mono small">${escapeHtml(new Date(backup.created_at).toLocaleString())}</td>
        <td>${escapeHtml(backup.label || "—")}</td>
        <td class="mono small">${formatBytes(backup.size)}</td>
        <td><div class="actions">
          <a class="ghost-btn sm" href="${url(`api/servers/${filesState.serverId}/backups/${backup.id}/download`)}">↓</a>
          <button class="ghost-btn sm" type="button" data-backup-restore="${backup.id}">↺</button>
          <button class="ghost-btn sm" type="button" data-backup-delete="${backup.id}">×</button>
        </div></td>`;
      backupRows.appendChild(row);
    });
  }

  $("[data-backup-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const labelInput = $('[name="label"]', form);
    const button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    try {
      await api(url(`api/servers/${filesState.serverId}/backups`), {
        method: "POST",
        body: { label: labelInput ? labelInput.value : "" },
      });
      toast("Backup created.");
      if (labelInput) labelInput.value = "";
      loadBackups();
    } catch (error) {
      toast(error.message, "err");
    } finally {
      if (button) button.disabled = false;
    }
  });

  $("[data-backup-refresh]")?.addEventListener("click", loadBackups);

  document.addEventListener("click", async (event) => {
    const restore = event.target.closest("[data-backup-restore]");
    if (restore) {
      const ok = await confirmDialog({
        title: "Restore backup",
        message: "The server directory will be replaced with this archive. The server must be stopped.",
        confirmLabel: "Restore",
        danger: true,
      });
      if (!ok) return;
      try {
        const data = await api(url(`api/servers/${filesState.serverId}/backups/${restore.dataset.backupRestore}/restore`), {
          method: "POST",
        });
        toast(data.message || "Backup restored.");
        window.setTimeout(() => window.location.reload(), 900);
      } catch (error) {
        toast(error.message, "err");
      }
      return;
    }

    const remove = event.target.closest("[data-backup-delete]");
    if (remove) {
      const ok = await confirmDialog({
        title: "Delete backup",
        message: "This archive will be permanently deleted.",
        confirmLabel: "Delete",
        danger: true,
      });
      if (!ok) return;
      try {
        await api(url(`api/servers/${filesState.serverId}/backups/${remove.dataset.backupDelete}`), { method: "DELETE" });
        toast("Backup deleted.");
        window.setTimeout(() => window.location.reload(), 600);
      } catch (error) {
        toast(error.message, "err");
      }
    }
  });

  /* --------------------------------------------------------- server settings */

  $("[data-server-settings]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const payload = {};
    new FormData(form).forEach((value, key) => {
      if (value === "" && key === "rcon_password") return;
      payload[key] = key === "memory_mb" || key === "port" ? Number(value) : value;
    });
    if (button) button.disabled = true;
    try {
      await api(url(`api/servers/${filesState.serverId}`), { method: "PATCH", body: payload });
      toast("Settings saved.");
      window.setTimeout(() => window.location.reload(), 600);
    } catch (error) {
      toast(error.message, "err");
    } finally {
      if (button) button.disabled = false;
    }
  });

  document.addEventListener("click", async (event) => {
    const trigger = event.target.closest("[data-delete-server]");
    if (!trigger) return;
    const name = trigger.dataset.serverName || "";
    const ok = await confirmDialog({
      title: "Delete server",
      message: `This stops the server and permanently deletes its files and backups.`,
      confirmLabel: "Delete forever",
      danger: true,
      requireText: name,
    });
    if (!ok) return;
    try {
      await api(url(`api/servers/${trigger.dataset.deleteServer}`), {
        method: "DELETE",
        headers: { "X-Confirm-Name": encodeURIComponent(name) },
      });
      toast("Server deleted.");
      window.setTimeout(() => {
        window.location.href = url("servers");
      }, 600);
    } catch (error) {
      toast(error.message, "err");
    }
  });

  /* ----------------------------------------------------------------- users */

  document.addEventListener("click", async (event) => {
    const role = event.target.closest("[data-user-role]");
    if (role) {
      try {
        await api(url(`api/users/${role.dataset.userRole}`), {
          method: "PATCH",
          body: { role: role.dataset.role },
        });
        toast("Role updated.");
        window.setTimeout(() => window.location.reload(), 500);
      } catch (error) {
        toast(error.message, "err");
      }
      return;
    }

    const remove = event.target.closest("[data-user-delete]");
    if (remove) {
      const ok = await confirmDialog({
        title: "Delete user",
        message: `Delete ${remove.dataset.userEmail}? Their servers are reassigned to you.`,
        confirmLabel: "Delete user",
        danger: true,
      });
      if (!ok) return;
      try {
        await api(url(`api/users/${remove.dataset.userDelete}`), { method: "DELETE" });
        toast("User deleted.");
        window.setTimeout(() => window.location.reload(), 500);
      } catch (error) {
        toast(error.message, "err");
      }
      return;
    }

    const password = event.target.closest("[data-user-password]");
    if (password) {
      const value = await textPrompt({
        title: `New password for ${password.dataset.userEmail}`,
        label: "Password (min. 10 characters)",
        confirmLabel: "Set password",
      });
      if (!value) return;
      try {
        await api(url(`api/users/${password.dataset.userPassword}`), {
          method: "PATCH",
          body: { password: value },
        });
        toast("Password updated. Their sessions were signed out.");
      } catch (error) {
        toast(error.message, "err");
      }
    }
  });

  /* -------------------------------------------------------------- settings */

  $("[data-settings-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = {};
    new FormData(form).forEach((value, key) => {
      payload[key] = key === "default_memory_mb" ? Number(value) : value;
    });
    try {
      await api(url("api/settings"), { method: "PATCH", body: payload });
      toast("Settings saved. Reload to see the panel name everywhere.");
    } catch (error) {
      toast(error.message, "err");
    }
  });

  $("[data-password-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const errorBox = $("[data-form-error]", form);
    const payload = {};
    new FormData(form).forEach((value, key) => {
      payload[key] = value;
    });
    if (errorBox) errorBox.classList.remove("show");
    try {
      await api(url("api/account/password"), { method: "POST", body: payload });
      toast("Password updated.");
      form.reset();
    } catch (error) {
      if (errorBox) {
        errorBox.textContent = error.message;
        errorBox.classList.add("show");
      } else {
        toast(error.message, "err");
      }
    }
  });

  /* --------------------------------------------------------------- cleanup */

  window.addEventListener("beforeunload", () => {
    if (consoleState.timer) window.clearTimeout(consoleState.timer);
    if (statusTimer) window.clearInterval(statusTimer);
  });
})();
