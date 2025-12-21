import csv
from random import choice, randint

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db
from authx import TokenPayload
from routers.auth import security
from schemas.words import WordOut
from spellchecker import SpellChecker

from services.words_services import WordChainServices
router = APIRouter(prefix="/word_chain", tags=["word_chain"])

async def check_word(lang: str, word: str) -> None:
    spell = SpellChecker(language=lang)
    misspelled = spell.unknown([word]) 
    return misspelled

with open("eng_words.csv", encoding="utf-8") as content:
    eng_words = list(csv.DictReader(content))

with open("germany_words.csv", encoding="utf-8") as content:
    germany_words = list(csv.DictReader(content))

@router.post("/add_word/{word}/{lang}")  
async def add_word(
    word: str,
    lang: str,
    payload: TokenPayload = Depends(security.access_token_required),
    db: Session = Depends(get_db),
):
    normalized_word = word.lower()
    checking = await check_word(lang=lang, word=normalized_word)
    if checking:
        raise HTTPException(status_code=400, detail="Incorrect word")
 
    user_id = int(payload.sub)
    svc = WordChainServices(db)
    entry = svc.add_word(user_id=user_id, word=normalized_word)
    if entry:
        return {"detail": "The word has been saved."}
    raise HTTPException(status_code=400, detail="The word already exsist")


@router.delete("/")
async def clear_user_used_word(
    payload: TokenPayload = Depends(security.access_token_required),
    db: Session = Depends(get_db),
):
    user_id = int(payload.sub)
    svc = WordChainServices(db)
    svc.clear_words(user_id=user_id)
    return {"detail": "Word chain reset."}


@router.post("/bot_word/{lang}")
async def bot_word(
    data: WordOut,
    lang: str,
    payload: TokenPayload = Depends(security.access_token_required),
    db: Session = Depends(get_db),
) -> dict[str, str] | None:
    player_word = (data.word or "").strip().lower()
    if not player_word:
        raise HTTPException(status_code=400, detail="Word is required.")
    user_id = int(payload.sub)
    svc = WordChainServices(db)
    history = svc.get_words(user_id=user_id)
    used_words = {item.used_word.lower() for item in history}
    used_words.add(player_word)

    first_letter = player_word[-1]
    attempts = len(history)
    words_list = eng_words if lang == "en" else germany_words

    candidates = [
        w["word"]
        for w in words_list
        if w["word"].lower().startswith(first_letter) and w["word"].lower() not in used_words
    ]

    if not candidates:
        return None  # бот не знает слов → игрок победил

    if attempts >= 80:
        if randint(1, 10) > 7:
            return None

    word = choice(candidates)
    svc.add_word(user_id=user_id, word=word)
    return {"word": word}
