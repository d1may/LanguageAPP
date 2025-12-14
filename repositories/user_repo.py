from sqlalchemy.orm import Session
from sqlalchemy import select
from models.user import User


class UserRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_email(self, email: str) -> User | None:
        return self.db.execute(select(User).where(User.email == email)).scalar_one_or_none()

    def get_by_username(self, username: str) -> User | None:
        return self.db.execute(select(User).where(User.username == username)).scalar_one_or_none()

    def get_by_id(self, user_id: int) -> User | None:
        return self.db.get(User, user_id)

    def _zero_or_value(self, value: int | None) -> int:
        return int(value or 0)

    def get_wordle_stats(self, user_id: int) -> dict:
        result = self.db.execute(
            select(
                User.wordle_game,
                User.wordle_wins,
                User.wordle_losses,
                User.wordle_win_streak,
            ).where(User.id == user_id)
        ).one_or_none()

        if result is None:
            return {"played": 0, "wins": 0, "losses": 0, "win_streak": 0}

        return {
            "played": self._zero_or_value(result.wordle_game),
            "wins": self._zero_or_value(result.wordle_wins),
            "losses": self._zero_or_value(result.wordle_losses),
            "win_streak": self._zero_or_value(result.wordle_win_streak),
        }

    def get_random_session_words(self, user_id: int) -> dict:
        result = self.db.execute(
            select(
                User.random_session_words,
            ).where(User.id == user_id)
        ).one_or_none()

        if result is None:
            return {"session_words": 0}

        return {"session_words": self._zero_or_value(result.random_session_words)}

    def record_random_session_words(self, user_id: int) -> dict:
        user = self.get_by_id(user_id)
        if user is None:
            raise ValueError("User not found")

        user.random_session_words = self._zero_or_value(user.random_session_words) + 1

        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return {"session_words": self._zero_or_value(user.random_session_words)}

    def refresh_random_session_words(self, user_id: int) -> dict:
        user = self.get_by_id(user_id)
        if user is None:
            raise ValueError("User not found")

        user.random_session_words = 0

        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return {"session_words": 0}

    def record_wordle_result(self, user_id: int, *, is_win: bool) -> dict:
        user = self.get_by_id(user_id)
        if user is None:
            raise ValueError("User not found")

        user.wordle_game = self._zero_or_value(user.wordle_game) + 1
        if is_win:
            user.wordle_wins = self._zero_or_value(user.wordle_wins) + 1
            user.wordle_win_streak = self._zero_or_value(user.wordle_win_streak) + 1
        else:
            user.wordle_losses = self._zero_or_value(user.wordle_losses) + 1
            user.wordle_win_streak = 0

        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return {
            "played": self._zero_or_value(user.wordle_game),
            "wins": self._zero_or_value(user.wordle_wins),
            "losses": self._zero_or_value(user.wordle_losses),
            "win_streak": self._zero_or_value(user.wordle_win_streak),
        }


    def create(self, *, email: str, username: str, password_hash: str) -> User:
        user = User(email=email, username=username, password_hash=password_hash)
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user
