from sqlalchemy import select
from sqlalchemy.orm import Session

from models.flashcardWordList import FlashcardWordList


class FlashcardWordRepository:
    def __init__(self, db: Session):
        self.db = db

    def save_word(self, *, deck_id: int, word: str, definition: str, example: str | None = None) -> FlashcardWordList:
        stmt = select(FlashcardWordList).where(
            FlashcardWordList.deck_id == deck_id,
            FlashcardWordList.word == word,
        )
        entity = self.db.execute(stmt).scalar_one_or_none()

        if entity:
            entity.definition = definition
            entity.example = example
        else:
            entity = FlashcardWordList(deck_id=deck_id, word=word, definition=definition, example=example)
            self.db.add(entity)

        self.db.commit()
        self.db.refresh(entity)
        return entity

    def get_words_by_deck_id(self, deck_id: int) -> list[FlashcardWordList]:
        stmt = select(FlashcardWordList).where(FlashcardWordList.deck_id == deck_id).order_by(FlashcardWordList.id.desc())
        return list(self.db.execute(stmt).scalars())

    def delete_word(self, *, deck_id: int, word_id: int) -> bool:
        stmt = select(FlashcardWordList).where(
            FlashcardWordList.id == word_id,
            FlashcardWordList.deck_id == deck_id,
        )
        entity = self.db.execute(stmt).scalar_one_or_none()
        if entity is None:
            return False

        self.db.delete(entity)
        self.db.commit()
        return True

    def update_word(self, *, deck_id: int, word_id: int, word: str, definition: str, example: str | None = None) -> FlashcardWordList | None:
        stmt = select(FlashcardWordList).where(
            FlashcardWordList.id == word_id,
            FlashcardWordList.deck_id == deck_id,
        )
        entity = self.db.execute(stmt).scalar_one_or_none()
        if entity is None:
            return None

        if entity.word != word:
            conflict_stmt = select(FlashcardWordList.id).where(
                FlashcardWordList.deck_id == deck_id,
                FlashcardWordList.word == word,
                FlashcardWordList.id != word_id,
            )
            conflict = self.db.execute(conflict_stmt).scalar_one_or_none()
            if conflict:
                raise ValueError("Word already exists in this deck")

        entity.word = word
        entity.definition = definition
        entity.example = example
        self.db.commit()
        self.db.refresh(entity)
        return entity
