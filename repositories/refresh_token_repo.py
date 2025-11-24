from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from models.refresh_token import RefreshToken


class RefreshTokenRepository:
    def __init__(self, db: Session):
        self.db = db

    def _commit(self) -> None:
        self.db.commit()

    def add(self, *, user_id: int, jti: str, expires_at: datetime) -> RefreshToken:
        token = RefreshToken(user_id=user_id, jti=jti, expires_at=expires_at)
        self.db.add(token)
        self._commit()
        self.db.refresh(token)
        return token

    def replace_for_user(self, *, user_id: int, jti: str, expires_at: datetime) -> RefreshToken:
        self.db.execute(delete(RefreshToken).where(RefreshToken.user_id == user_id))
        self._commit()
        return self.add(user_id=user_id, jti=jti, expires_at=expires_at)

    def get_by_jti(self, jti: str) -> RefreshToken | None:
        return self.db.execute(select(RefreshToken).where(RefreshToken.jti == jti)).scalar_one_or_none()

    def revoke(self, jti: str) -> None:
        token = self.get_by_jti(jti)
        if token:
            token.mark_revoked()
            self.db.add(token)
            self._commit()

    def assert_active(self, *, jti: str, user_id: int) -> RefreshToken:
        token = self.get_by_jti(jti)
        now = datetime.now(timezone.utc)
        if not token or token.user_id != user_id:
            raise PermissionError("Refresh token is not registered")
        if token.revoked:
            raise PermissionError("Refresh token has been revoked")
        if token.expires_at <= now:
            token.mark_revoked()
            self.db.add(token)
            self._commit()
            raise PermissionError("Refresh token has expired")
        return token
