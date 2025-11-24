from fastapi import APIRouter
from random import choice
import csv

router = APIRouter(prefix="/wordle_random_word", tags=["Wordle"])

with open("eng_words.csv", encoding="utf-8") as content:
    eng_words = list(csv.DictReader(content))

with open("germany_words.csv", encoding="utf-8") as content:
    germany_words = list(csv.DictReader(content))

@router.get("/{lang}_{target}")
async def wordle_get(lang: str, target: int):

    if lang == "de":
        words_csv = germany_words
    else:
        words_csv = eng_words

    while True:
        word = choice(words_csv)["word"]
        if len(word) == target:
            return word
