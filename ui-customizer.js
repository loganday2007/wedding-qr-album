(function () {
  const STORAGE_KEY = "WEDDING_UI_SETTINGS_V1";

  const defaultSettings = {
    colors: {
      bg: "#f7f2e8",
      card: "#fffdf8",
      ink: "#1f1f1f",
      muted: "#656565",
      brand: "#8c5d3f",
      brandAlt: "#bf8d6b",
      buttonBg: "#23170e",
      buttonText: "#ffffff",
      line: "#e7dccf",
    },
    text: {
      index_title: "Wedding Memory Album",
      index_subtitle: "Drop in your best moments from tonight.",
      index_notice: "Original quality is preserved. Large videos may take extra upload time.",
      index_drop_prompt: "Drop files here or tap the button below.",
      index_choose_files: "Choose Photos/Videos",
      index_camera_button: "Take Photo/Video",
      index_no_files: "No files selected yet.",
      index_upload_button: "Upload to Album",
      index_footer: "Having trouble? Ask the wedding host for the direct upload link.",

      qr_title: "Wedding QR Code",
      qr_note: "Paste the public upload page URL (where guests should land after scanning).",
      qr_generate_button: "Generate QR",
      qr_download_button: "Download PNG",
      qr_tip: "Tip: print this at 6x6 inches or larger for easy scanning.",
      qr_url_placeholder: "https://yourdomain.com/wedding-upload/",

      poster_title: "Scan to Share Your Wedding Photos",
      poster_subtitle: "Upload your pictures and videos to our live album.",
      poster_tip: "Keep your camera steady 1-2 feet away to scan quickly.",
      poster_refresh_button: "Refresh QR",
      poster_print_button: "Print Poster",

      host_title: "Wedding Host Dashboard",
      host_subtitle: "Protected view for pulling original files from your own storage bucket.",
      host_guest_label: "Guest Upload URL",
      host_guest_link: "Open guest page",
      host_code_placeholder: "Enter host access code",
      host_continue_button: "Continue",
      host_load_button: "Load Album",
      host_refresh_button: "Refresh",
      host_export_button: "Export ZIP for iCloud",
      host_empty: "No uploads yet.",
    },
  };

  const clone = (value) => JSON.parse(JSON.stringify(value));

  const mergeSettings = (base, override) => {
    const merged = clone(base);
    if (!override || typeof override !== "object") return merged;

    if (override.colors && typeof override.colors === "object") {
      Object.keys(merged.colors).forEach((key) => {
        if (typeof override.colors[key] === "string" && override.colors[key].trim()) {
          merged.colors[key] = override.colors[key].trim();
        }
      });
    }

    if (override.text && typeof override.text === "object") {
      Object.keys(merged.text).forEach((key) => {
        if (typeof override.text[key] === "string") {
          merged.text[key] = override.text[key];
        }
      });
    }

    return merged;
  };

  const loadSettings = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return clone(defaultSettings);
      const parsed = JSON.parse(raw);
      return mergeSettings(defaultSettings, parsed);
    } catch (_) {
      return clone(defaultSettings);
    }
  };

  const saveSettings = (settings) => {
    const merged = mergeSettings(defaultSettings, settings);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    return merged;
  };

  const clearSettings = () => {
    localStorage.removeItem(STORAGE_KEY);
    return clone(defaultSettings);
  };

  const applyColors = (settings) => {
    const c = settings.colors;
    const root = document.documentElement;

    root.style.setProperty("--bg", c.bg);
    root.style.setProperty("--card", c.card);
    root.style.setProperty("--panel", c.card);
    root.style.setProperty("--paper", c.card);
    root.style.setProperty("--ink", c.ink);
    root.style.setProperty("--muted", c.muted);
    root.style.setProperty("--brand", c.brand);
    root.style.setProperty("--brand-2", c.brandAlt);
    root.style.setProperty("--line", c.line);
    root.style.setProperty("--accent", c.brand);
    root.style.setProperty("--button-bg", c.buttonBg);
    root.style.setProperty("--button-text", c.buttonText);
  };

  const applyText = (settings) => {
    document.querySelectorAll("[data-text-key]").forEach((el) => {
      const key = el.getAttribute("data-text-key");
      if (key && settings.text[key] !== undefined) {
        el.textContent = settings.text[key];
      }
    });

    document.querySelectorAll("[data-placeholder-key]").forEach((el) => {
      const key = el.getAttribute("data-placeholder-key");
      if (key && settings.text[key] !== undefined) {
        el.setAttribute("placeholder", settings.text[key]);
      }
    });
  };

  const apply = () => {
    const settings = loadSettings();
    applyColors(settings);
    applyText(settings);
    return settings;
  };

  window.WeddingUI = {
    storageKey: STORAGE_KEY,
    defaultSettings: clone(defaultSettings),
    loadSettings,
    saveSettings,
    clearSettings,
    apply,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", apply);
  } else {
    apply();
  }
})();
