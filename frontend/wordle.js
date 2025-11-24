import { api, PATHS, qs } from "./api.js";

let currentLang = "en";
let currentMode = 5;
let initialBoardState = "";
const WORDLE_ATTEMPTS = 6;
let boardElement = null;
let boardRows = [];
let isGameActive = false;
let currentAttempt = 0;
let currentGuess = [];
let activeWordLength = currentMode;
let secretWord = "";
let awaitingRestart = false;

const LANG_LABEL = {
  en: "English",
  de: "Deutsch",
};

const KEYBOARD_LAYOUTS = {
  en: [
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    [null, "A", "S", "D", "F", "G", "H", "J", "K", "L", null],
    [null, "Z", "X", "C", "V", "B", "N", "M", "⌫"],
  ],
  de: [
    ["Q", "W", "E", "R", "T", "Z", "U", "I", "O", "P", "Ü"],
    [null, "A", "S", "D", "F", "G", "H", "J", "K", "L", "Ö", "Ä", null],
    [null, "Y", "X", "C", "V", "B", "N", "M", "⌫", null],
  ],
};

async function bootstrap() {
  try {
    await api(PATHS.me);
    await loadSettings();
  } catch (err) {
    console.warn("Auth check failed:", err.message);
    window.location = "/auth";
  }
}

async function loadSettings() {
  try {
    const data = await api(PATHS.settings, "GET");
    currentLang = data.random_word_lang || "en";
  } catch (err) {
    console.error("Failed to load settings:", err.message);
    currentLang = "en";
  } finally {
    updateLanguageUI();
  }
}

function updateLanguageUI() {
  const label = qs("#wordle-language");
  if (label) {
    label.textContent = LANG_LABEL[currentLang] || LANG_LABEL.en;
  }

  const inputs = document.querySelectorAll('input[name="rw-lang"]');
  inputs.forEach((input) => {
    input.checked = input.value === currentLang;
  });
}

function setupLogout() {
  const btnLogout = qs("#btn-logout");
  if (!btnLogout) return;

  btnLogout.addEventListener("click", async () => {
    try {
      await api(PATHS.logout, "POST", null, { useRefreshCsrf: true });
    } finally {
      window.location = "/auth";
    }
  });
}

function setupProfileDrawer() {
  const drawer = qs("#profile-drawer");
  const btnProfile = qs("#btn-profile");
  const btnProfileClose = qs("#btn-profile-close");
  const backdrop = qs("#profile-backdrop");
  const langInputs = document.querySelectorAll('input[name="rw-lang"]');

  function openDrawer() {
    drawer?.classList.add("open");
  }

  function closeDrawer() {
    drawer?.classList.remove("open");
  }

  if (btnProfile) btnProfile.addEventListener("click", openDrawer);
  if (btnProfileClose) btnProfileClose.addEventListener("click", closeDrawer);
  if (backdrop) backdrop.addEventListener("click", closeDrawer);

  langInputs.forEach((input) => {
    input.addEventListener("change", async () => {
      if (!input.checked) return;

      const newLang = input.value;
      try {
        const data = await api(PATHS.settings, "PUT", {
          random_word_lang: newLang,
        });
        currentLang = data.random_word_lang || newLang;
        updateLanguageUI();
      } catch (err) {
        console.error("Failed to update language:", err.message);
        updateLanguageUI();
      }
    });
  });
}

function setupGameControls() {
  const modePicker = document.querySelector(".wordle-mode-picker");
  const startBtn = qs("#wordle-start");
  const alertBox = qs("#wordle-alert");
  const sendBtn = qs("#wordle-send");
  const keyboard = qs("#wordle-keyboard");
  const board = document.querySelector(".wordle-board");
  boardElement = board;

  if (board && !initialBoardState) {
    initialBoardState = board.innerHTML;
  }

  const changeText = () => {
    const title = document.querySelector(".wordle-headline h1");
    if (title) {
      title.textContent = "The game started";
    }
  };

  const showAlert = (message) => {
    if (!alertBox) return;
    alertBox.textContent = message;
  };

  const setStarted = (started) => {
    startBtn.hidden = started;
    sendBtn.hidden = !started;
    if (modePicker) modePicker.hidden = started;
    if (alertBox) alertBox.hidden = !started;
    if (keyboard) keyboard.hidden = !started;
  };

  const updateSendButtonLabel = () => {
    if (!sendBtn) return;
    sendBtn.textContent = awaitingRestart ? "Again" : "Send";
    sendBtn.classList.toggle("again", awaitingRestart);
  };

  const loadSecretWord = async () => {
    const word = await api(
      `${PATHS.wordleRandom}/${currentLang}_${activeWordLength}`,
      "GET"
    );
    secretWord = typeof word === "string" ? word.toUpperCase() : "";
    if (!secretWord) {
      throw new Error("Empty word received.");
    }
    return secretWord;
  };

  const applyTileStatuses = (tilesInfo = []) => {
    const row = boardRows[currentAttempt];
    if (!row) return;
    const tiles = row.querySelectorAll(".tile");
    tilesInfo.forEach((info, index) => {
      if (!info) return;
      const tile = tiles[index];
      if (!tile) return;
      if (info.letter) {
        tile.textContent = info.letter.toUpperCase();
      }
      tile.classList.remove("tile-correct", "tile-present", "tile-miss");
      if (info.status === "correct") {
        tile.classList.add("tile-correct");
      } else if (info.status === "present") {
        tile.classList.add("tile-present");
      } else {
        tile.classList.add("tile-miss");
      }
    });
  };

  const advanceAttempt = () => {
    if (currentAttempt < WORDLE_ATTEMPTS - 1) {
      currentAttempt += 1;
      currentGuess = [];
    } else {
      currentGuess = [];
      isGameActive = false;
    }
  };

  const prepareRound = async () => {
    startNewGame();
    awaitingRestart = false;
    updateSendButtonLabel();
    try {
      await loadSecretWord();
      showAlert(`The word must be ${activeWordLength} letters long.`);
    } catch (err) {
      console.error("Failed to load secret word:", err);
      showAlert("Failed to fetch the word. Please try again.");
      isGameActive = false;
      awaitingRestart = true;
      updateSendButtonLabel();
    }
  };

  const submitGuess = async () => {
    if (awaitingRestart) {
      await prepareRound();
      return;
    }

    if (!isGameActive) return;
    const lettersLeft = activeWordLength - currentGuess.length;
    if (lettersLeft > 0) {
      const suffix = lettersLeft === 1 ? "letter" : "letters";
      showAlert(`Need ${lettersLeft} more ${suffix}.`);
      return;
    }

    if (!secretWord) {
      try {
        await loadSecretWord();
      } catch (err) {
        console.error("Failed to fetch secret word:", err);
        showAlert("Failed to fetch the word. Please restart the game.");
        return;
      }
    }

    const guess = currentGuess.join("");
    showAlert("Sending the word for validation...");
    try {
      const response = await api(PATHS.wordleCheck, "POST", {
        guess,
        target: secretWord,
      });
      applyTileStatuses(response.tiles || []);
      if (response.is_complete) {
        showAlert(response.message || "You guessed the word!");
        currentGuess = [];
        isGameActive = false;
        awaitingRestart = true;
        updateSendButtonLabel();
        return;
      }
      advanceAttempt();
      if (!isGameActive) {
        showAlert(`No attempts left. The word was: ${secretWord}.`);
        awaitingRestart = true;
        updateSendButtonLabel();
        return;
      }
      showAlert(response.message || "Keep trying.");
    } catch (err) {
      showAlert(err.message || "Could not validate the word.");
    }
  };

  if (startBtn) {
    startBtn.addEventListener("click", async () => {
      renderKeyboard(currentLang);
      setStarted(true);
      changeText();
      await prepareRound();
      if (!isGameActive) {
        setStarted(false);
      }
    });
  }

  if (sendBtn) {
    sendBtn.addEventListener("click", submitGuess);
    updateSendButtonLabel();
  }
}

function setupModeButtons() {
  const modeButtons = document.querySelectorAll(".mode-btn");
  const board = document.querySelector(".wordle-board");

  const setMode = (size) => {
    currentMode = size;
    modeButtons.forEach((btn) => {
      btn.classList.toggle("active", Number(btn.dataset.size) === size);
    });
    if (board) {
      board.dataset.size = String(size);
    }
  };

  modeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const size = Number(btn.dataset.size);
      if (!Number.isNaN(size)) {
        setMode(size);
      }
    });
  });

  if (modeButtons.length) {
    const initial = Number(
      [...modeButtons].find((btn) => btn.classList.contains("active"))?.dataset
        .size
    );
    setMode(Number.isNaN(initial) ? 5 : initial);
  }
}

function startNewGame() {
  if (!boardElement) return;
  activeWordLength = currentMode;
  boardElement.innerHTML = buildBoardMarkup(activeWordLength, WORDLE_ATTEMPTS);
  boardRows = Array.from(boardElement.querySelectorAll(".wordle-row"));
  currentAttempt = 0;
  currentGuess = [];
  isGameActive = true;
  secretWord = "";
}

function buildBoardMarkup(size, rows = WORDLE_ATTEMPTS) {
  const cols = Number(size) && Number(size) > 0 ? Number(size) : 5;
  return Array.from({ length: rows })
    .map(
      () =>
        `<div class="wordle-row" role="row" style="--cols:${cols}">${Array.from({ length: cols })
          .map(() => '<div class="tile" role="gridcell"></div>')
          .join("")}</div>`
    )
    .join("");
}

function renderKeyboard(lang) {
  const keyboard = qs("#wordle-keyboard");
  if (!keyboard) return;

  const layout = KEYBOARD_LAYOUTS[lang] || KEYBOARD_LAYOUTS.en;

  const rows = layout
    .map((row) => {
      const keys = row
        .map((key) => {
          if (key === null) {
            return '<div class="spacer"></div>';
          }
          return `<button type="button" class="key" data-key="${key}">${key}</button>`;
        })
        .join("");
      return `<div class="keyboard-row">${keys}</div>`;
    })
    .join("");

  keyboard.innerHTML = rows;
}

function setupKeyboardInput() {
  const keyboard = qs("#wordle-keyboard");
  if (!keyboard) return;

  keyboard.addEventListener("click", (event) => {
    const key = event.target.closest(".key");
    if (!key) return;

    const letter = key.dataset.key || key.textContent.trim();
    handleVirtualKey(letter);
  });
}

function handleVirtualKey(rawKey) {
  if (!isGameActive || !rawKey) return;

  const key = rawKey.trim();
  const row = boardRows[currentAttempt];
  if (!row) return;
  const tiles = row.querySelectorAll(".tile");

  if (key === "⌫") {
    if (!currentGuess.length) return;
    currentGuess.pop();
    if (tiles[currentGuess.length]) {
      tiles[currentGuess.length].textContent = "";
    }
    return;
  }

  if (key === "Enter" || key === "⮕") {
    const sendBtn = qs("#wordle-send");
    sendBtn?.click();
    return;
  }

  const letter = key.toUpperCase();
  if (letter.length !== 1 || currentGuess.length >= activeWordLength) {
    return;
  }

  if (!tiles[currentGuess.length]) return;
  tiles[currentGuess.length].textContent = letter;
  currentGuess.push(letter);
}

document.addEventListener("DOMContentLoaded", () => {
  bootstrap();
  setupLogout();
  setupProfileDrawer();
  setupGameControls();
  setupModeButtons();
  setupKeyboardInput();
});
