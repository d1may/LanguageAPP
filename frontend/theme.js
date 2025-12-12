const THEME_STORAGE_KEY = "app-theme";
const FALLBACK_THEME = "amber";
const NORMALIZED_THEMES = new Set([FALLBACK_THEME]);
let activeTheme;

function syncThemeRegistry() {
  const sheets = document.querySelectorAll("link[data-theme-sheet]");
  if (!sheets.length) {
    document.addEventListener(
      "DOMContentLoaded",
      () => syncThemeRegistry(),
      { once: true },
    );
    return;
  }

  sheets.forEach((link) => {
    const themeName = (link.dataset.themeSheet || "").trim();
    if (themeName) {
      NORMALIZED_THEMES.add(themeName);
    }
  });
}

syncThemeRegistry();

function normalizeTheme(theme) {
  const candidate = typeof theme === "string" ? theme.trim() : "";
  if (candidate && NORMALIZED_THEMES.has(candidate)) {
    return candidate;
  }

  if (candidate) {
    const link = document.querySelector(`link[data-theme-sheet="${candidate}"]`);
    if (link) {
      NORMALIZED_THEMES.add(candidate);
      return candidate;
    }
  }

  if (NORMALIZED_THEMES.has(FALLBACK_THEME)) {
    return FALLBACK_THEME;
  }

  const iterator = NORMALIZED_THEMES.values().next();
  return iterator.value || FALLBACK_THEME;
}

function readStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored) {
      return normalizeTheme(stored);
    }
  } catch (err) {
    console.warn("Unable to read stored theme:", err);
  }
  return normalizeTheme();
}

function storeTheme(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (err) {
    console.warn("Unable to persist theme:", err);
  }
}

function updateThemeAttribute(theme) {
  document.documentElement.dataset.theme = theme;
  if (document.body) {
    document.body.dataset.theme = theme;
  } else {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        if (document.body) {
          document.body.dataset.theme = theme;
        }
      },
      { once: true },
    );
  }
}

function updateThemeSheets(theme) {
  const sheets = document.querySelectorAll("link[data-theme-sheet]");
  if (!sheets.length) {
    document.addEventListener(
      "DOMContentLoaded",
      () => updateThemeSheets(theme),
      { once: true },
    );
    return;
  }

  sheets.forEach((link) => {
    const sheetTheme = link.dataset.themeSheet;
    link.disabled = sheetTheme !== theme;
  });
}

export function applyTheme(theme, persist = true) {
  const normalized = normalizeTheme(theme);
  activeTheme = normalized;
  updateThemeAttribute(normalized);
  updateThemeSheets(normalized);
  if (persist) {
    storeTheme(normalized);
  }
  return normalized;
}

export function initTheme() {
  if (!activeTheme) {
    activeTheme = readStoredTheme();
  }
  applyTheme(activeTheme, false);
}

export function getActiveTheme() {
  if (!activeTheme) {
    activeTheme = readStoredTheme();
  }
  return activeTheme;
}
