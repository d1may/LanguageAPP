from sqlalchemy import Column, ForeignKey, Integer, String, UniqueConstraint, DateTime
from datetime import datetime

from core.database import Base


class FlashcardWordList(Base):
    __tablename__ = "flashcard_words"
    __table_args__ = (UniqueConstraint("deck_id", "word", name="uq_flashcard_words_deck_word"),)

    id = Column(Integer, primary_key=True)
    deck_id = Column(Integer, ForeignKey("cardDecks.id", ondelete="CASCADE"), nullable=False, index=True)
    word = Column(String(50), nullable=False, index=True)
    definition = Column(String(255), nullable=False, index=True)
    example = Column(String(255), nullable=True, index=True)
    difficulty = Column(String(50), nullable=True, index=True)
    last_review = Column(DateTime, default=datetime.utcnow, nullable=True)
