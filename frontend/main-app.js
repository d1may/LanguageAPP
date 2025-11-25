import { api, qs, show, PATHS } from "./api.js";

let currentLang = "en";

function updateLangBadge() {
  const badge = qs("#word-lang");
  if (!badge) return;
  badge.textContent = currentLang === "de" ? "German" : "English";
}

/* ===================== BOOTSTRAP ===================== */

async function bootstrap() {
  try {
    await api(PATHS.me);        // проверка auth (+ авто refresh)
    await loadSettings();       // подгружаем язык из БД
  } catch (err) {
    console.warn("Auth check failed:", err.message);
    window.location = "/auth";
  }
}

async function loadSettings() {
  try {
    const data = await api(PATHS.settings, "GET");
    currentLang = data.random_word_lang || "en";
    updateLangBadge();

    // отметить правильный радио-инпут
    const inputs = document.querySelectorAll('input[name="rw-lang"]');
    inputs.forEach((input) => {
      input.checked = input.value === currentLang;
    });
  } catch (err) {
    console.error("Failed to load settings:", err.message);
    currentLang = "en";
    updateLangBadge();
  }
}

/* ===================== DOM EVENTS ===================== */

document.addEventListener("DOMContentLoaded", () => {
  bootstrap();

  // ----- Random word -----
  const btnWord = qs("#btn-word");
  if (btnWord) {
    btnWord.addEventListener("click", async () => {
      const msg = qs("#app-msg");
      const wordEl = qs("#word");
      show(msg, false);

      try {
        let endpoint;
        if (currentLang === "de") {
          endpoint = "/words/germany";
        } else {
          endpoint = "/words/english"; // дефолт EN
        }

        const data = await api(endpoint, "GET");
        wordEl.textContent = data.word || "—";
      } catch (err) {
        msg.textContent = "Помилка: " + err.message;
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
  const langInputs = document.querySelectorAll('input[name="rw-lang"]');

  function openDrawer() {
    drawer.classList.add("open");
  }
  function closeDrawer() {
    drawer.classList.remove("open");
  }

  if (btnProfile) btnProfile.addEventListener("click", openDrawer);
  if (btnProfileClose) btnProfileClose.addEventListener("click", closeDrawer);
  if (backdrop) backdrop.addEventListener("click", closeDrawer);

  // смена языка — шлём в БД
  console.log("langInputs:", langInputs.length);

  langInputs.forEach((input) => {
    input.addEventListener("change", async () => {
      if (!input.checked) return;
      const newLang = input.value; // "en" или "de"
      try {
        const data = await api(PATHS.settings, "PUT", {
          random_word_lang: newLang,
        });
        currentLang = data.random_word_lang;
        updateLangBadge();
      } catch (err) {
        console.error("Failed to update settings:", err.message);
        // откатить UI назад
        input.checked = false;
        const prev = [...langInputs].find((i) => i.value === currentLang);
        if (prev) prev.checked = true;
      }
    });
  });

  // ----- Translate -----
  const btnTranslate = qs("#btn-trans");

  function showTranslation(text) {
    const box = qs("#translation-box");

    box.innerHTML = `
      <b>Translation:</b> <code>${text}</code>`;

    box.classList.add("show");

    // Через 5 сек прибираємо анімацію, але НЕ видаляємо блок
    setTimeout(() => {
      box.classList.remove("show");
    }, 5000);
  }


  if (btnTranslate) {
    btnTranslate.addEventListener("click", async () => {
      const word = qs("#word").innerText.trim();
      if (!word || word === "—") return;

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
      }
    });
  }

});
