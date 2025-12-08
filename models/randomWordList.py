from sqlalchemy import Column, Integer, String, ForeignKey, UniqueConstraint
from core.database import Base

class WordList(Base):
    __tablename__ = "user_words"
    __table_args__ = (
        UniqueConstraint("user_id", "word", name="uq_user_words_user_word"),
    )
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    word = Column(String(50), nullable=False, index=True)
    status = Column(String(50), nullable=False, index=True)
    translate = Column(String(50), nullable=True, index=True)
    comment = Column(String(50), nullable=True, index=True)
    lang = Column(String(50), nullable=False, index=True)