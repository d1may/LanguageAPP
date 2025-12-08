from sqlalchemy.orm import Session

from repositories.user_repo import UserRepository


class WordleServices:
    def __init__(self, db: Session):
        self.repo = UserRepository(db)

    def get_stats(self, *, user_id: int) -> dict:
        return self.repo.get_wordle_stats(user_id=user_id)

    def record_result(self, *, user_id: int, is_win: bool) -> dict:
        return self.repo.record_wordle_result(user_id=user_id, is_win=is_win)
