from sqlalchemy import Column, Integer, String, DateTime, func, ForeignKey, UniqueConstraint
from core.database import Base
# from datetime import datetime

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    random_word_lang = Column(String(2), nullable=False, server_default="en")
    theme = Column(String(20), nullable=False, server_default="arctic")
    wordle_game = Column(Integer, nullable=False, server_default="0")
    wordle_wins = Column(Integer, nullable=False, server_default="0")
    wordle_losses = Column(Integer, nullable=False, server_default="0")
    wordle_win_streak = Column(Integer, nullable=False, server_default="0")
    random_session_words = Column(Integer, nullable=False, server_default="0")
    # last_time = Column(DateTime, default=datetime.utcnow, nullable=True)
