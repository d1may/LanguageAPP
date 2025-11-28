from typing import Literal

from pydantic import BaseModel, constr


class WordRatingIn(BaseModel):
    word: constr(strip_whitespace=True, min_length=1, max_length=50)
    status: Literal["hard", "ok", "easy"]
    word_lang: Literal["en", "de"]


class WordRatingOut(BaseModel):
    id: int
    word: str
    status: Literal["hard", "ok", "easy"]
    word_lang: Literal["en", "de"]


class WordListOut(BaseModel):
    id: int
    word: str
    status: Literal["hard", "ok", "easy"]
    translate: constr(max_length=50) | None = None
    comment: constr(max_length=75) | None = None
    word_lang: Literal["en", "de"]


class WordLibraryBuckets(BaseModel):
    high: list[WordListOut]
    medium: list[WordListOut]
    low: list[WordListOut]


class WordLibraryOut(BaseModel):
    recent: list[WordListOut]
    buckets: WordLibraryBuckets
