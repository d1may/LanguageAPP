from typing import Literal

from pydantic import BaseModel, ConfigDict, constr, field_validator

LANG_NORMALIZER = {
    "en": "en",
    "english": "en",
    "eng": "en",
    "de": "de",
    "german": "de",
    "deutsch": "de",
    "ger": "de",
}


class DeckCreateIn(BaseModel):
    title: constr(strip_whitespace=True, min_length=1, max_length=40)
    description: constr(strip_whitespace=True, min_length=1, max_length=45)
    category: constr(strip_whitespace=True, min_length=1, max_length=50) | None = None
    lang: str

    @field_validator("category", mode="before")
    @classmethod
    def _empty_category_to_none(cls, value: str | None):
        if value is None:
            return None
        if isinstance(value, str):
            trimmed = value.strip()
            return trimmed or None
        return value

    @field_validator("lang", mode="before")
    @classmethod
    def _normalize_lang(cls, value: str):
        if not value:
            raise ValueError("Language is required")
        normalized = LANG_NORMALIZER.get(value.strip().lower())
        if not normalized:
            raise ValueError("Language must be English or German")
        return normalized


class DeckOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str
    category: str | None = None
    lang: str


class DeckUpdateIn(DeckCreateIn):
    pass


class FlashcardWordCreateIn(BaseModel):
    word: constr(strip_whitespace=True, min_length=1, max_length=50)
    definition: constr(strip_whitespace=True, min_length=1, max_length=255)
    example: constr(strip_whitespace=True, min_length=1, max_length=255) | None = None

    @field_validator("example", mode="before")
    @classmethod
    def _empty_example_to_none(cls, value: str | None):
        if value is None:
            return None
        if isinstance(value, str):
            trimmed = value.strip()
            return trimmed or None
        return value


class FlashcardWordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    deck_id: int
    word: str
    definition: str
    example: str | None = None
    difficulty: str | None = None


class FlashcardWordUpdateIn(FlashcardWordCreateIn):
    pass


class FlashcardWordDifficultyIn(BaseModel):
    difficulty: Literal["easy", "medium", "hard"] | None = None


class FlashcardSessionOut(BaseModel):
    lang: str
    cards: list[FlashcardWordOut]
