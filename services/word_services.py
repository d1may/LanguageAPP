from sqlalchemy.orm import Session

from models.user import WordList
from repositories.word_repo import WordRepository


class WordServices:
    def __init__(self, db: Session):
        self.repo = WordRepository(db)

    def save_rating(self, *, user_id: int, word: str, status: str, translate: str, comment: str, lang: str) -> WordList:
        return self.repo.save_user_word(user_id=user_id, word=word, status=status, translate=translate, comment=comment, lang=lang)

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
