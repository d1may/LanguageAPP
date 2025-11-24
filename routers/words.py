from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from random import choice
import csv
from core.database import get_db
from .auth import security
from authx import TokenPayload


router = APIRouter(prefix="/words", tags=["words"])

with open("eng_words.csv", encoding="utf-8") as content:
    eng_words = list(csv.DictReader(content))

with open("germany_words.csv", encoding="utf-8") as content:
    germany_words = list(csv.DictReader(content))


@router.get("/{lang}")
async def get_random_word(lang: str):
    if lang == "germany":
        return {"word": choice(germany_words)["word"]}
    return {"word": choice(eng_words)["word"]}
