import csv
from random import choice

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from authx import TokenPayload

from core.database import get_db
from schemas.word import WordRatingIn, WordRatingOut, WordListOut, WordLibraryOut, WordLibraryUpdateIn
from services.word_services import WordServices
from models.user import User
from models.randomWordList import WordList
from .auth import security


router = APIRouter(prefix="/words", tags=["words"])

with open("eng_words.csv", encoding="utf-8") as content:
    eng_words = list(csv.DictReader(content))

with open("germany_words.csv", encoding="utf-8") as content:
    germany_words = list(csv.DictReader(content))

LANG_DECKS = {
    "en": eng_words,
    "english": eng_words,
    "de": germany_words,
    "germany": germany_words,
}

VALID_LANGS = {"en", "de"}


def serialize_word(word: WordList) -> WordListOut:
    return WordListOut(
        id=word.id,
        word=word.word,
        status=word.status,
        translate=word.translate,
        comment=word.comment,
        word_lang=word.lang,
    )


def serialize_word_list(words):
    return [serialize_word(word) for word in words]


@router.get("/random/{lang}")
async def get_random_word(lang: str):
    deck = LANG_DECKS.get(lang.lower())
    if not deck:
        raise HTTPException(status_code=404, detail="Language is not supported")
    return {"word": choice(deck)["word"]}

@router.post("/rate", response_model=WordRatingOut)
async def rate_word(
    data: WordRatingIn,
    payload: TokenPayload = Depends(security.access_token_required),
    db: Session = Depends(get_db),
):
    user_id = int(payload.sub)
    svc = WordServices(db)
    entity = svc.save_rating(
        user_id=user_id,
        word=data.word,
        status=data.status,
        translate=None,
        comment=None,
        lang=data.word_lang,
    )
    return WordRatingOut(
        id=entity.id,
        word=entity.word,
        status=entity.status,
        word_lang=entity.lang,
    )

@router.get("/all_random_words_by_id", response_model=list[WordListOut])
async def get_all_random_words(
    payload: TokenPayload = Depends(security.access_token_required),
    db: Session = Depends(get_db),
):
    user_id = int(payload.sub)
    svc = WordServices(db)
    lang = resolve_user_lang(db, user_id)
    list_words = svc.get_user_words(user_id, lang=lang)
    return serialize_word_list(list_words)


@router.get("/library", response_model=WordLibraryOut)
async def get_word_library(
    payload: TokenPayload = Depends(security.access_token_required),
    db: Session = Depends(get_db),
):
    user_id = int(payload.sub)
    svc = WordServices(db)
    lang = resolve_user_lang(db, user_id)
    snapshot = svc.get_library_snapshot(user_id, lang=lang)
    return {
        "recent": serialize_word_list(snapshot["recent"]),
        "buckets": {
            "high": serialize_word_list(snapshot["high"]),
            "medium": serialize_word_list(snapshot["medium"]),
            "low": serialize_word_list(snapshot["low"]),
        },
    }


@router.put("/library/{word_id}", response_model=WordListOut)
async def update_word_in_library(
    word_id: int,
    data: WordLibraryUpdateIn,
    payload: TokenPayload = Depends(security.access_token_required),
    db: Session = Depends(get_db),
):
    update_payload = data.dict(exclude_unset=True)
    if not update_payload:
        raise HTTPException(status_code=400, detail="Nothing to update")

    user_id = int(payload.sub)
    svc = WordServices(db)
    entity = svc.update_word_meta(user_id=user_id, word_id=word_id, **update_payload)
    if not entity:
        raise HTTPException(status_code=404, detail="Word not found")
    return serialize_word(entity)


def resolve_user_lang(db: Session, user_id: int) -> str:
    user = db.get(User, user_id)
    lang = (user.random_word_lang if user else None) or "en"
    lang = lang.lower()
    return lang if lang in VALID_LANGS else "en"

@router.get("/random_session_words")
async def get_random_session_words(payload: TokenPayload = Depends(security.access_token_required), db: Session = Depends(get_db)):
    user_id = int(payload.sub)
    svc = WordServices(db)
    entity = svc.get_random_session_words(user_id=user_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Session not found")
    return entity

@router.put("/random_session_words")
async def increment_random_session_words(payload: TokenPayload = Depends(security.access_token_required), db: Session = Depends(get_db)):
    user_id = int(payload.sub)
    svc = WordServices(db)
    try:
        entity = svc.record_result(user_id=user_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Session not found")
    return entity
