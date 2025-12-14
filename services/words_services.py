from sqlalchemy.orm import Session

from models.wordChain import WordChainList
from repositories.wordChain_repo import WordChainRepository


class WordChainServices:
    def __init__(self, db: Session):
        self.repo = WordChainRepository(db)

    def add_word(self, *, user_id: int, word: str) -> WordChainList | None:
        return self.repo.add_used_word(user_id=user_id, word=word)

    def get_words(self, *, user_id: int, limit: int | None = None) -> list[WordChainList]:
        return self.repo.get_used_words(user_id=user_id, limit=limit)

    def clear_words(self, *, user_id: int) -> None:
        self.repo.clear_user_words(user_id=user_id)
