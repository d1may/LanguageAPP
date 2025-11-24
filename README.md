# LanguageApp

FastAPI + vanilla JS application that combines authentication, word‑practice tools and a Wordle‑style mini‑game. The backend serves HTML templates, REST endpoints and handles JWT cookies; the frontend lives in `frontend/` and is delivered through FastAPI’s static files mount.

## Features
- Email/password registration & login with HTTP‑only JWT cookies (AuthX).
- User profile drawer that stores preferred language (`en` / `de`).
- Random word fetcher (`/words/*`) and Deepl-based translator (see `routers/translate.py`).
- Wordle playground at `/wordle` with on-screen keyboard, attempt tracking, backend validation and dynamic tile coloring.
- REST helpers for fetching random game words (`/wordle_random_word/{lang}_{target}`) and validating guesses (`/wordle/check`).

## Tech Stack
- **Backend:** FastAPI, AuthX, SQLAlchemy, Alembic, Jinja2 templates.
- **Frontend:** Vanilla JS + CSS modules inside `frontend/`.
- **Database:** SQLite by default (`users.db`), configurable via `DATABASE_URL`.

## Getting Started
Requirements:
- Python >= 3.12
- Node.js (optional, only if you plan to add build tooling for the frontend)

```bash
git clone <repo>
cd languageapp
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -e .
```

Create an `.env` file (see `.env.example` if present) and provide at least:
```
SECRET_KEY=...
DEEPL_KEY=optional
DATABASE_URL=sqlite:///users.db  # default is fine
```

Run the app:
```bash
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```
Visit:
- `http://127.0.0.1:8000/` – dashboard + random word tools
- `http://127.0.0.1:8000/wordle` – Wordle UI
- `http://127.0.0.1:8000/docs` – interactive API docs

## Project Structure (excerpt)
```
frontend/        # CSS/JS modules
routers/         # FastAPI routers (auth, words, translate, wordle)
templates/       # Jinja2 templates (auth, app, wordle, partials)
models/, schemas/, services/, repositories/  # domain logic
```

## Useful Commands
- `alembic upgrade head` – apply DB migrations.
- `pytest` – run tests (if/when added).
- `ruff check` or `black` – lint/format (configure as needed).

## Contribution Tips
- Keep `.env` and other secrets out of version control (see `.gitignore`).
- When touching both frontend and backend, document endpoints in this README.
- Prefer reusing the `api.js` helper for AJAX calls so CSRF headers stay consistent.

Happy hacking!
