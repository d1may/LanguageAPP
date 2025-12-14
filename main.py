from fastapi import FastAPI, Request, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from authx import TokenPayload
from routers import (
    auth as auth_router,
    user as user_router,
    random as random_router,
    translate as translate_router,
    wordle_random_words as wordle_random_word_router,
    wordle_check as wordle_check_router,
    flashcard as flashcard_router,
    words as words_router
)
from routers.auth import security
from core.database import get_db
from services.flashcard_service import FlashcardService
from services.word_services import WordServices
from services.wordle_services import WordleServices
from fastapi_utils.tasks import repeat_every
from models.user import User
from contextlib import asynccontextmanager
import uvicorn, asyncio

@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(background_task())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(title="LanguageApp", lifespan=lifespan)
security.handle_errors(app)
templates = Jinja2Templates(directory="templates")
app.mount("/static", StaticFiles(directory="frontend"), name="static")

origins = [
    "http://localhost",
    "http://127.0.0.1",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(user_router.router)
app.include_router(random_router.router)
app.include_router(translate_router.router)
app.include_router(wordle_random_word_router.router)
app.include_router(wordle_check_router.router)
app.include_router(flashcard_router.router)
app.include_router(words_router.router)

LANG_DISPLAY = {
    "en": "English",
    "de": "German",
}
VALID_LANGS = set(LANG_DISPLAY.keys())

async def background_task():
    from core.database import SessionLocal
    from models.user import User

    while True:
        await asyncio.sleep(86400)
        db = SessionLocal()
        try:
            users = db.query(User).all()
            for user in users:
                try:
                    WordServices(db).refresh_random(user_id=user.id)
                except Exception as e:
                    print(f"Error for user {user.id}: {e}")
        finally:
            db.close()

def resolve_profile_lang(db: Session, user_id: int | None) -> str:
    if user_id is None:
        return "en"
    user = db.get(User, user_id)
    candidate = (user.random_word_lang if user else None) or "en"
    candidate = candidate.lower()
    return candidate if candidate in VALID_LANGS else "en"


@app.get("/", response_class=HTMLResponse, name="dashboard")
async def dashboard(
    request: Request,
    payload: TokenPayload = Depends(security.access_token_required),
    db: Session = Depends(get_db),
):
    try:
        user_id = int(payload.sub)
    except (TypeError, ValueError):
        user_id = None

    total_cards = 0
    if user_id is not None:
        svc = FlashcardService(db)
        total_cards = svc.count_user_cards(user_id)

    return templates.TemplateResponse(
        "home.html",
        {"request": request, "active_page": "home", "total_cards": total_cards},
    )

@app.get("/random", response_class=HTMLResponse, name="random_page")
async def random_page(request: Request):
    return templates.TemplateResponse("random.html", {"request": request, "active_page": "random"})

@app.get("/wordle", response_class=HTMLResponse, name="wordle_page")
async def wordle_page(
    request: Request,
    payload: TokenPayload = Depends(security.access_token_required),
    db: Session = Depends(get_db),
):
    user_id = int(payload.sub)
    svc = WordleServices(db)
    stats = svc.get_stats(user_id=user_id)
    return templates.TemplateResponse(
        "wordle.html",
        {"request": request, "active_page": "wordle", "wordle_stats": stats},
    )

@app.get("/word-chain", response_class=HTMLResponse, name="word_chain_page")
async def word_chain_page(
    request: Request,
    payload: TokenPayload = Depends(security.access_token_required),
    db: Session = Depends(get_db),
):
    try:
        user_id = int(payload.sub)
    except (TypeError, ValueError):
        user_id = None
    lang_code = resolve_profile_lang(db, user_id)
    lang_label = LANG_DISPLAY.get(lang_code, LANG_DISPLAY["en"])
    return templates.TemplateResponse(
        "word_chain.html",
        {
            "request": request,
            "active_page": "wordchain",
            "word_chain_lang_label": lang_label,
        },
    )

@app.get("/auth", response_class=HTMLResponse, name="auth_page")
async def auth_page(request: Request):
    return templates.TemplateResponse("auth.html", {"request": request})

@app.get("/flashcard", response_class=HTMLResponse, name="flashcard_page")
async def flashcard_page(
    request: Request,
    payload: TokenPayload = Depends(security.access_token_required),
    db: Session = Depends(get_db),
):
    user_id = int(payload.sub)
    svc = FlashcardService(db)
    total_cards = svc.count_user_cards(user_id)
    due_cards = svc.count_due_cards(user_id)
    return templates.TemplateResponse(
        "flashcard.html",
        {"request": request, "active_page": "flashcard", "total_cards": total_cards, "due_cards": due_cards},
    )

@app.get("/status")
async def status():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run("main:app", reload=True, host="127.0.0.1", port=8000)
