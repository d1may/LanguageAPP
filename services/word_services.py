from sqlalchemy.orm import Session

from models.randomWordList import WordList
from repositories.random_word_repo import WordRepository
from repositories.user_repo import UserRepository


class WordServices:
    UNSET = object()

    def __init__(self, db: Session):
        self.repo = WordRepository(db)
        self.user_repo = UserRepository(db)

    def save_rating(self, *, user_id: int, word: str, status: str, translate: str, comment: str, lang: str) -> WordList:
        return self.repo.save_user_word(user_id=user_id, word=word, status=status, translate=translate, comment=comment, lang=lang)

    def update_word_meta(
        self,
        *,
        user_id: int,
        word_id: int,
        translate=UNSET,
        comment=UNSET,
    ) -> WordList | None:
        def normalize(value):
            if value is self.UNSET:
                return self.UNSET
            if value is None:
                return None
            value = value.strip()
            return value or None

        updates = {}
        normalized_translate = normalize(translate)
        normalized_comment = normalize(comment)
        if normalized_translate is not self.UNSET:
            updates["translate"] = normalized_translate
        if normalized_comment is not self.UNSET:
            updates["comment"] = normalized_comment
        if not updates:
            return None
        return self.repo.update_user_word(
            user_id=user_id,
            word_id=word_id,
            updates=updates,
        )

    def get_user_words(self, user_id: int, limit: int = 10, lang: str | None = None) -> list[WordList]:
        return self.repo.get_all_words(user_id, limit=limit, lang=lang)

    def get_words_by_status(self, user_id: int, status: str, limit: int = 10, lang: str | None = None) -> list[WordList]:
        return self.repo.get_words_by_status(user_id, status=status, limit=limit, lang=lang)

    def get_library_snapshot(self, user_id: int, limit: int = 10, lang: str | None = None) -> dict[str, list[WordList]]:
        return {
            "recent": self.repo.get_all_words(user_id, limit=limit, lang=lang),
            "high": self.repo.get_words_by_status(user_id, status="easy", limit=limit, lang=lang),
            "medium": self.repo.get_words_by_status(user_id, status="ok", limit=limit, lang=lang),
            "low": self.repo.get_words_by_status(user_id, status="hard", limit=limit, lang=lang),
        }
    def get_random_session_words(self, *, user_id: int) -> dict:
        return self.user_repo.get_random_session_words(user_id=user_id)

    def record_result(self, *, user_id: int) -> dict:
        return self.user_repo.record_random_session_words(user_id=user_id)
