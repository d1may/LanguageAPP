from sqlalchemy.orm import Session

from models.flashcard import FlashcardDecks
from models.flashcardWordList import FlashcardWordList
from repositories.flashcard_repo import DeckRepository
from repositories.flashcard_words_repo import FlashcardWordRepository


class FlashcardService:
    def __init__(self, db: Session):
        self.deck_repo = DeckRepository(db)
        self.word_repo = FlashcardWordRepository(db)

    def save_deck(
        self,
        *,
        user_id: int,
        title: str,
        description: str,
        category: str | None,
        lang: str,
    ) -> FlashcardDecks:
        return self.deck_repo.save_deck(
            user_id=user_id,
            title=title,
            description=description,
            category=category,
            lang=lang,
        )

    def list_decks(self, user_id: int) -> list[FlashcardDecks]:
        return self.deck_repo.list_decks(user_id)
        
    def list_decks_by_lang(self, user_id: int, lang: str) -> list[FlashcardDecks]:
        return self.deck_repo.get_deck_by_lang(user_id=user_id, lang=lang)

    def save_word(
        self,
        *,
        deck_id: int,
        word: str,
        definition: str,
        example: str | None = None,
        difficulty: str | None = None,
    ) -> FlashcardWordList:
        return self.word_repo.save_word(
            deck_id=deck_id,
            word=word,
            definition=definition,
            example=example,
            difficulty=difficulty,
        )

    def list_words(self, deck_id: int) -> list[FlashcardWordList]:
        return self.word_repo.get_words_by_deck_id(deck_id)

    def get_deck(self, *, user_id: int, deck_id: int) -> FlashcardDecks | None:
        return self.deck_repo.get_deck(deck_id, user_id)

    def delete_word(self, *, deck_id: int, word_id: int) -> bool:
        return self.word_repo.delete_word(deck_id=deck_id, word_id=word_id)

    def update_word(
        self,
        *,
        deck_id: int,
        word_id: int,
        word: str,
        definition: str,
        example: str | None = None,
    ) -> FlashcardWordList | None:
        return self.word_repo.update_word(
            deck_id=deck_id,
            word_id=word_id,
            word=word,
            definition=definition,
            example=example,
        )

    def delete_deck(self, *, user_id: int, deck_id: int) -> bool:
        return self.deck_repo.delete_deck(deck_id=deck_id, user_id=user_id)

    def update_deck(
        self,
        *,
        user_id: int,
        deck_id: int,
        title: str,
        description: str,
        category: str | None,
        lang: str,
    ) -> FlashcardDecks | None:
        return self.deck_repo.update_deck(
            deck_id=deck_id,
            user_id=user_id,
            title=title,
            description=description,
            category=category,
            lang=lang,
        )

    def count_user_cards(self, user_id: int) -> int:
        return self.word_repo.count_words_for_user(user_id)

    def count_due_cards(self, user_id: int) -> int:
        decks = self.deck_repo.list_decks(user_id)
        deck_ids = [deck.id for deck in decks]
        return self.word_repo.count_due_cards(deck_ids)

    def update_word_difficulty(
        self,
        *,
        deck_id: int,
        word_id: int,
        difficulty: str | None = None,
    ) -> FlashcardWordList | None:
        return self.word_repo.update_difficulty(deck_id=deck_id, word_id=word_id, difficulty=difficulty)

    def get_session_cards_for_lang(self, *, user_id: int, lang: str, limit: int = 10) -> list[FlashcardWordList]:
        decks = self.deck_repo.get_deck_by_lang(user_id=user_id, lang=lang)
        deck_ids = [deck.id for deck in decks]
        return self.word_repo.get_session_words_by_decks(deck_ids=deck_ids, limit=limit)
