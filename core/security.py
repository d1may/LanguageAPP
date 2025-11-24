from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from jose import jwt
from passlib.context import CryptContext
from core.config import settings
from typing import Union
from pydantic import SecretStr


pwd_ctx = CryptContext(schemes=["argon2"], deprecated="auto")

def _to_plain(p: Union[str, SecretStr]) -> str:
    return p.get_secret_value() if isinstance(p, SecretStr) else p

def hash_password(password: Union[str, SecretStr]) -> str:
    return pwd_ctx.hash(_to_plain(password))

def verify_password(plain: Union[str, SecretStr], hashed: str) -> bool:
    return pwd_ctx.verify(_to_plain(plain), hashed)




def _create_token(subject: str, expires_delta: timedelta, token_type: str) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
    "sub": subject,
    "type": token_type,
    "iat": int(now.timestamp()),
    "exp": int((now + expires_delta).timestamp()),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALG)




def create_access_token(sub: str) -> str:
    return _create_token(sub, timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES), "access")




def create_refresh_token(sub: str) -> str:
    return _create_token(sub, timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS), "refresh")




def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALG])
