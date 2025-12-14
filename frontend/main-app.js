import { api, apiFetch, qs, show, PATHS } from "./api.js";
import { applyTheme, getActiveTheme } from "./theme.js";

let currentLang = "en";
let currentTheme = getActiveTheme();
let themeInputs = [];
let langInputs = [];
let sessionWords = 0;
const SESSION_WORD_LIMIT = 10;

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

function updateSessionBadge() {
  const badge = qs("#session-words");
  const chip = qs("#session-chip");
  const congrats = qs("#session-congrats");
  if (!badge) return;
  const normalized = Number.isFinite(sessionWords) ? sessionWords : 0;
  const capped = Math.min(Math.max(normalized, 0), SESSION_WORD_LIMIT);
  badge.textContent = `${capped}/${SESSION_WORD_LIMIT}`;
  const isComplete = capped >= SESSION_WORD_LIMIT;
  if (chip) {
    chip.classList.toggle("session-complete", isComplete);
  }
  if (congrats) {
    if (isComplete) {
      congrats.textContent = "Session complete! Awesome streak 🚀";
      congrats.hidden = false;
    } else {
      congrats.hidden = true;
    }
  }
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

const CARD_DIFFICULTY_META = {
  easy: { label: "Confident", className: "easy" },
  medium: { label: "Learning", className: "medium" },
  hard: { label: "Needs review", className: "hard" },
  unrated: { label: "New", className: "unrated" },
};

async function refreshFlashcardStats() {
  const dueEl = qs("[data-due-cards-value]");
  const totalEl = qs("[data-total-cards-value]");
  if (!dueEl && !totalEl) return;
  try {
    const data = await api(PATHS.flashcardStats, "GET");
    if (dueEl) {
      const due = Number(data?.due_cards);
      const normalized = Number.isFinite(due) && due >= 0 ? due : 0;
      dueEl.textContent = `${normalized} cards`;
    }
    if (totalEl) {
      const total = Number(data?.total_cards);
      totalEl.textContent = Number.isFinite(total) && total >= 0 ? total : 0;
    }
  } catch (err) {
    console.error("Failed to refresh flashcard stats:", err);
  }
}

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
  const numericId = Number(item.id);
  return {
    id: Number.isFinite(numericId) ? numericId : null,
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

function initWordChainGame() {
  const startBtn = qs("[data-wordchain-start]");
  const panel = qs("[data-wordchain-panel]");
  if (!startBtn || !panel) return null;

  const form = panel.querySelector("[data-wordchain-form]");
  const input = panel.querySelector("[data-wordchain-input]");
  const submitBtn = panel.querySelector("[data-wordchain-submit]");
  const hint = panel.querySelector("[data-wordchain-hint]");
  const log = panel.querySelector("[data-wordchain-log]");
  const placeholder = panel.querySelector("[data-wordchain-empty]");
  const nextWrap = panel.querySelector("[data-wordchain-next]");
  const letterEl = panel.querySelector("[data-wordchain-letter]");
  const timerWrap = panel.querySelector("[data-wordchain-timer]");
  const timerValue = panel.querySelector("[data-wordchain-timer-value]");
  const timerProgress = panel.querySelector("[data-wordchain-timer-progress]");
  const wordCountDisplay = document.querySelector("[data-wordchain-count]");

  let requiredLetter = null;
  let busy = false;
  let active = false;
  let waitingForBot = false;
  let timeLeft = 15;
  let timerId = null;
  const TURN_TIME_SECONDS = 15;
  let wordCount = 0;

  const setHint = (message, tone = "info") => {
    if (!hint) return;
    hint.textContent = message;
    hint.classList.remove("is-error", "is-success");
    if (tone === "error") {
      hint.classList.add("is-error");
    } else if (tone === "success") {
      hint.classList.add("is-success");
    }
  };

  const togglePlaceholder = (visible) => {
    if (!placeholder || !log) return;
    if (visible) {
      placeholder.hidden = false;
      if (!placeholder.parentElement) {
        log.appendChild(placeholder);
      }
    } else {
      placeholder.hidden = true;
      if (placeholder.parentElement) {
        placeholder.remove();
      }
    }
  };

  const appendLogEntry = (author, word, role) => {
    if (!log) return;
    togglePlaceholder(false);
    const item = document.createElement("li");
    item.className = `wordchain-log-item wordchain-log-${role}`;
    item.innerHTML = `
      <span class="wordchain-log-meta">${escapeHtml(author)}</span>
      <span class="wordchain-log-word">${escapeHtml(word)}</span>
    `;
    log.insertBefore(item, log.firstElementChild);
    while (log.children.length > 16) {
      const last = log.lastElementChild;
      if (!last || last === placeholder) break;
      log.removeChild(last);
    }
  };

  const updateWordCount = () => {
    if (!wordCountDisplay) return;
    wordCountDisplay.textContent = wordCount.toString();
  };

  const setTimerVisible = (visible) => {
    if (!timerWrap) return;
    timerWrap.hidden = !visible;
    if (!visible) {
      timerWrap.classList.remove("danger");
    }
  };

  const updateTimerUI = () => {
    if (!timerValue || !timerProgress) return;
    const normalized = Math.max(0, Math.min(TURN_TIME_SECONDS, timeLeft));
    timerValue.textContent = `${normalized}s`;
    const percent = (normalized / TURN_TIME_SECONDS) * 100;
    timerProgress.style.width = `${percent}%`;
    timerWrap?.classList.toggle("danger", normalized <= 5);
  };

  const stopTurnTimer = () => {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  };

  const handleTimeExpired = () => {
    finishMatch("Time's up! Restart the duel to try again.", "error");
  };

  const startTurnTimer = () => {
    if (!active || !timerWrap) return;
    setTimerVisible(true);
    stopTurnTimer();
    timeLeft = TURN_TIME_SECONDS;
    updateTimerUI();
    timerId = window.setInterval(() => {
      timeLeft -= 1;
      if (timeLeft <= 0) {
        timeLeft = 0;
        updateTimerUI();
        stopTurnTimer();
        handleTimeExpired();
      } else {
        updateTimerUI();
      }
    }, 1000);
  };

  const setRequiredLetter = (letter) => {
    requiredLetter = letter ? letter.toLowerCase() : null;
    if (!nextWrap) return;
    if (!requiredLetter) {
      nextWrap.hidden = true;
      if (letterEl) letterEl.textContent = "—";
      return;
    }
    nextWrap.hidden = false;
    if (letterEl) letterEl.textContent = requiredLetter.toUpperCase();
  };

  const applyFormState = () => {
    const disabled = !active || busy;
    if (form) {
      form.classList.toggle("is-disabled", !active);
      form.classList.toggle("is-busy", busy);
    }
    if (input) input.disabled = disabled;
    if (submitBtn) submitBtn.disabled = disabled;
  };

  const resetMatch = () => {
    active = true;
    busy = false;
    waitingForBot = false;
    wordCount = 0;
    updateWordCount();
    setHint("Type any starting word to begin the chain.");
    setRequiredLetter(null);
    if (log) {
      log.innerHTML = "";
    }
    togglePlaceholder(true);
    if (input) {
      input.value = "";
    }
    setTimerVisible(true);
    startTurnTimer();
    applyFormState();
  };

  const finishMatch = (message, tone = "success") => {
    active = false;
    busy = false;
    waitingForBot = false;
    stopTurnTimer();
    setTimerVisible(false);
    setHint(message, tone);
    setRequiredLetter(null);
    applyFormState();
  };

  const ensurePanelVisible = () => {
    panel.hidden = false;
    panel.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const clearUserHistory = async () => {
    try {
      await api(PATHS.wordChainClear, "DELETE");
    } catch (err) {
      console.error("Failed to clear word chain history:", err);
    }
  };

  startBtn.addEventListener("click", () => {
    ensurePanelVisible();
    clearUserHistory()
      .finally(() => {
        resetMatch();
        if (input) {
          input.focus();
        }
      });
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!active || busy) return;
    const value = (input?.value || "").trim();
    if (!value) {
      setHint("Enter a word before sending.", "error");
      return;
    }
    const normalized = value.toLowerCase();
    if (normalized.length < 2) {
      setHint("Use at least two letters.", "error");
      return;
    }
    if (requiredLetter && normalized[0] !== requiredLetter) {
      setHint(`Word must start with “${requiredLetter.toUpperCase()}”.`, "error");
      return;
    }
    busy = true;
    applyFormState();
    setHint("Checking word…");
    try {
      const addResponse = await api(PATHS.wordChainAdd(normalized), "GET");
      if (addResponse && addResponse.status === "False") {
        throw new Error(addResponse.comment || "Word rejected.");
      }
      appendLogEntry("You", normalized, "player");
      wordCount += 1;
      updateWordCount();
      setRequiredLetter(normalized.charAt(normalized.length - 1));
      if (input) {
        input.value = "";
      }
      waitingForBot = true;
      stopTurnTimer();
      setHint("Bot is thinking…");
      const botReply = await api(PATHS.wordChainBot, "POST", { word: normalized });
      if (!botReply || !botReply.word) {
        waitingForBot = false;
        finishMatch("Bot surrendered. Streak is yours!");
        return;
      }
      const botWord = botReply.word.toString();
      appendLogEntry("Bot", botWord, "bot");
      const lastChar = botWord.charAt(botWord.length - 1).toLowerCase();
      setRequiredLetter(lastChar);
      setHint("Your turn — follow the highlighted letter.");
      waitingForBot = false;
      startTurnTimer();
    } catch (err) {
      console.error("Word chain move failed:", err);
      setHint(err.message || "Unable to play this word.", "error");
      if (waitingForBot) {
        waitingForBot = false;
        startTurnTimer();
      }
    } finally {
      busy = false;
      applyFormState();
      if (active && input) {
        input.focus();
      }
    }
  });

  return {
    reset: resetMatch,
  };
}

function createEditableField({
  value = "",
  placeholder = "",
  field,
  word = "",
  wordId = null,
  maxLength,
}) {
  const safeValue = value ? escapeHtml(value) : "";
  const safePlaceholder = escapeHtml(placeholder);
  const safeWord = escapeHtml(word);
  const maxAttr = Number.isFinite(maxLength) ? `data-maxlength="${maxLength}"` : "";
  const idAttr = Number.isFinite(wordId) ? `data-word-id="${wordId}"` : "";

  return `<div class="word-input" contenteditable="true" data-field="${field}" ${maxAttr} ${idAttr} data-word="${safeWord}" data-placeholder="${safePlaceholder}">${safeValue}</div>`;
}

function renderWordRow(item) {
  const safeWord = escapeHtml(item.word || "—");
  const badge = item.rating && BADGE_META[item.rating] ? BADGE_META[item.rating] : null;
  const badgeMarkup = badge
    ? `<span class="word-badge ${badge.className}">${badge.label}</span>`
    : "—";
  const translationField = createEditableField({
    value: item.translation || "",
    placeholder: "Add definition",
    field: "translation",
    word: item.word || "",
    wordId: item.id,
    maxLength: 50,
  });
  const commentField = createEditableField({
    value: item.comment || "",
    placeholder: "Add comment",
    field: "comment",
    word: item.word || "",
    wordId: item.id,
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

function renderFlashcardWordCard(item = {}) {
  const word = escapeHtml(item.word || "—");
  const definition = escapeHtml(item.definition || "No definition yet.");
  const example = item.example ? `<p class="word-card-example">${escapeHtml(item.example)}</p>` : "";
  const difficultyKey = String(item.difficulty || "").toLowerCase();
  const difficultyMeta = CARD_DIFFICULTY_META[difficultyKey] || CARD_DIFFICULTY_META.unrated;
  const difficultyBadge = `<span class="word-card-rating ${difficultyMeta.className}">${difficultyMeta.label}</span>`;
  const difficultyAttr = escapeHtml(item.difficulty || "");
  return `
    <li class="word-card" data-word-id="${item.id}" data-deck-id="${item.deck_id}" data-difficulty="${difficultyAttr}">
      <div class="word-card-head">
        <div>
          <h3 class="word-card-title">${word}</h3>
          <p class="word-card-definition">${definition}</p>
        </div>
        <div class="word-card-actions">
          ${difficultyBadge}
          <button class="icon-btn ghost word-card-action-btn word-card-edit" type="button" title="Edit card" aria-label="Edit card">
            <i class="bi bi-pencil-square" aria-hidden="true"></i>
          </button>
          <button class="icon-btn danger ghost word-card-action-btn word-card-delete" type="button" title="Remove card" aria-label="Remove card">
            <i class="bi bi-trash-fill" aria-hidden="true"></i>
          </button>
        </div>
      </div>
      ${example}
    </li>
  `;
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
  const saveBtn = qs("#btn-save-library");
  let currentSnapshot = DEFAULT_SNAPSHOT;
  let activeFilter = "recent";
  const notifyLibraryMessage = (message, status = "err") => {
    if (!message) return;
    const msg = qs("#app-msg");
    if (!msg) return;
    msg.textContent = message;
    msg.className = status === "ok" ? "msg ok" : "msg err";
    show(msg, true);
  };
  const notifyLibraryError = (message) => notifyLibraryMessage(message, "err");
  const notifyLibrarySuccess = (message) => notifyLibraryMessage(message, "ok");
  const syncEditableState = () => {
    tableBody.querySelectorAll(".word-input").forEach((el) => {
      el.dataset.savedValue = (el.textContent || "").trim();
    });
  };

  const persistEditableField = async (element) => {
    if (!element) return false;
    const wordId = Number(element.dataset.wordId);
    if (!Number.isFinite(wordId)) return false;
    const field = element.dataset.field;
    const value = (element.textContent || "").trim();
    const payload = {};

    if (field === "translation") {
      payload.translate = value || null;
    } else if (field === "comment") {
      payload.comment = value || null;
    } else {
      return;
    }

    element.dataset.saving = "true";
    try {
      await api(PATHS.wordLibraryEntry(wordId), "PUT", payload);
      element.dataset.savedValue = value;
      const snapshotField = field === "translation" ? "translation" : "comment";
      updateSnapshotField(wordId, snapshotField, value);
      return true;
    } catch (err) {
      console.error("Failed to save word field:", err);
      const revertValue = element.dataset.savedValue || "";
      element.textContent = revertValue;
      notifyLibraryError(err.message || "Failed to save changes");
      return false;
    } finally {
      delete element.dataset.saving;
    }
  };
  const collectDirtyFields = () =>
    Array.from(tableBody.querySelectorAll(".word-input")).filter((el) => {
      const savedValue = el.dataset.savedValue || "";
      const currentValue = (el.textContent || "").trim();
      return currentValue !== savedValue;
    });
  const getSnapshotLists = () => {
    const buckets = currentSnapshot?.buckets || {};
    return [
      currentSnapshot?.recent,
      buckets.high,
      buckets.medium,
      buckets.low,
    ].filter((list) => Array.isArray(list));
  };
  const updateSnapshotField = (wordId, fieldKey, value) => {
    if (!Number.isFinite(wordId) || !fieldKey) return;
    getSnapshotLists().forEach((list) => {
      list.forEach((entry) => {
        if (entry.id === wordId) {
          entry[fieldKey] = value;
        }
      });
    });
  };

  const applyFilter = (filterKey = "recent") => {
    const config = LIBRARY_FILTERS[filterKey] || LIBRARY_FILTERS.recent;
    activeFilter = filterKey in LIBRARY_FILTERS ? filterKey : "recent";

    menu.querySelectorAll("[data-library-filter]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.libraryFilter === activeFilter);
    });

    const items = config.getItems(currentSnapshot);
    renderWordTable(tableBody, items, config.fallback);
    syncEditableState();
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

  if (saveBtn) {
    const defaultSaveLabel = saveBtn.textContent || "Save data";
    saveBtn.addEventListener("click", async () => {
      const dirtyFields = collectDirtyFields();
      if (!dirtyFields.length) {
        notifyLibrarySuccess("Nothing to save");
        return;
      }
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving…";
      try {
        let successCount = 0;
        for (const field of dirtyFields) {
          // eslint-disable-next-line no-await-in-loop
          const saved = await persistEditableField(field);
          if (saved) successCount += 1;
        }
        if (successCount) {
          notifyLibrarySuccess(`Saved ${successCount} change${successCount === 1 ? "" : "s"}`);
        }
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = defaultSaveLabel;
      }
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

  tableBody.addEventListener("keydown", (e) => {
    const target = e.target.closest(".word-input");
    if (!target) return;
    if (e.key === "Enter") {
      e.preventDefault();
      target.blur();
    }
  });

  tableBody.addEventListener("focusout", (e) => {
    const target = e.target.closest(".word-input");
    if (!target) return;
    const savedValue = target.dataset.savedValue || "";
    const currentValue = (target.textContent || "").trim();
    if (currentValue === savedValue) return;
    persistEditableField(target);
  });

  return {
    reload(withPlaceholder = true) {
      loadSnapshot(withPlaceholder);
    },
  };
}

function initWordModal(options = {}) {
  const modal = qs("#word-create-modal");
  if (!modal) return null;

  const form = modal.querySelector("#word-create-form");
  const hint = modal.querySelector("[data-word-modal-hint]");
  const deckLabel = modal.querySelector("[data-word-modal-deck]");
  const headerLabel = modal.querySelector(".deck-modal-head .panel-label");
  const titlePrefix = modal.querySelector("[data-word-modal-title-text]");
  const submitBtn = form?.querySelector('button[type="submit"]');
  const wordInput = form?.querySelector('input[name="word"]');
  const definitionInput = form?.querySelector('textarea[name="definition"]');
  const exampleInput = form?.querySelector('textarea[name="example"]');
  const defaultHint = hint ? hint.textContent : "";
  const defaultHeaderText = headerLabel ? headerLabel.textContent : "New card";
  const defaultTitlePrefix = titlePrefix ? titlePrefix.textContent : "Add to";
  const defaultSubmitText = submitBtn ? submitBtn.textContent : "Save card";
  const editHeaderText = "Edit card";
  const editTitlePrefix = "Edit in";
  const editSubmitText = "Save changes";
  const { onSaved } = options;
  let currentDeck = null;
  let mode = "create";
  let editingWordId = null;

  const setHint = (text, status) => {
    if (!hint) return;
    hint.textContent = text;
    hint.classList.remove("success", "error");
    if (status === "success" || status === "error") {
      hint.classList.add(status);
    }
  };

  const handleEsc = (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    closeModal();
  };

  const applyMode = () => {
    const editing = mode === "edit";
    if (headerLabel) {
      headerLabel.textContent = editing ? editHeaderText : defaultHeaderText;
    }
    if (titlePrefix) {
      titlePrefix.textContent = editing ? editTitlePrefix : defaultTitlePrefix;
    }
    if (submitBtn) {
      submitBtn.textContent = editing ? editSubmitText : defaultSubmitText;
    }
  };

  function openModal(deck, word = null) {
    if (!deck) return;
    mode = word ? "edit" : "create";
    editingWordId = word?.id ?? null;
    currentDeck = deck;
    applyMode();
    if (deckLabel) {
      deckLabel.textContent = deck.title || "deck";
    }
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.addEventListener("keydown", handleEsc);
    setHint(defaultHint);
    if (form) {
      form.reset();
      if (word) {
        if (wordInput) wordInput.value = word.word || "";
        if (definitionInput) definitionInput.value = word.definition || "";
        if (exampleInput) exampleInput.value = word.example || "";
      }
    }
    setTimeout(() => {
      const firstField = form?.querySelector("input, textarea");
      firstField?.focus();
    }, 15);
  }

  function closeModal() {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.removeEventListener("keydown", handleEsc);
    currentDeck = null;
    mode = "create";
    editingWordId = null;
    applyMode();
    if (form) {
      form.reset();
    }
    if (hint) {
      hint.classList.remove("success", "error");
      hint.textContent = defaultHint;
    }
  }

  modal.addEventListener("click", (event) => {
    const closer = event.target.closest("[data-modal-close]");
    if (!closer) return;
    event.preventDefault();
    closeModal();
  });

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!currentDeck) {
      setHint("Pick a deck first.", "error");
      return;
    }
    const data = new FormData(form);
    const payload = {
      word: (data.get("word") || "").toString().trim(),
      definition: (data.get("definition") || "").toString().trim(),
      example: (data.get("example") || "").toString().trim(),
    };
    if (!payload.word || !payload.definition) {
      setHint("Word and definition are required.", "error");
      return;
    }
    if (!payload.example) {
      payload.example = null;
    }

    const submitText = submitBtn ? submitBtn.textContent : "";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = mode === "edit" ? "Updating…" : "Saving…";
    }
    const isEdit = mode === "edit" && Number.isFinite(editingWordId);
    const endpoint = isEdit
      ? PATHS.flashcardDeckWord(currentDeck.id, editingWordId)
      : PATHS.flashcardDeckWords(currentDeck.id);
    const method = isEdit ? "PUT" : "POST";
    setHint(isEdit ? "Updating card…" : "Saving card…");

    api(endpoint, method, payload)
      .then((entity) => {
        const actionLabel = isEdit ? "Updated" : "Added";
        setHint(`${actionLabel} “${entity.word}”`, "success");
        if (typeof onSaved === "function") {
          onSaved(entity, currentDeck, { mode: isEdit ? "edit" : "create" });
        }
        if (!isEdit) {
          form.reset();
        }
        setTimeout(() => {
          closeModal();
        }, 500);
      })
      .catch((err) => {
        console.error("Failed to save flashcard:", err);
        setHint(err.message || "Unable to save card", "error");
      })
      .finally(() => {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = submitText || (mode === "edit" ? editSubmitText : defaultSubmitText);
        }
      });
  });

  return {
    open(deck, word = null) {
      openModal(deck, word);
    },
    close: closeModal,
  };
}

function initRandomAddModal() {
  const modal = qs("#random-add-modal");
  if (!modal) return null;

  const form = modal.querySelector("#random-add-form");
  const hint = modal.querySelector("[data-random-add-hint]");
  const deckSelect = modal.querySelector("[data-random-deck-select]");
  const wordInput = modal.querySelector("[data-random-word-input]");
  const definitionInput = form?.querySelector('textarea[name="definition"]');
  const submitBtn = form?.querySelector('button[type="submit"]');
  const defaultHint = hint ? hint.textContent : "Pick a deck to store this word.";
  let decks = [];
  let isLoading = false;

  const setHint = (text, status) => {
    if (!hint) return;
    hint.textContent = text;
    hint.classList.remove("success", "error");
    if (status === "success" || status === "error") {
      hint.classList.add(status);
    }
  };

  const populateSelect = () => {
    if (!deckSelect) return;
    const options = ["<option value=\"\">Select a deck</option>"];
    decks.forEach((deck) => {
      options.push(`<option value="${deck.id}">${escapeHtml(deck.title)}</option>`);
    });
    deckSelect.innerHTML = options.join("");
  };

  const applyAvailability = () => {
    const hasDecks = decks.length > 0;
    if (deckSelect) deckSelect.disabled = !hasDecks;
    if (submitBtn) submitBtn.disabled = !hasDecks;
    setHint(hasDecks ? defaultHint : "Create a deck first to save words.", hasDecks ? null : "error");
  };

  const handleEsc = (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    closeModal();
  };

  const closeModal = () => {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.removeEventListener("keydown", handleEsc);
    form?.reset();
    if (submitBtn && decks.length > 0) {
      submitBtn.disabled = false;
    }
    applyAvailability();
  };

  const openModal = (prefilledWord = "") => {
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.addEventListener("keydown", handleEsc);
    form?.reset();
    if (wordInput) {
      wordInput.value = prefilledWord || "";
      requestAnimationFrame(() => {
        wordInput?.setSelectionRange(wordInput.value.length, wordInput.value.length);
      });
    }
    if (definitionInput) {
      setTimeout(() => definitionInput.focus(), 40);
    }
    applyAvailability();
    if (!decks.length) {
      loadDecks();
    }
  };

  const loadDecks = async () => {
    if (isLoading) return;
    isLoading = true;
    setHint("Loading decks…");
    if (deckSelect) deckSelect.disabled = true;
    if (submitBtn) submitBtn.disabled = true;
    try {
      const data = await api(PATHS.flashcardDecks, "GET");
      decks = Array.isArray(data) ? data : [];
      populateSelect();
      setHint(decks.length ? defaultHint : "Create a deck first to save words.", decks.length ? null : "error");
    } catch (err) {
      console.error("Failed to load decks:", err);
      setHint(err.message || "Unable to load decks", "error");
    } finally {
      isLoading = false;
      if (deckSelect) deckSelect.disabled = decks.length === 0;
      if (submitBtn) submitBtn.disabled = decks.length === 0;
    }
  };

  modal.addEventListener("click", (event) => {
    const closer = event.target.closest("[data-modal-close]");
    if (!closer) return;
    event.preventDefault();
    closeModal();
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!deckSelect || !deckSelect.value) {
      setHint("Select a deck first.", "error");
      return;
    }
    const formData = new FormData(form);
    const payload = {
      word: (formData.get("word") || "").toString().trim(),
      definition: (formData.get("definition") || "").toString().trim(),
      example: (formData.get("example") || "").toString().trim() || null,
    };
    if (!payload.word || !payload.definition) {
      setHint("Word and definition are required.", "error");
      return;
    }
    const selectedId = Number(deckSelect.value);
    if (!Number.isFinite(selectedId)) {
      setHint("Invalid deck selected.", "error");
      return;
    }
    const submitText = submitBtn ? submitBtn.textContent : "";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Saving…";
    }
    setHint("Saving card…");

    try {
      const saved = await api(PATHS.flashcardDeckWords(selectedId), "POST", payload);
      setHint(`Added “${saved.word}” to deck.`, "success");
      form?.reset();
      if (wordInput) {
        wordInput.value = payload.word;
      }
      setTimeout(() => closeModal(), 700);
    } catch (err) {
      console.error("Failed to save word:", err);
      setHint(err.message || "Unable to save card", "error");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = decks.length === 0;
        submitBtn.textContent = submitText || "Save card";
      }
    }
  });

  return {
    openWord(wordText = "") {
      openModal(wordText);
    },
  };
}

function initDeleteModal(options = {}) {
  const modal = qs("#word-delete-modal");
  if (!modal) return null;

  const labelEl = modal.querySelector("[data-word-delete-label]");
  const titleEl = modal.querySelector("[data-word-delete-title]");
  const confirmBtn = modal.querySelector("#btn-confirm-delete");
  const { onConfirm } = options;
  const defaultConfirmText = confirmBtn ? confirmBtn.textContent : "";
  let current = null;

  const setLabel = (word) => {
    const formatted = word ? `“${word}”` : "this card";
    if (labelEl) labelEl.textContent = formatted;
    if (titleEl) titleEl.textContent = word ? `Delete ${word}` : "Delete card";
  };

  const handleEsc = (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    closeModal();
  };

  function openModal(payload) {
    current = payload || null;
    setLabel(payload?.word || "");
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.addEventListener("keydown", handleEsc);
  }

  function closeModal() {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.removeEventListener("keydown", handleEsc);
    current = null;
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = defaultConfirmText || "Delete";
    }
  }

  modal.addEventListener("click", (event) => {
    const closer = event.target.closest("[data-modal-close]");
    if (!closer) return;
    event.preventDefault();
    closeModal();
  });

  confirmBtn?.addEventListener("click", async () => {
    if (!current || typeof onConfirm !== "function") {
      closeModal();
      return;
    }
    confirmBtn.disabled = true;
    confirmBtn.textContent = "Deleting…";
    try {
      await onConfirm(current);
      closeModal();
    } catch (err) {
      console.error("Failed to delete card:", err);
      confirmBtn.disabled = false;
      confirmBtn.textContent = defaultConfirmText || "Delete";
      alert(err.message || "Failed to delete card");
    }
  });

  return {
    open: openModal,
    close: closeModal,
  };
}

function initDeckDeleteModal(options = {}) {
  const modal = qs("#deck-delete-modal");
  if (!modal) return null;

  const labelEl = modal.querySelector("[data-deck-delete-label]");
  const titleEl = modal.querySelector("#deck-delete-title");
  const confirmBtn = modal.querySelector("#btn-confirm-deck-delete");
  const { onConfirm } = options;
  const defaultConfirmText = confirmBtn ? confirmBtn.textContent : "";
  let current = null;

  const setLabel = (title) => {
    const formatted = title ? `“${title}”` : "this deck";
    if (labelEl) labelEl.textContent = formatted;
    if (titleEl) titleEl.textContent = title ? `Delete ${title}` : "Delete deck";
  };

  const handleEsc = (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    closeModal();
  };

  function openModal(payload) {
    current = payload || null;
    setLabel(payload?.title || "");
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.addEventListener("keydown", handleEsc);
  }

  function closeModal() {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.removeEventListener("keydown", handleEsc);
    current = null;
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = defaultConfirmText || "Delete deck";
    }
  }

  modal.addEventListener("click", (event) => {
    const closer = event.target.closest("[data-modal-close]");
    if (!closer) return;
    event.preventDefault();
    closeModal();
  });

  confirmBtn?.addEventListener("click", async () => {
    if (!current || typeof onConfirm !== "function") {
      closeModal();
      return;
    }
    confirmBtn.disabled = true;
    confirmBtn.textContent = "Deleting…";
    try {
      await onConfirm(current);
      closeModal();
    } catch (err) {
      console.error("Failed to delete deck:", err);
      confirmBtn.disabled = false;
      confirmBtn.textContent = defaultConfirmText || "Delete deck";
      alert(err.message || "Failed to delete deck");
    }
  });

  return {
    open: openModal,
    close: closeModal,
  };
}

function initStudyModal(options = {}) {
  const modal = qs("#study-modal");
  if (!modal) return null;

  const { onDifficultySaved, onSessionComplete } = options || {};
  const cardEl = modal.querySelector("[data-study-card]");
  const wordEl = modal.querySelector("[data-study-word]");
  const definitionEl = modal.querySelector("[data-study-definition]");
  const exampleWrap = modal.querySelector("[data-study-example-wrap]");
  const exampleEl = modal.querySelector("[data-study-example]");
  const flipBtn = modal.querySelector("#btn-study-flip");
  const knownBtn = modal.querySelector("#btn-study-known");
  const unknownBtn = modal.querySelector("#btn-study-unknown");
  const progressEl = modal.querySelector("[data-study-progress]");
  const emptyEl = modal.querySelector("[data-study-empty]");
  const summaryEl = modal.querySelector("[data-study-summary]");
  const actionsEl = modal.querySelector("[data-study-actions]");
  const deckLabelEl = modal.querySelector("[data-study-deck]");
  const defaultFlipText = flipBtn ? flipBtn.textContent : "Flip card";
  const RESULT_TO_DIFFICULTY = {
    known: "easy",
    unknown: "hard",
  };

  let deckTitle = "";
  let deckId = null;
  let cards = [];
  let index = 0;
  let flipped = false;
  let stats = { known: 0, unknown: 0 };
  let animating = false;
  let sessionFinished = false;

  const handleEsc = (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    closeModal();
  };

  const setFlipped = (value) => {
    flipped = Boolean(value);
    if (cardEl) {
      cardEl.classList.toggle("flipped", flipped);
    }
    if (flipBtn) {
      flipBtn.textContent = flipped ? "Show word" : defaultFlipText || "Flip card";
    }
  };

  const maybeNotifyCompletion = () => {
    if (sessionFinished) return;
    sessionFinished = true;
    if (typeof onSessionComplete === "function") {
      try {
        onSessionComplete({ deckId, stats: { ...stats } });
      } catch (err) {
        console.error("onSessionComplete handler failed:", err);
      }
    }
  };

  const renderState = () => {
    const hasCards = cards.length > 0;
    const finished = hasCards && index >= cards.length;
    const current = hasCards && !finished ? cards[index] : null;
    if (deckLabelEl) {
      deckLabelEl.textContent = deckTitle || "deck";
    }

    if (progressEl) {
      if (!hasCards) {
        progressEl.textContent = "No cards to review.";
      } else if (finished) {
        progressEl.textContent = "Session complete";
      } else {
        progressEl.textContent = `Card ${index + 1} of ${cards.length}`;
      }
    }

    if (emptyEl) emptyEl.hidden = hasCards;

    if (!hasCards) {
      if (cardEl) cardEl.hidden = true;
      if (actionsEl) actionsEl.hidden = true;
      if (flipBtn) flipBtn.hidden = true;
      if (summaryEl) summaryEl.hidden = true;
      return;
    }

    if (summaryEl) summaryEl.hidden = !finished;
    if (finished) {
      maybeNotifyCompletion();
      if (cardEl) cardEl.hidden = true;
      if (actionsEl) actionsEl.hidden = true;
      if (flipBtn) flipBtn.hidden = true;
      if (summaryEl) {
        summaryEl.innerHTML = `Session complete. <strong>${stats.known}</strong> knew it, <strong>${stats.unknown}</strong> to review.`;
      }
      return;
    }

    if (cardEl) {
      cardEl.hidden = false;
      cardEl.classList.remove("swipe-left", "swipe-right");
    }
    if (actionsEl) actionsEl.hidden = false;
    if (flipBtn) flipBtn.hidden = false;
    setFlipped(false);

    if (wordEl) wordEl.textContent = current?.word || "—";
    if (definitionEl) definitionEl.textContent = current?.definition || "—";

    if (exampleWrap) {
      const hasExample = Boolean(current?.example);
      exampleWrap.hidden = !hasExample;
      if (hasExample && exampleEl) {
        exampleEl.textContent = current.example;
      }
    }
  };

  const closeModal = () => {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.removeEventListener("keydown", handleEsc);
    cards = [];
    index = 0;
    stats = { known: 0, unknown: 0 };
    animating = false;
    deckId = null;
    sessionFinished = false;
    setFlipped(false);
  };

  const openModal = () => {
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.addEventListener("keydown", handleEsc);
  };

  modal.addEventListener("click", (event) => {
    const closer = event.target.closest("[data-modal-close]");
    if (!closer) return;
    event.preventDefault();
    closeModal();
  });

  flipBtn?.addEventListener("click", () => {
    if (!cards.length || index >= cards.length) return;
    setFlipped(!flipped);
  });

  const persistDifficulty = async (card, difficulty) => {
    if (!card || !difficulty) return;
    const targetDeckId = Number(card.deck_id ?? deckId);
    const wordId = Number(card.id);
    if (!Number.isFinite(targetDeckId) || !Number.isFinite(wordId)) return;
    try {
      const updated = await api(
        PATHS.flashcardWordDifficulty(targetDeckId, wordId),
        "PATCH",
        { difficulty }
      );
      if (typeof onDifficultySaved === "function") {
        onDifficultySaved(updated);
      }
    } catch (err) {
      console.error("Failed to save difficulty:", err);
    }
  };

  const handleResult = (type) => {
    if (!cards.length || index >= cards.length || animating) return;
    if (typeof stats[type] === "number") {
      stats[type] += 1;
    }
    const currentCard = cards[index];
    const difficultyValue = RESULT_TO_DIFFICULTY[type];
    if (currentCard && difficultyValue) {
      currentCard.difficulty = difficultyValue;
      void persistDifficulty(currentCard, difficultyValue);
    }
    if (!cardEl) {
      index += 1;
      renderState();
      return;
    }
    animating = true;
    const direction = type === "known" ? "swipe-right" : "swipe-left";
    cardEl.classList.remove("swipe-left", "swipe-right");
    void cardEl.offsetWidth;
    cardEl.classList.add(direction);
    setTimeout(() => {
      cardEl.classList.remove("swipe-left", "swipe-right");
      index += 1;
      animating = false;
      setFlipped(false);
      renderState();
    }, 220);
  };

  knownBtn?.addEventListener("click", () => handleResult("known"));
  unknownBtn?.addEventListener("click", () => handleResult("unknown"));

  return {
    startSession({ deck, cards: deckCards } = {}) {
      deckTitle = deck?.title || "deck";
      const deckIdentifier = Number(deck?.id);
      deckId = Number.isFinite(deckIdentifier) ? deckIdentifier : null;
      cards = Array.isArray(deckCards) ? [...deckCards] : [];
      index = 0;
      stats = { known: 0, unknown: 0 };
      animating = false;
      sessionFinished = false;
      setFlipped(false);
      renderState();
      openModal();
    },
  };
}

function initFlashcardWorkspace(options = {}) {
  const { onEditDeck } = options || {};
  const deckList = qs("[data-deck-list]");
  const searchInput = qs("[data-deck-search]");
  const emptyState = qs("[data-deck-empty]");
  const head = qs("[data-active-deck-head]");
  const titleEl = qs("[data-active-deck-title]");
  const metaEl = qs("[data-active-deck-meta]");
  const statsWrap = qs("[data-word-stats]");
  const countEl = qs("[data-word-count]");
  const placeholderEl = qs("[data-word-placeholder]");
  const placeholderTextEl = placeholderEl?.querySelector("[data-placeholder-text]");
  const placeholderTipEl = placeholderEl?.querySelector("[data-placeholder-tip]");
  const wordSearchInput = qs("[data-word-search]");
  const wordSearchWrap = qs("[data-card-filter]");
  const DEFAULT_PLACEHOLDER_TEXT =
    placeholderTextEl?.textContent?.trim() || "Choose a deck to start reviewing cards.";
  const DEFAULT_TIPS = [
    "Tip: five quick cards now beat a perfect session later.",
    "Hint: revisit tricky cards after a short break for better retention.",
    "Reminder: say the answer out loud—speaking builds recall.",
    "Advice: mix easy wins with tough cards to keep motivation high.",
  ];
  const formatDeckLang = (deck) => (deck?.lang === "de" ? "German" : "English");
  const wordListEl = qs("[data-word-list]");
  const studyBtn = qs("#btn-deck-study");
  const addBtn = qs("#btn-deck-add");
  const editDeckBtn = qs("#btn-deck-edit");
  const deleteDeckBtn = qs("#btn-deck-delete");
  const exportDeckBtn = qs("#btn-deck-export");

  if (!deckList || !wordListEl) return null;

  let decks = [];
  let activeDeckId = null;
  let filterTerm = "";
  let currentWords = [];
  let wordFilterTerm = "";

  const pickTip = () => DEFAULT_TIPS[Math.floor(Math.random() * DEFAULT_TIPS.length)];

  const resetWordSearch = () => {
    wordFilterTerm = "";
    if (wordSearchInput) {
      wordSearchInput.value = "";
    }
  };

  const toggleCardSearch = (visible) => {
    if (wordSearchWrap) {
      wordSearchWrap.hidden = !visible;
    }
    if (wordSearchInput) {
      wordSearchInput.disabled = !visible;
      if (!visible) {
        resetWordSearch();
      }
    }
  };

  const setPlaceholder = (text, { showTip = false } = {}) => {
    if (!placeholderEl) return;
    if (!text) {
      placeholderEl.hidden = true;
      if (wordListEl && wordListEl.children.length) {
        wordListEl.hidden = false;
      }
      if (placeholderTipEl) {
        placeholderTipEl.hidden = true;
        placeholderTipEl.textContent = "";
      }
      return;
    }
    if (placeholderTextEl) {
      placeholderTextEl.textContent = text;
    } else {
      placeholderEl.textContent = text;
    }
    placeholderEl.hidden = false;
    if (wordListEl) {
      wordListEl.hidden = true;
    }
    if (placeholderTipEl) {
      if (showTip) {
        placeholderTipEl.textContent = pickTip();
        placeholderTipEl.hidden = false;
      } else {
        placeholderTipEl.hidden = true;
        placeholderTipEl.textContent = "";
      }
    }
  };

  const updateButtons = () => {
    const enabled = Boolean(activeDeckId);
    if (addBtn) addBtn.disabled = !enabled;
    if (studyBtn) studyBtn.disabled = !enabled;
    if (editDeckBtn) editDeckBtn.disabled = !enabled;
    if (deleteDeckBtn) deleteDeckBtn.disabled = !enabled;
    if (exportDeckBtn) exportDeckBtn.disabled = !enabled;
  };

  const updateHead = (deck) => {
    if (!deck) {
      if (head) head.hidden = true;
      if (statsWrap) statsWrap.hidden = true;
      setPlaceholder(DEFAULT_PLACEHOLDER_TEXT, { showTip: true });
      toggleCardSearch(false);
      updateButtons();
      return;
    }
    if (head) head.hidden = false;
    if (titleEl) {
      titleEl.textContent = deck.title;
      titleEl.title = deck.description || deck.title;
    }
    if (metaEl) {
      const langText = formatDeckLang(deck);
      const category = deck.category ? `${deck.category} · ` : "";
      metaEl.textContent = `${category}${langText}`;
    }
    if (statsWrap && countEl) {
      statsWrap.hidden = false;
    }
    toggleCardSearch(true);
    updateButtons();
  };

  const applyWordFilter = (items = []) => {
    if (!wordFilterTerm) return items;
    const term = wordFilterTerm.toLowerCase();
    return items.filter((item) => {
      const haystack = `${item.word || ""} ${item.definition || ""} ${item.example || ""}`.toLowerCase();
      return haystack.includes(term);
    });
  };

  const renderDecks = () => {
    const term = filterTerm.trim().toLowerCase();
    let items = decks;
    if (term) {
      items = decks.filter((deck) => {
        const haystack = `${deck.title || ""} ${deck.description || ""} ${deck.category || ""}`.toLowerCase();
        return haystack.includes(term);
      });
    }

    if (!items.length) {
      deckList.innerHTML = "";
      if (emptyState) {
        emptyState.hidden = false;
        emptyState.textContent = decks.length
          ? "No decks match your search."
          : "No decks yet. Create your first one!";
      }
      return;
    }

    if (emptyState) emptyState.hidden = true;

    deckList.innerHTML = items
      .map((deck) => {
        const meta = deck.description || "No description yet";
        const badge = escapeHtml(formatDeckLang(deck));
        const activeClass = deck.id === activeDeckId ? "active" : "";
        return `
          <li class="deck-item ${activeClass}" data-deck-id="${deck.id}">
            <div class="deck-info">
              <p class="deck-title">${escapeHtml(deck.title)}</p>
              <p class="deck-meta">${escapeHtml(meta)}</p>
            </div>
            <span class="deck-progress">${badge}</span>
          </li>
        `;
      })
      .join("");
  };

  const renderWords = (words = []) => {
    if (!wordListEl) return;
    const filtered = applyWordFilter(words);
    if (!words.length) {
      wordListEl.innerHTML = "";
      setPlaceholder("No cards yet. Use Add to create one.");
    } else if (!filtered.length) {
      wordListEl.innerHTML = "";
      setPlaceholder("No cards match your search.");
    } else {
      wordListEl.innerHTML = filtered.map((item) => renderFlashcardWordCard(item)).join("");
      wordListEl.hidden = false;
      if (placeholderEl) placeholderEl.hidden = true;
    }
    const count = words.length || 0;
    if (countEl) {
      const label = count === 1 ? "card" : "cards";
      countEl.textContent = `${count} ${label}`;
    }
    if (statsWrap) {
      statsWrap.hidden = !activeDeckId;
    }
  };
  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  };

  const loadWords = async (deckId, { silent = false } = {}) => {
    if (!deckId) return;
    if (!silent) {
      setPlaceholder("Loading cards…");
    }
    try {
      const data = await api(PATHS.flashcardDeckWords(deckId), "GET");
      currentWords = Array.isArray(data) ? data : [];
      renderWords(currentWords);
    } catch (err) {
      console.error("Failed to load cards:", err);
      currentWords = [];
      setPlaceholder(err.message || "Failed to load cards.");
    }
  };

  const selectDeck = (deckId) => {
    const deck = decks.find((item) => item.id === deckId);
    if (!deck) return;
    activeDeckId = deckId;
    resetWordSearch();
    updateHead(deck);
    renderDecks();
    loadWords(deckId);
  };

  const clearSelection = () => {
    activeDeckId = null;
    currentWords = [];
    resetWordSearch();
    if (wordListEl) {
      wordListEl.innerHTML = "";
      wordListEl.hidden = true;
    }
    updateHead(null);
  };

  const loadDecks = async (autoSelect = true) => {
    try {
      const data = await api(PATHS.flashcardDecks, "GET");
      decks = Array.isArray(data) ? data : [];
      renderDecks();
      if (!decks.length) {
        clearSelection();
        return;
      }

      const keepCurrent = decks.some((deck) => deck.id === activeDeckId);
      if (keepCurrent) {
        updateHead(decks.find((d) => d.id === activeDeckId));
        loadWords(activeDeckId, { silent: true });
      } else if (autoSelect) {
        selectDeck(decks[0].id);
      } else {
        clearSelection();
      }
    } catch (err) {
      console.error("Failed to load decks:", err);
      if (emptyState) {
        emptyState.hidden = false;
        emptyState.textContent = err.message || "Failed to load decks.";
      }
      clearSelection();
    }
  };

  const exportDeck = async (deck) => {
    if (!deck || !exportDeckBtn) return;
    const defaultLabel = exportDeckBtn.textContent || "Export";
    exportDeckBtn.disabled = true;
    exportDeckBtn.textContent = "Preparing…";
    try {
      const res = await apiFetch(PATHS.flashcardDeckExport(deck.id), "GET");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const slug = (deck.title || `deck-${deck.id}`)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      const stamp = new Date().toISOString().slice(0, 10);
      const filename = `${slug || `deck-${deck.id}`}-${stamp}.csv`;
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export deck:", err);
      alert(err.message || "Unable to export deck.");
    } finally {
      exportDeckBtn.textContent = defaultLabel;
      exportDeckBtn.disabled = !activeDeckId;
    }
  };

  const wordModal = initWordModal({
    onSaved: () => {
      loadWords(activeDeckId);
    },
  });

  const deleteModal = initDeleteModal({
    onConfirm: async ({ deckId, wordId }) => {
      await api(PATHS.flashcardDeckWord(deckId, wordId), "DELETE");
      await loadWords(deckId, { silent: true });
    },
  });

  const deckDeleteModal = initDeckDeleteModal({
    onConfirm: async ({ deckId }) => {
      await api(PATHS.flashcardDeck(deckId), "DELETE");
      await loadDecks(true);
    },
  });
  const studyModal = initStudyModal({
    onDifficultySaved: (updatedCard) => {
      if (!updatedCard || !Number.isFinite(updatedCard.id)) return;
      const idx = currentWords.findIndex((item) => item.id === updatedCard.id);
      if (idx === -1) return;
      currentWords[idx].difficulty = updatedCard.difficulty;
      renderWords(currentWords);
    },
    onSessionComplete: () => {
      void refreshFlashcardStats();
    },
  });
  const sessionEmptyModal = (() => {
    const modal = qs("#session-empty-modal");
    if (!modal) return null;
    const closeTargets = modal.querySelectorAll("[data-session-empty-close]");
    const close = () => {
      modal.classList.remove("open");
      modal.setAttribute("aria-hidden", "true");
    };
    closeTargets.forEach((btn) => btn.addEventListener("click", close));
    return {
      open() {
        modal.classList.add("open");
        modal.setAttribute("aria-hidden", "false");
      },
      close,
    };
  })();

  const startGlobalDeckSession = async () => {
    if (!studyModal) {
      throw new Error("Study session is unavailable right now.");
    }
    const data = await api(PATHS.flashcardSession, "GET");
    const cards = Array.isArray(data?.cards) ? data.cards : [];
    if (!cards.length) {
      sessionEmptyModal?.open();
      return;
    }
    const langLabel = data.lang === "de" ? "German" : "English";
    studyModal.startSession({
      deck: { title: `${langLabel} session` },
      cards: shuffle(cards),
    });
  };

  if (wordListEl) {
    wordListEl.addEventListener("click", (event) => {
      const editBtn = event.target.closest(".word-card-edit");
      if (editBtn) {
        const card = editBtn.closest(".word-card");
        const deckId = Number(card?.dataset.deckId || activeDeckId);
        const wordId = Number(card?.dataset.wordId);
        if (!Number.isFinite(deckId) || !Number.isFinite(wordId)) return;
        const deck = decks.find((d) => d.id === deckId) || decks.find((d) => d.id === activeDeckId);
        const wordEntity = currentWords.find((item) => item.id === wordId);
        if (!deck || !wordEntity) return;
        wordModal?.open(deck, wordEntity);
        return;
      }
      const btn = event.target.closest(".word-card-delete");
      if (!btn) return;
      const card = btn.closest(".word-card");
      const deckId = Number(card?.dataset.deckId || activeDeckId);
      if (!Number.isFinite(deckId)) return;
      const wordId = Number(card?.dataset.wordId);
      if (!Number.isFinite(wordId)) return;
      const label = card?.querySelector(".word-card-title")?.textContent?.trim() || "";
      deleteModal?.open({
        deckId,
        wordId,
        word: label,
      });
    });
  }

  deckList.addEventListener("click", (event) => {
    const item = event.target.closest(".deck-item");
    if (!item) return;
    const deckId = Number(item.dataset.deckId);
    if (!Number.isFinite(deckId)) return;
    selectDeck(deckId);
  });

  searchInput?.addEventListener("input", (event) => {
    filterTerm = event.target.value || "";
    renderDecks();
  });

  if (addBtn) {
    addBtn.addEventListener("click", () => {
      if (!activeDeckId) return;
      const deck = decks.find((d) => d.id === activeDeckId);
      if (!deck) return;
      wordModal?.open(deck);
    });
  }

  if (studyBtn) {
    studyBtn.addEventListener("click", () => {
      if (!activeDeckId) return;
      const deck = decks.find((d) => d.id === activeDeckId);
      if (!deck) return;
      studyModal?.startSession({
        deck,
        cards: shuffle(currentWords),
      });
    });
  }

  if (editDeckBtn) {
    editDeckBtn.addEventListener("click", () => {
      if (!activeDeckId) return;
      const deck = decks.find((d) => d.id === activeDeckId);
      if (!deck) return;
      if (typeof onEditDeck === "function") {
        onEditDeck(deck);
      }
    });
  }

  if (deleteDeckBtn) {
    deleteDeckBtn.addEventListener("click", () => {
      if (!activeDeckId) return;
      const deck = decks.find((d) => d.id === activeDeckId);
      if (!deck) return;
      deckDeleteModal?.open({
        deckId: deck.id,
        title: deck.title,
      });
    });
  }

  if (exportDeckBtn) {
    exportDeckBtn.addEventListener("click", async () => {
      if (!activeDeckId) return;
      const deck = decks.find((d) => d.id === activeDeckId);
      if (!deck) return;
      await exportDeck(deck);
    });
  }

  loadDecks(false);

  wordSearchInput?.addEventListener("input", (event) => {
    const value = (event.target.value || "").toString();
    wordFilterTerm = value.trim().toLowerCase();
    renderWords(currentWords);
  });

  return {
    reload(autoSelect = false) {
      loadDecks(autoSelect);
    },
    async startGlobalSession() {
      await startGlobalDeckSession();
    },
  };
}

function initDeckImportModal(options = {}) {
  const modal = qs("#deck-import-modal");
  const openBtn = qs("#btn-import-deck");
  if (!modal || !openBtn) return null;

  const { onDeckImported } = options || {};
  const form = modal.querySelector("#deck-import-form");
  const hint = modal.querySelector("[data-import-hint]");
  const submitBtn = form?.querySelector('button[type="submit"]');
  const fileInput = form?.querySelector('input[name="file"]');
  const langInput = form?.querySelector('select[name="lang"]');
  const defaultHint = hint ? hint.textContent : "";
  const defaultSubmitText = submitBtn ? submitBtn.textContent : "Import deck";

  const setHint = (text, status) => {
    if (!hint) return;
    hint.textContent = text;
    hint.classList.remove("success", "error");
    if (status === "success" || status === "error") {
      hint.classList.add(status);
    }
  };

  const handleEsc = (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    closeModal();
  };

  function openModal() {
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.addEventListener("keydown", handleEsc);
    form?.reset();
    if (langInput) {
      langInput.value = "en";
    }
    setHint(defaultHint, null);
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = defaultSubmitText;
    }
  }

  function closeModal() {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.removeEventListener("keydown", handleEsc);
    form?.reset();
    if (langInput) {
      langInput.value = "en";
    }
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = defaultSubmitText;
    }
    setHint(defaultHint, null);
  }

  openBtn.addEventListener("click", (event) => {
    event.preventDefault();
    openModal();
  });

  modal.addEventListener("click", (event) => {
    const closer = event.target.closest("[data-modal-close]");
    if (!closer) return;
    event.preventDefault();
    closeModal();
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!fileInput || !fileInput.files || !fileInput.files.length) {
      setHint("Select a CSV file to import.", "error");
      return;
    }
    const file = fileInput.files[0];
    if (!file || !file.name.toLowerCase().endsWith(".csv")) {
      setHint("Only CSV files are supported.", "error");
      return;
    }

    const formData = new FormData(form);
    formData.set("file", file);
    const langValue = (formData.get("lang") || "en").toString().trim().toLowerCase();
    formData.set("lang", langValue || "en");

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Importing…";
    }
    setHint("Importing deck…");

    try {
      const deck = await api(PATHS.flashcardImport, "POST", formData);
      setHint(`Imported “${deck.title}”`, "success");
      if (typeof onDeckImported === "function") {
        onDeckImported(deck);
      }
      setTimeout(() => closeModal(), 700);
    } catch (err) {
      console.error("Failed to import deck:", err);
      setHint(err.message || "Failed to import deck", "error");
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = defaultSubmitText;
      }
    }
  });

  return {
    open: openModal,
    close: closeModal,
  };
}

function initDeckCreator(options = {}) {
  const modal = qs("#deck-create-modal");
  const openBtn = qs("#btn-open-deck-modal");
  if (!modal || !openBtn) return null;

  const { onDeckSaved } = options;
  const form = modal.querySelector("#deck-create-form");
  const hint = modal.querySelector("[data-modal-hint]");
  const defaultHint = hint ? hint.textContent : "";
  const submitBtn = form?.querySelector('button[type="submit"]');
  const headerLabel = modal.querySelector(".deck-modal-head .panel-label");
  const modalTitleEl = modal.querySelector("#deck-modal-title");
  const titleInput = form?.querySelector('input[name="title"]');
  const descriptionInput = form?.querySelector('textarea[name="description"]');
  const categoryInput = form?.querySelector('select[name="category"]');
  const langInput = form?.querySelector('select[name="lang"]');

  const defaultHeaderText = headerLabel ? headerLabel.textContent : "New deck";
  const defaultModalTitle = modalTitleEl ? modalTitleEl.textContent : "Create flashcard set";
  const defaultSubmitText = submitBtn ? submitBtn.textContent : "Save deck";
  const editHeaderText = "Edit deck";
  const editModalTitle = "Edit flashcard set";
  const editSubmitText = "Save changes";

  let mode = "create";
  let editingDeckId = null;

  const focusFirstField = () => {
    const field = form?.querySelector("input, textarea, select");
    if (field) {
      field.focus();
    }
  };

  const applyMode = () => {
    const editing = mode === "edit";
    if (headerLabel) {
      headerLabel.textContent = editing ? editHeaderText : defaultHeaderText;
    }
    if (modalTitleEl) {
      modalTitleEl.textContent = editing ? editModalTitle : defaultModalTitle;
    }
    if (submitBtn) {
      submitBtn.textContent = editing ? editSubmitText : defaultSubmitText;
    }
  };

  const setHint = (text, status) => {
    if (!hint) return;
    hint.textContent = text;
    hint.classList.remove("success", "error");
    if (status === "success" || status === "error") {
      hint.classList.add(status);
    }
  };

  const handleEsc = (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    closeModal();
  };

  function openModal(deck = null) {
    mode = deck ? "edit" : "create";
    editingDeckId = deck?.id ?? null;
    applyMode();
    if (form) {
      form.reset();
      if (deck) {
        if (titleInput) titleInput.value = deck.title || "";
        if (descriptionInput) descriptionInput.value = deck.description || "";
        if (categoryInput) categoryInput.value = deck.category || "";
        if (langInput) langInput.value = deck.lang || "en";
      } else if (langInput) {
        langInput.value = "en";
      }
    }
    if (hint) {
      hint.classList.remove("success", "error");
      hint.textContent = defaultHint;
    }
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.addEventListener("keydown", handleEsc);
    setTimeout(focusFirstField, 15);
  }

  function closeModal() {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.removeEventListener("keydown", handleEsc);
    mode = "create";
    editingDeckId = null;
    applyMode();
    if (form) {
      form.reset();
    }
    if (langInput) {
      langInput.value = "en";
    }
    if (hint) {
      hint.classList.remove("success", "error");
      hint.textContent = defaultHint;
    }
  }

  openBtn.addEventListener("click", () => openModal());

  modal.addEventListener("click", (event) => {
    const closer = event.target.closest("[data-modal-close]");
    if (!closer) return;
    event.preventDefault();
    closeModal();
  });

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const payload = {
      title: (data.get("title") || "").toString().trim(),
      description: (data.get("description") || "").toString().trim(),
      category: (data.get("category") || "").toString().trim(),
      lang: (data.get("lang") || "").toString().trim().toLowerCase(),
    };
    if (!payload.title || !payload.description) {
      setHint("Please fill Title and Description.", "error");
      return;
    }
    if (!payload.category) {
      payload.category = null;
    }
    if (!["en", "de"].includes(payload.lang)) {
      setHint("Please choose a language.", "error");
      return;
    }

    const submitText = submitBtn ? submitBtn.textContent : "";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Saving…";
    }
    const isEdit = mode === "edit" && Number.isFinite(editingDeckId);
    const endpoint = isEdit ? PATHS.flashcardDeck(editingDeckId) : PATHS.flashcardDecks;
    const method = isEdit ? "PUT" : "POST";
    setHint(isEdit ? "Updating deck…" : "Saving deck…");

    api(endpoint, method, payload)
      .then((deck) => {
        const actionLabel = isEdit ? "Updated" : "Saved";
        setHint(`${actionLabel} “${deck.title}” deck`, "success");
        if (!isEdit) {
          form?.reset();
        }
        if (typeof onDeckSaved === "function") {
          onDeckSaved(deck, { mode: isEdit ? "edit" : "create" });
        }
        setTimeout(() => {
          closeModal();
        }, 600);
      })
      .catch((err) => {
        console.error("Failed to save deck:", err);
        setHint(err.message || "Failed to save deck", "error");
      })
      .finally(() => {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = submitText || defaultSubmitText;
        }
      });
  });

  return {
    open(deck = null) {
      openModal(deck);
    },
    close: closeModal,
  };
}

/* ===================== BOOTSTRAP ===================== */

async function bootstrap() {
  try {
    await api(PATHS.me);        // auth check (+ auto refresh)
    await loadSettings();       // pull saved language from DB
    await loadSessionWords();   // fetch current session progress
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

async function loadSessionWords() {
  try {
    const data = await api(PATHS.randomSessionWords, "GET");
    const value = Number(data?.session_words);
    sessionWords = Number.isFinite(value) ? value : 0;
  } catch (err) {
    console.error("Failed to load session words:", err.message);
    sessionWords = 0;
  } finally {
    updateSessionBadge();
  }
}

async function incrementSessionWords() {
  try {
    const data = await api(PATHS.randomSessionWords, "PUT");
    const value = Number(data?.session_words);
    if (Number.isFinite(value)) {
      sessionWords = value;
    } else {
      sessionWords += 1;
    }
  } catch (err) {
    console.error("Failed to increment session words:", err.message);
    sessionWords += 1;
  } finally {
    updateSessionBadge();
  }
}

/* ===================== DOM EVENTS ===================== */

document.addEventListener("DOMContentLoaded", () => {
  bootstrap();
  initWordChainGame();
  const libraryController = initWordLibrary();
  let deckCreatorController;
  const flashcardController = initFlashcardWorkspace({
    onEditDeck: (deck) => {
      deckCreatorController?.open(deck);
    },
  });
  deckCreatorController = initDeckCreator({
    onDeckSaved: (_deck, meta = {}) => {
      const autoSelect = meta.mode !== "edit";
      flashcardController?.reload(autoSelect);
    },
  });
  initDeckImportModal({
    onDeckImported: () => {
      flashcardController?.reload(true);
      void refreshFlashcardStats();
    },
  });
  const globalSessionBtn = qs("#btn-start-session");
  if (globalSessionBtn) {
    const defaultLabel = globalSessionBtn.textContent || "Start new session";
    globalSessionBtn.addEventListener("click", async () => {
      if (!flashcardController) return;
      globalSessionBtn.disabled = true;
      globalSessionBtn.textContent = "Preparing session…";
      try {
        await flashcardController.startGlobalSession();
      } catch (err) {
        console.error("Failed to start global session:", err);
        alert(err.message || "Unable to start session.");
      } finally {
        globalSessionBtn.disabled = false;
        globalSessionBtn.textContent = defaultLabel;
      }
    });
  }
  const randomAddController = initRandomAddModal();

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
      const prevTheme = currentTheme;
      currentTheme = newTheme;
      applyTheme(currentTheme);
      updateThemeRadios();
      try {
        const data = await api(PATHS.settings, "PUT", {
          random_word_lang: currentLang,
          theme: newTheme,
        });
        currentLang = data.random_word_lang || currentLang;
        currentTheme = data.theme || currentTheme;
        applyTheme(currentTheme);
        updateThemeRadios();
        if (libraryController?.reload) {
          libraryController.reload(false);
        }
      } catch (err) {
        console.error("Failed to update theme:", err.message);
        currentTheme = prevTheme;
        applyTheme(currentTheme);
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
    btnAddDeck.addEventListener("click", () => {
      const rawWord = qs("#word")?.textContent?.trim() || "";
      const placeholderWords = ["Word", "—", "Tap generate to refresh"];
      const safeWord = placeholderWords.includes(rawWord) ? "" : rawWord;
      randomAddController?.openWord(safeWord);
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
        await incrementSessionWords();
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
