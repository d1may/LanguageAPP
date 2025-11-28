const THEME_STORAGE_KEY = "app-theme";
const NORMALIZED_THEMES = new Set(["amber", "sapphire"]);
let activeTheme;

function readStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && NORMALIZED_THEMES.has(stored)) {
      return stored;
    }
  } catch (err) {
    console.warn("Unable to read stored theme:", err);
  }
  return "amber";
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
  const normalized = NORMALIZED_THEMES.has(theme) ? theme : "amber";
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
