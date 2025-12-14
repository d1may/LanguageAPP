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
spell = SpellChecker()

with open("eng_words.csv", encoding="utf-8") as content:
    eng_words = list(csv.DictReader(content))

@router.get("/add_word/{word}")
async def add_word(
    word: str,
    payload: TokenPayload = Depends(security.access_token_required),
    db: Session = Depends(get_db),
):
    misspelled = spell.unknown([word])
    if misspelled:
        return {"status": "False", "comment": "incorrect word"}
    user_id = int(payload.sub)
    svc = WordChainServices(db)
    entry = svc.add_word(user_id=user_id, word=word)
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


@router.post("/bot_word")
async def bot_word(
    data: WordOut,
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

    candidates = [
        w["word"]
        for w in eng_words
        if w["word"].lower().startswith(first_letter) and w["word"].lower() not in used_words
    ]

    if not candidates:
        return None  # бот не знает слов → игрок победил

    if attempts >= 40:
        if randint(1, 10) > 7:
            return None

    if attempts >= 60:
        if randint(1, 10) > 5:
            return None

    word = choice(candidates)
    svc.add_word(user_id=user_id, word=word)
    return {"word": word}
