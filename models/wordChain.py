from sqlalchemy import Column, Integer, String, ForeignKey, UniqueConstraint
from core.database import Base

class WordChainList(Base):
    __tablename__ = "word_chain"
    __table_args__ = (
        UniqueConstraint("user_id", "used_word", name="uq_user_word_chain"),
    )
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    used_word = Column(String(50), nullable=False, index=True)
