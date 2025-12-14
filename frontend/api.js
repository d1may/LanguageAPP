// api.js
export const API_BASE = "http://127.0.0.1:8000";

export const PATHS = {
  login: "/user/login",
  register: "/user/register",
  me: "/user/me",
  randomWord: "/words/random/",
  wordLibrary: "/words/library",
  wordLibraryEntry: (wordId) => `/words/library/${wordId}`,
  randomSessionWords: "/words/random_session_words",
  settings: "/user/settings",
  logout: "/user/logout",
  wordleCheck: "/wordle/check",
  wordleStats: "/wordle/stats",
  wordleStatsResult: "/wordle/stats/result",
  wordleRandom: "/wordle_random_word",
  wordRating: "/words/rate",
  flashcardDecks: "/flashcard/decks",
  flashcardDeck: (deckId) => `/flashcard/decks/${deckId}`,
  flashcardDeckWords: (deckId) => `/flashcard/decks/${deckId}/words`,
  flashcardDeckWord: (deckId, wordId) => `/flashcard/decks/${deckId}/words/${wordId}`,
  flashcardWordDifficulty: (deckId, wordId) => `/flashcard/decks/${deckId}/words/${wordId}/difficulty`,
  flashcardSession: "/flashcard/session",
  flashcardDeckExport: (deckId) => `/flashcard/export/flashcard_csv?deck_id=${encodeURIComponent(deckId)}`,
  flashcardImport: "/flashcard/import",
  flashcardStats: "/flashcard/stats",
  wordChainAdd: (word) => `/word_chain/add_word/${encodeURIComponent(word)}`,
  wordChainBot: "/word_chain/bot_word",
  wordChainClear: "/word_chain",
};

export const qs = (s) => document.querySelector(s);
export const show = (el, yes = true) => {
  if (!el) return;
  el.hidden = !yes;
};

/* ===================== ERROR PARSER ===================== */

function extractErrorMessage(data, res) {
  // 1) detail как строка
  if (data && typeof data.detail === "string") {
    return data.detail;
  }

  // 2) FastAPI validation error: detail: [{msg,...}]
  if (data && Array.isArray(data.detail) && data.detail.length) {
    return data.detail.map((e) => e.msg || JSON.stringify(e)).join("; ");
  }

  // 3) detail как объект с msg
  if (data && data.detail && typeof data.detail === "object" && data.detail.msg) {
    return data.detail.msg;
  }

  // 4) fallback
  return `HTTP ${res.status} ${res.statusText}`;
}

/* ===================== COOKIES & REFRESH ===================== */

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop().split(";").shift();
  }
  return null;
}

async function tryRefresh() {
  const csrf = getCookie("csrf_refresh_token");

  const headers = {};
  if (csrf) {
    headers["X-CSRF-TOKEN"] = csrf;
  }

  const res = await fetch(API_BASE + "/user/refresh", {
    method: "POST",
    credentials: "include",
    headers,
  });

  if (res.ok) {
    return true;
  }

  console.warn("Refresh failed:", res.status);
  return false;
}

/* ===================== CSRF FOR STATE-CHANGING REQUESTS ===================== */

function getCsrfHeader(method, useRefresh = false) {
  const upper = method.toUpperCase();
  if (upper === "GET" || upper === "HEAD" || upper === "OPTIONS") {
    return {};
  }
  const cookieName = useRefresh ? "csrf_refresh_token" : "csrf_access_token";
  const csrf = getCookie(cookieName);
  return csrf ? { "X-CSRF-TOKEN": csrf } : {};
}

/* ===================== MAIN API WRAPPER ===================== */

async function authorizedRequest(path, method = "GET", body = null, options = {}) {
  const headers = {};
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  if (body && !isFormData) headers["Content-Type"] = "application/json";
  const { useRefreshCsrf = false } = options;

  async function doRequest() {
    const csrfHeaders = getCsrfHeader(method, useRefreshCsrf);

    return fetch(API_BASE + path, {
      method,
      headers: { ...headers, ...csrfHeaders },
      body: body ? (isFormData ? body : JSON.stringify(body)) : null,
      credentials: "include",
    });
  }

  let res = await doRequest();

  // Если access протух — пробуем освежить
  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await doRequest();
    }
  }

  return res;
}

export async function api(path, method = "GET", body = null, options = {}) {
  const res = await authorizedRequest(path, method, body, options);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = extractErrorMessage(data, res);
    console.error("API error:", msg, "raw:", data);
    throw new Error(msg);
  }

  return data;
}

export async function apiFetch(path, method = "GET", body = null, options = {}) {
  const res = await authorizedRequest(path, method, body, options);

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg = extractErrorMessage(data, res);
    console.error("API error:", msg, "raw:", data);
    throw new Error(msg);
  }

  return res;
}
