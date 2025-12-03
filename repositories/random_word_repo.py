from sqlalchemy.orm import Session
from sqlalchemy import select
from models.randomWordList import WordList


class WordRepository:
    def __init__(self, db: Session):
        self.db = db

    def save_user_word(self, *, user_id: int, word: str, status: str, translate: str, comment: str, lang: str) -> WordList:
        stmt = select(WordList).where(
            WordList.user_id == user_id,
            WordList.word == word,
        )
        existing = self.db.execute(stmt).scalar_one_or_none()

        if existing:
            existing.status = status
            entity = existing
        else:
            entity = WordList(user_id=user_id, word=word, status=status, translate=translate, comment=comment, lang=lang)
            self.db.add(entity)

        self.db.commit()
        self.db.refresh(entity)
        return entity

    def get_all_words(self, user_id: int, limit: int = 10, lang: str | None = None) -> list[WordList]:
        stmt = (
            select(WordList)
            .where(WordList.user_id == user_id)
            .order_by(WordList.id.desc())
            .limit(limit)
        )
        if lang:
            stmt = stmt.where(WordList.lang == lang)
        return list(self.db.execute(stmt).scalars())

    def get_words_by_status(self, user_id: int, status: str, limit: int = 10, lang: str | None = None) -> list[WordList]:
        stmt = (
            select(WordList)
            .where(
                WordList.user_id == user_id,
                WordList.status == status,
            )
            .order_by(WordList.id.desc())
            .limit(limit)
        )
        if lang:
            stmt = stmt.where(WordList.lang == lang)
        return list(self.db.execute(stmt).scalars())
