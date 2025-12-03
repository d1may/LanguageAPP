from pydantic import BaseModel, ConfigDict, constr, field_validator


class DeckCreateIn(BaseModel):
    title: constr(strip_whitespace=True, min_length=1, max_length=50)
    description: constr(strip_whitespace=True, min_length=1, max_length=50)
    category: constr(strip_whitespace=True, min_length=1, max_length=50) | None = None

    @field_validator("category", mode="before")
    @classmethod
    def _empty_category_to_none(cls, value: str | None):
        if value is None:
            return None
        if isinstance(value, str):
            trimmed = value.strip()
            return trimmed or None
        return value


class DeckOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str
    category: str | None = None


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


class FlashcardWordUpdateIn(FlashcardWordCreateIn):
    pass
