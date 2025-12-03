from sqlalchemy.orm import Session
from sqlalchemy import select
from models.flashcard import FlashcardDecks


class DeckRepository:
    def __init__(self, db: Session):
        self.db = db

    def save_deck(self, *, user_id: int, title: str, description: str, category: str | None) -> FlashcardDecks:
        stmt = select(FlashcardDecks).where(
            FlashcardDecks.user_id == user_id,
            FlashcardDecks.title == title,
        )

        existing = self.db.execute(stmt).scalar_one_or_none()

        if existing:
            entity = existing
            entity.description = description
            entity.category = category
        else:
            entity = FlashcardDecks(
                user_id=user_id,
                title=title,
                description=description,
                category=category,
            )
            self.db.add(entity)

        self.db.commit()
        self.db.refresh(entity)
        return entity

    def list_decks(self, user_id: int) -> list[FlashcardDecks]:
        stmt = (
            select(FlashcardDecks)
            .where(FlashcardDecks.user_id == user_id)
            .order_by(FlashcardDecks.id.desc())
        )
        return list(self.db.execute(stmt).scalars())

    def get_deck(self, deck_id: int, user_id: int) -> FlashcardDecks | None:
        stmt = select(FlashcardDecks).where(
            FlashcardDecks.id == deck_id,
            FlashcardDecks.user_id == user_id,
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def delete_deck(self, *, deck_id: int, user_id: int) -> bool:
        deck = self.get_deck(deck_id, user_id)
        if deck is None:
            return False
        self.db.delete(deck)
        self.db.commit()
        return True

    def update_deck(
        self,
        *,
        deck_id: int,
        user_id: int,
        title: str,
        description: str,
        category: str | None,
    ) -> FlashcardDecks | None:
        deck = self.get_deck(deck_id, user_id)
        if deck is None:
            return None
        # Ensure another deck owned by the same user does not already use this title
        stmt = select(FlashcardDecks).where(
            FlashcardDecks.user_id == user_id,
            FlashcardDecks.title == title,
            FlashcardDecks.id != deck_id,
        )
        existing = self.db.execute(stmt).scalar_one_or_none()
        if existing:
            raise ValueError("Deck with this title already exists")
        deck.title = title
        deck.description = description
        deck.category = category
        self.db.commit()
        self.db.refresh(deck)
        return deck
