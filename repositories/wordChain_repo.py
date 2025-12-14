from sqlalchemy.orm import Session
from sqlalchemy import select, delete
from models.wordChain import WordChainList


class WordChainRepository:
    def __init__(self, db: Session):
        self.db = db

    def add_used_word(self, *, user_id: int, word: str) -> WordChainList:
        stmt = select(WordChainList).where(
            WordChainList.user_id == user_id,
            WordChainList.used_word == word,
        )
        existing = self.db.execute(stmt).scalar_one_or_none()

        if existing:
            return None
        else:
            entity = WordChainList(user_id=user_id, used_word=word)
            self.db.add(entity)

        self.db.commit()
        self.db.refresh(entity)
        return entity
    
    def get_used_words(self, user_id: int, limit: int | None = None) -> list[WordChainList]:
        stmt = (
            select(WordChainList)
            .where(WordChainList.user_id == user_id)
            .order_by(WordChainList.id.desc())
        )
        if limit is not None:
            stmt = stmt.limit(limit)
        return list(self.db.execute(stmt).scalars())

    def clear_user_words(self, user_id: int) -> None:
        stmt = delete(WordChainList).where(WordChainList.user_id == user_id)
        self.db.execute(stmt)
        self.db.commit()
