from sqlalchemy import Column, Integer, String, DateTime, func, ForeignKey, UniqueConstraint
from core.database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    random_word_lang = Column(String(2), nullable=False, server_default="en")


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
