from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from routers import auth as auth_router, user as user_router, words as words_router, translate as translate_router, wordle_random_words as wordle_random_word_router, wordle_check as wordle_check_router
from routers.auth import security
import uvicorn


app = FastAPI(title="Authentefication")
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
app.include_router(words_router.router)
app.include_router(translate_router.router)
app.include_router(wordle_random_word_router.router)
app.include_router(wordle_check_router.router)

@app.get("/", response_class=HTMLResponse, name="dashboard")
async def dashboard(request: Request):
    return templates.TemplateResponse("home.html", {"request": request, "active_page": "home"})

@app.get("/random", response_class=HTMLResponse, name="random_page")
async def random_page(request: Request):
    return templates.TemplateResponse("random.html", {"request": request, "active_page": "random"})

@app.get("/wordle", response_class=HTMLResponse, name="wordle_page")
async def wordle_page(request: Request):
    return templates.TemplateResponse("wordle.html", {"request": request, "active_page": "wordle"})

@app.get("/auth", response_class=HTMLResponse, name="auth_page")
async def auth_page(request: Request):
    return templates.TemplateResponse("auth.html", {"request": request})

@app.get("/flashcard", response_class=HTMLResponse, name="flashcard_page")
async def flashcard_page(request: Request):
    return templates.TemplateResponse("flashcard.html", {"request": request, "active_page": "flashcard"})

@app.get("/status")
async def status():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run("main:app", reload=True, host="127.0.0.1", port=8000)
