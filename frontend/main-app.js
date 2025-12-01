import { api, qs, show, PATHS } from "./api.js";
import { applyTheme, getActiveTheme } from "./theme.js";

let currentLang = "en";
let currentTheme = getActiveTheme();
let themeInputs = [];
let langInputs = [];

const STATUS_TO_RATING = {
  easy: "high",
  ok: "medium",
  hard: "low",
};

const DEFAULT_SNAPSHOT = {
  recent: [],
  buckets: {
    high: [],
    medium: [],
    low: [],
  },
};

function updateLangBadge() {
  const badge = qs("#word-lang");
  if (!badge) return;
  badge.textContent = currentLang === "de" ? "German" : "English";
}

function updateThemeRadios() {
  if (!themeInputs.length) {
    themeInputs = Array.from(document.querySelectorAll('input[name="app-theme"]'));
  }
  themeInputs.forEach((input) => {
    input.checked = input.value === currentTheme;
  });
}

const BADGE_META = {
  high: { label: "HIGH", className: "high" },
  medium: { label: "MEDIUM", className: "medium" },
  low: { label: "LOW", className: "low" },
};

const LIBRARY_FILTERS = {
  recent: {
    fallback: "No saved words yet",
    getItems: (snapshot) => snapshot.recent || [],
  },
  high: {
    fallback: "No high-rated words",
    getItems: (snapshot) => snapshot.buckets?.high || [],
  },
  medium: {
    fallback: "No medium-rated words",
    getItems: (snapshot) => snapshot.buckets?.medium || [],
  },
  low: {
    fallback: "No low-rated words",
    getItems: (snapshot) => snapshot.buckets?.low || [],
  },
};

function escapeHtml(str = "") {
  return str
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeWordEntity(item = {}, ratingOverride) {
  const rating = ratingOverride || STATUS_TO_RATING[item.status] || "medium";
  return {
    word: item.word || "—",
    translation: item.translate || item.translation || "",
    comment: item.comment || item.note || "",
    rating,
  };
}

function normalizeLibraryData(data = {}) {
  const mapList = (items, ratingOverride) =>
    Array.isArray(items) ? items.map((item) => normalizeWordEntity(item, ratingOverride)) : [];

  return {
    recent: mapList(data.recent),
    buckets: {
      high: mapList(data?.buckets?.high, "high"),
      medium: mapList(data?.buckets?.medium, "medium"),
      low: mapList(data?.buckets?.low, "low"),
    },
  };
}

function setTableMessage(target, text) {
  if (!target) return;
  target.innerHTML = `
    <tr>
      <td colspan="4" class="word-table-empty">${escapeHtml(text)}</td>
    </tr>
  `;
}

function createEditableField({
  value = "",
  placeholder = "",
  field,
  word = "",
  maxLength,
}) {
  const safeValue = value ? escapeHtml(value) : "";
  const safePlaceholder = escapeHtml(placeholder);
  const safeWord = escapeHtml(word);
  const maxAttr = Number.isFinite(maxLength) ? `data-maxlength="${maxLength}"` : "";

  return `<div class="word-input" contenteditable="true" data-field="${field}" ${maxAttr} data-word="${safeWord}" data-placeholder="${safePlaceholder}">${safeValue}</div>`;
}

function renderWordRow(item) {
  const safeWord = escapeHtml(item.word || "—");
  const badge = item.rating && BADGE_META[item.rating] ? BADGE_META[item.rating] : null;
  const badgeMarkup = badge
    ? `<span class="word-badge ${badge.className}">${badge.label}</span>`
    : "—";
  const translationField = createEditableField({
    value: item.translation || "",
    placeholder: "Add translation",
    field: "translation",
    word: item.word || "",
    maxLength: 50,
  });
  const commentField = createEditableField({
    value: item.comment || "",
    placeholder: "Add comment",
    field: "comment",
    word: item.word || "",
    maxLength: 75,
  });

  return `
    <tr>
      <td>${safeWord}</td>
      <td>${translationField}</td>
      <td>${commentField}</td>
      <td>${badgeMarkup}</td>
    </tr>
  `;
}

function renderWordTable(target, items = [], fallback = "No data") {
  if (!target) return;

  if (!items.length) {
    target.innerHTML = `
      <tr>
        <td colspan="4" class="word-table-empty">${escapeHtml(fallback)}</td>
      </tr>
    `;
    return;
  }

  target.innerHTML = items.map((item) => renderWordRow(item)).join("");
}

function enforceEditableLimit(element, maxLength) {
  if (!element || !Number.isFinite(maxLength)) return;
  const text = element.textContent || "";
  if (text.length <= maxLength) return;

  const trimmed = text.slice(0, maxLength);
  element.textContent = trimmed;

  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function initWordLibrary() {
  const tableBody = qs("#word-library-body");
  const menu = document.querySelector(".library-menu");
  if (!tableBody || !menu) return;

  const refreshBtn = qs("#btn-refresh-library");
  let currentSnapshot = DEFAULT_SNAPSHOT;
  let activeFilter = "recent";

  const applyFilter = (filterKey = "recent") => {
    const config = LIBRARY_FILTERS[filterKey] || LIBRARY_FILTERS.recent;
    activeFilter = filterKey in LIBRARY_FILTERS ? filterKey : "recent";

    menu.querySelectorAll("[data-library-filter]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.libraryFilter === activeFilter);
    });

    const items = config.getItems(currentSnapshot);
    renderWordTable(tableBody, items, config.fallback);
  };

  menu.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-library-filter]");
    if (!btn) return;
    const { libraryFilter } = btn.dataset;
    if (libraryFilter === activeFilter) return;
    applyFilter(libraryFilter);
  });

  const loadSnapshot = async (showPlaceholder = true) => {
    if (showPlaceholder) {
      setTableMessage(tableBody, "Loading data…");
    }
    try {
      const data = await api(PATHS.wordLibrary, "GET");
      currentSnapshot = normalizeLibraryData(data);
      applyFilter(activeFilter);
    } catch (err) {
      console.error("Failed to load word library:", err);
      setTableMessage(
        tableBody,
        `Failed to load: ${escapeHtml(err.message || "unknown error")}`,
      );
    }
  };

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      loadSnapshot(false);
    });
  }

  loadSnapshot(true);

  tableBody.addEventListener("input", (e) => {
    const target = e.target.closest(".word-input");
    if (!target) return;
    const max = parseInt(target.dataset.maxlength || "", 10);
    if (!max) return;
    enforceEditableLimit(target, max);
  });

  return {
    reload(withPlaceholder = true) {
      loadSnapshot(withPlaceholder);
    },
  };
}

/* ===================== BOOTSTRAP ===================== */

async function bootstrap() {
  try {
    await api(PATHS.me);        // auth check (+ auto refresh)
    await loadSettings();       // pull saved language from DB
  } catch (err) {
    console.warn("Auth check failed:", err.message);
    window.location = "/auth";
  }
}

async function loadSettings() {
  try {
    const data = await api(PATHS.settings, "GET");
    currentLang = data.random_word_lang || "en";
    currentTheme = data.theme || currentTheme;
    updateLangBadge();
    applyTheme(currentTheme);
    updateThemeRadios();

    // check the correct radio control
    langInputs = Array.from(document.querySelectorAll('input[name="rw-lang"]'));
    langInputs.forEach((input) => {
      input.checked = input.value === currentLang;
    });
  } catch (err) {
    console.error("Failed to load settings:", err.message);
    currentLang = "en";
    currentTheme = getActiveTheme();
    updateLangBadge();
    applyTheme(currentTheme, false);
    updateThemeRadios();
  }
}

/* ===================== DOM EVENTS ===================== */

document.addEventListener("DOMContentLoaded", () => {
  bootstrap();
  const libraryController = initWordLibrary();

  // ----- Random word -----
  const btnWord = qs("#btn-word");
  if (btnWord) {
    btnWord.addEventListener("click", async () => {
      const msg = qs("#app-msg");
      const wordEl = qs("#word");
      show(msg, false);

      try {
        const langKey = currentLang === "de" ? "de" : "en";
        const data = await api(`${PATHS.randomWord}${langKey}`, "GET");
        wordEl.textContent = data.word || "—";
      } catch (err) {
        msg.textContent = "Error: " + err.message;
        msg.className = "msg err";
        show(msg, true);
      }
    });
  }

  // ----- Logout -----
  const btnLogout = qs("#btn-logout");
  if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
      try {
        await api(PATHS.logout, "POST", null, { useRefreshCsrf: true });
      } finally {
        window.location = "/auth";
      }
    });
  }

  // ----- Profile drawer -----
  const drawer = qs("#profile-drawer");
  const btnProfile = qs("#btn-profile");
  const btnProfileClose = qs("#btn-profile-close");
  const backdrop = qs("#profile-backdrop");
  langInputs = Array.from(document.querySelectorAll('input[name="rw-lang"]'));
  themeInputs = Array.from(document.querySelectorAll('input[name="app-theme"]'));

  function openDrawer() {
    drawer.classList.add("open");
  }
  function closeDrawer() {
    drawer.classList.remove("open");
  }

  if (btnProfile) btnProfile.addEventListener("click", openDrawer);
  if (btnProfileClose) btnProfileClose.addEventListener("click", closeDrawer);
  if (backdrop) backdrop.addEventListener("click", closeDrawer);

  // language changes -> send to backend
  langInputs.forEach((input) => {
    input.addEventListener("change", async () => {
      if (!input.checked) return;
      const newLang = input.value; // "en" or "de"
      try {
        const data = await api(PATHS.settings, "PUT", {
          random_word_lang: newLang,
          theme: currentTheme,
        });
        currentLang = data.random_word_lang;
        currentTheme = data.theme || currentTheme;
        updateLangBadge();
        applyTheme(currentTheme);
        updateThemeRadios();
        if (libraryController?.reload) {
          libraryController.reload(true);
        }
      } catch (err) {
        console.error("Failed to update settings:", err.message);
        // revert UI selection
        input.checked = false;
        const prev = [...langInputs].find((i) => i.value === currentLang);
        if (prev) prev.checked = true;
      }
    });
  });

  themeInputs.forEach((input) => {
    input.addEventListener("change", async () => {
      if (!input.checked) return;
      const newTheme = input.value;
      try {
        const data = await api(PATHS.settings, "PUT", {
          random_word_lang: currentLang,
          theme: newTheme,
        });
        currentLang = data.random_word_lang || currentLang;
        currentTheme = data.theme || newTheme;
        applyTheme(currentTheme);
        updateThemeRadios();
        if (libraryController?.reload) {
          libraryController.reload(false);
        }
      } catch (err) {
        console.error("Failed to update theme:", err.message);
        updateThemeRadios();
      }
    });
  });

  updateThemeRadios();

  // ----- Translate -----
  const btnTranslate = qs("#btn-trans");

  function showTranslation(text) {
    const box = qs("#translation-box");
    if (!box) return;
    const safe = escapeHtml(text || "—");

    box.innerHTML = `
      <b>Translation:</b> <code>${safe}</code>`;

    box.classList.add("show");
  }

  if (btnTranslate) {
    btnTranslate.addEventListener("click", async () => {
      const word = qs("#word").innerText.trim();
      if (!word || word === "—") return;

      const translationBox = qs("#translation-box");
      if (translationBox) {
        translationBox.innerHTML = "<b>Translation:</b> <em>Translating…</em>";
        translationBox.classList.add("show");
      }

      let source, target;

      if (currentLang === "en") {
        source = "en";
        target = "de";
      } else if (currentLang === "de") {
        source = "de";
        target = "en";
      }

      try {
        const data = await api("/translate", "POST", {
          q: word,
          source,
          target
        });

        console.log("Translate response:", data);
        showTranslation(data.translatedText);

      } catch (err) {
        console.error("Translate error:", err);
        if (translationBox) {
          translationBox.innerHTML = `<b>Translation:</b> <code>Error: ${escapeHtml(err.message || "Unknown error")}</code>`;
          translationBox.classList.add("show");
        }
      }
    });
  }

  const btnAddDeck = qs("#btn-add-deck");
  if (btnAddDeck) {
    btnAddDeck.addEventListener("click", async () => {
      console.log("add pressed")
    });
  }
  
  const ratingWrapper = qs(".rating-btns");
  if (ratingWrapper) {
    const ratingButtons = ratingWrapper.querySelectorAll("button.rate");
    ratingWrapper.addEventListener("click", async (e) => {
      const btn = e.target.closest("button.rate");
      if (!btn) return;

      const word = qs("#word")?.textContent?.trim();
      if (!word || word === "Word" || word === "—") {
        return;
      }

      const rate = btn.dataset.rate;
      const msg = qs("#app-msg");
      show(msg, false);

      try {
        ratingButtons.forEach((b) => (b.disabled = true));
        await api(PATHS.wordRating, "POST", {
          word,
          status: rate,
          word_lang: currentLang,
        });
        if (msg) {
          msg.textContent = `Saved as ${rate.toUpperCase()}`;
          msg.className = "msg ok";
          show(msg, true);
          console.log("good")
        }
      } catch (err) {
        if (msg) {
          msg.textContent = err.message || "Failed to save rating";
          msg.className = "msg err";
          show(msg, true);
        }
      } finally {
        ratingButtons.forEach((b) => (b.disabled = false));
      }
    });
  }

});
