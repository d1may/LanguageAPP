from datetime import datetime, timedelta
from sqlalchemy import select, func, or_, delete
from sqlalchemy.orm import Session
from datetime import datetime

from models.flashcardWordList import FlashcardWordList
from models.flashcard import FlashcardDecks


class FlashcardWordRepository:
    def __init__(self, db: Session):
        self.db = db

    def save_word(
        self,
        *,
        deck_id: int,
        word: str,
        definition: str,
        example: str | None = None,
        difficulty: str | None = None,
    ) -> FlashcardWordList:
        stmt = select(FlashcardWordList).where(
            FlashcardWordList.deck_id == deck_id,
            FlashcardWordList.word == word,
        )
        entity = self.db.execute(stmt).scalar_one_or_none()

        if entity:
            entity.definition = definition
            entity.example = example
            if difficulty is not None:
                entity.difficulty = difficulty
        else:
            entity = FlashcardWordList(
                deck_id=deck_id,
                word=word,
                definition=definition,
                example=example,
                difficulty=difficulty,
            )
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

    def count_words_for_user(self, user_id: int) -> int:
        stmt = (
            select(func.count(FlashcardWordList.id))
            .join(FlashcardDecks, FlashcardDecks.id == FlashcardWordList.deck_id)
            .where(FlashcardDecks.user_id == user_id)
        )
        return self.db.execute(stmt).scalar_one()

    def count_due_cards(self, deck_ids: list[int]) -> int:
        if not deck_ids:
            return 0
        cutoff = datetime.utcnow() - timedelta(days=3)
        stmt = (
            select(func.count(FlashcardWordList.id))
            .where(FlashcardWordList.deck_id.in_(deck_ids))
            .where(
                or_(
                    FlashcardWordList.last_review.is_(None),
                    FlashcardWordList.last_review <= cutoff,
                    FlashcardWordList.difficulty == "hard",
                    FlashcardWordList.difficulty.is_(None),
                )
            )
        )
        return self.db.execute(stmt).scalar_one()

    def update_difficulty(
        self,
        *,
        deck_id: int,
        word_id: int,
        difficulty: str | None = None,
    ) -> FlashcardWordList | None:
        stmt = select(FlashcardWordList).where(
            FlashcardWordList.id == word_id,
            FlashcardWordList.deck_id == deck_id,
        )
        entity = self.db.execute(stmt).scalar_one_or_none()
        if entity is None:
            return None
        normalized_current = (entity.difficulty or "").lower() or None
        normalized_new = (difficulty or "").lower() or None

        if normalized_new == "easy" and normalized_current in {None, "hard"}:
            entity.difficulty = "medium"
        else:
            entity.difficulty = normalized_new
        entity.last_review = datetime.utcnow()
        self.db.commit()
        self.db.refresh(entity)
        return entity

    def get_session_words_by_decks(self, deck_ids: list[int], limit: int = 10) -> list[FlashcardWordList]:
        if not deck_ids:
            return []

        cutoff = datetime.utcnow() - timedelta(days=3)
        stmt = (
            select(FlashcardWordList)
            .where(FlashcardWordList.deck_id.in_(deck_ids))
            .where(
                or_(
                    FlashcardWordList.last_review.is_(None),
                    FlashcardWordList.last_review <= cutoff,
                    FlashcardWordList.difficulty == "hard",
                    FlashcardWordList.difficulty.is_(None),
                )
            )
            .order_by(func.random())
            .limit(limit)
        )
        return list(self.db.execute(stmt).scalars())
