(() => {
  const body = document.body;
  const menu = document.querySelector("[data-menu]");
  const sidebar = document.querySelector("#sidebar");

  menu?.addEventListener("click", () => sidebar?.classList.toggle("open"));
  sidebar?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => sidebar.classList.remove("open"));
  });

  document.querySelectorAll("form[data-confirm]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      if (!window.confirm(form.dataset.confirm || "Continue?"))
        event.preventDefault();
    });
  });

  document.querySelectorAll("form").forEach((form) => {
    form.addEventListener("submit", () => {
      window.setTimeout(() => {
        form.querySelectorAll('button[type="submit"]').forEach((button) => {
          button.disabled = true;
        });
      }, 0);
    });
  });

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    body.appendChild(area);
    area.select();
    const copied = document.execCommand("copy");
    area.remove();
    if (!copied) throw new Error("Copy failed");
  }

  document.querySelectorAll("[data-copy]").forEach((button) => {
    button.addEventListener("click", async () => {
      const original = button.textContent;
      try {
        await copyText(button.dataset.copy || "");
        button.textContent = "Copied";
      } catch {
        button.textContent = "Select + copy";
      }
      window.setTimeout(() => {
        button.textContent = original;
      }, 1600);
    });
  });

  const search = document.querySelector("[data-search]");
  if (search) {
    const items = Array.from(document.querySelectorAll("[data-search-item]"));
    search.addEventListener("input", () => {
      const query = search.value.trim().toLowerCase();
      items.forEach((item) => {
        item.hidden =
          query !== "" && !(item.dataset.searchItem || "").includes(query);
      });
    });
  }

  document
    .querySelector("[data-setting-mode]")
    ?.addEventListener("change", (event) => {
      body.dataset.mode = event.target.value;
    });
  document
    .querySelector("[data-setting-card-theme]")
    ?.addEventListener("change", (event) => {
      body.dataset.cardTheme = event.target.value;
    });
  document
    .querySelector("[data-setting-card-glass]")
    ?.addEventListener("change", (event) => {
      body.dataset.cardGlass = event.target.checked ? "on" : "off";
    });
  document
    .querySelector('input[name="accent"]')
    ?.addEventListener("input", (event) => {
      body.style.setProperty("--accent", event.target.value);
    });
})();
