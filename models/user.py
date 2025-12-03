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
    theme = Column(String(20), nullable=False, server_default="amber")


