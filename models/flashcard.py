from sqlalchemy import Column, Integer, String, ForeignKey, UniqueConstraint
from core.database import Base


class FlashcardDecks(Base):
    __tablename__ = "cardDecks"
    __table_args__ = (
        UniqueConstraint("user_id", "title", name="uq_card_decks_user_title"),
    )

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(50), nullable=False, index=True)
    description = Column(String(50), nullable=False, index=True)
    category = Column(String(50), nullable=True, index=True)
    lang = Column(String(10), nullable=False, index=True)
 