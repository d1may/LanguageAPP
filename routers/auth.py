from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from authx import AuthX, AuthXConfig, TokenPayload
from core.config import settings
from core.database import SessionLocal, get_db
from models.user import User
from schemas.auth import LoginIn, RegisterIn, UserOut
from schemas.settings_user import UserSettingsIn, UserSettingsOut
from repositories.refresh_token_repo import RefreshTokenRepository
from services.auth_services import AuthService
router = APIRouter(prefix="/user", tags=["user"])

_cookie_samesite = settings.JWT_COOKIE_SAMESITE.lower() if settings.JWT_COOKIE_SAMESITE else None
_cookie_domain = settings.JWT_COOKIE_DOMAIN or None

config = AuthXConfig(
    JWT_SECRET_KEY=settings.SECRET_KEY,
    JWT_ALGORITHM=settings.JWT_ALG,
    JWT_ACCESS_TOKEN_EXPIRES=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    JWT_REFRESH_TOKEN_EXPIRES=timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    JWT_TOKEN_LOCATION=["cookies"],
    JWT_ACCESS_COOKIE_NAME=settings.JWT_ACCESS_COOKIE_NAME,
    JWT_REFRESH_COOKIE_NAME=settings.JWT_REFRESH_COOKIE_NAME,
    JWT_COOKIE_SAMESITE=_cookie_samesite or "lax",
    JWT_COOKIE_SECURE=settings.JWT_COOKIE_SECURE,
    JWT_COOKIE_DOMAIN=_cookie_domain,
    JWT_COOKIE_CSRF_PROTECT=settings.JWT_COOKIE_CSRF_PROTECT,
)

security = AuthX(config=config)


def _decode_token(token: str) -> TokenPayload:
    return TokenPayload.decode(
        token=token,
        key=security.config.public_key,
        algorithms=[security.config.JWT_ALGORITHM],
    )


def _exp_to_datetime(exp_value: float | int | datetime) -> datetime:
    if isinstance(exp_value, datetime):
        return exp_value if exp_value.tzinfo else exp_value.replace(tzinfo=timezone.utc)
    return datetime.fromtimestamp(exp_value, tz=timezone.utc)


def _ensure_refresh_metadata(payload: TokenPayload) -> tuple[str, datetime]:
    if payload.jti is None:
        raise ValueError("Refresh token does not contain jti")
    if payload.exp is None:
        raise ValueError("Refresh token missing expiry")
    expiry = _exp_to_datetime(payload.exp)
    return payload.jti, expiry


def _is_token_revoked(token: str, **_: Any) -> bool:
    try:
        payload = _decode_token(token)
    except Exception:
        return True

    if payload.type != "refresh" or payload.jti is None:
        return False

    db = SessionLocal()
    try:
        repo = RefreshTokenRepository(db)
        stored = repo.get_by_jti(payload.jti)
        if stored is None:
            return True
        if stored.revoked:
            return True
        expires_at = stored.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at <= datetime.now(timezone.utc):
            stored.mark_revoked()
            db.add(stored)
            db.commit()
            return True
        return False
    finally:
        db.close()


security.set_token_blocklist(_is_token_revoked)

@router.post("/register")
async def post_reg(data: RegisterIn, db: Session = Depends(get_db)):
    svc = AuthService(db)
    user = svc.register(email=data.email, username=data.username, password=data.password)
    return UserOut(id=user.id, email=user.email, username=user.username)
    

@router.post("/login")
async def post_login(response: Response, data: LoginIn, db: Session = Depends(get_db)):
    svc = AuthService(db)
    user = svc.login(email=data.email, password=data.password)

    access_token = security.create_access_token(uid=str(user.id))
    refresh_token = security.create_refresh_token(uid=str(user.id))

    refresh_payload = _decode_token(refresh_token)
    jti, expires_at = _ensure_refresh_metadata(refresh_payload)
    RefreshTokenRepository(db).replace_for_user(user_id=user.id, jti=jti, expires_at=expires_at)

    security.set_access_cookies(access_token, response)
    security.set_refresh_cookies(refresh_token, response)

    return {"status": "ok"}

@router.get("/me", dependencies=[Depends(security.access_token_required)])
async def me(payload: TokenPayload = Depends(security.access_token_required)):
    return {"user_id": payload.sub}

@router.post("/logout")
async def logout(
    response: Response,
    payload: TokenPayload = Depends(security.refresh_token_required),
    db: Session = Depends(get_db),
):
    if payload.jti:
        RefreshTokenRepository(db).revoke(payload.jti)
    security.unset_cookies(response)
    cookie_kwargs = {
        "path": "/",
        "domain": _cookie_domain,
        "httponly": True,
        "samesite": _cookie_samesite or "lax",
        "secure": settings.JWT_COOKIE_SECURE,
    }
    csrf_kwargs = {
        "path": "/",
        "domain": _cookie_domain,
        "httponly": False,
        "samesite": _cookie_samesite or "lax",
        "secure": settings.JWT_COOKIE_SECURE,
    }

    access_cookie_names = {
        settings.JWT_ACCESS_COOKIE_NAME,
        security.config.JWT_ACCESS_COOKIE_NAME,
        "access_token",
        "access_token_cookie",
        "my_access_token",
    }
    refresh_cookie_names = {
        settings.JWT_REFRESH_COOKIE_NAME,
        security.config.JWT_REFRESH_COOKIE_NAME,
        "refresh_token",
        "refresh_token_cookie",
        "my_refresh_token",
    }
    csrf_cookie_names = {
        "csrf_access_token",
        security.config.JWT_ACCESS_CSRF_COOKIE_NAME,
        "csrf_refresh_token",
        security.config.JWT_REFRESH_CSRF_COOKIE_NAME,
    }

    for name in filter(None, access_cookie_names):
        response.delete_cookie(name, **cookie_kwargs)
    for name in filter(None, refresh_cookie_names):
        response.delete_cookie(name, **cookie_kwargs)
    for name in filter(None, csrf_cookie_names):
        response.delete_cookie(name, **csrf_kwargs)
    return {"ok": True}

@router.post("/refresh")
async def refresh(
    response: Response,
    payload: TokenPayload = Depends(security.refresh_token_required),
    db: Session = Depends(get_db),
):
    try:
        user_id = int(payload.sub)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid subject in token") from exc

    if payload.jti is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token missing identifier")

    repo = RefreshTokenRepository(db)
    try:
        repo.assert_active(jti=payload.jti, user_id=user_id)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    repo.revoke(payload.jti)

    new_access = security.create_access_token(uid=str(user_id))
    new_refresh = security.create_refresh_token(uid=str(user_id))

    new_refresh_payload = _decode_token(new_refresh)
    new_jti, new_expiry = _ensure_refresh_metadata(new_refresh_payload)
    repo.add(user_id=user_id, jti=new_jti, expires_at=new_expiry)

    security.set_access_cookies(new_access, response)
    security.set_refresh_cookies(new_refresh, response)

    return {"status": "ok"}

@router.get(
    "/settings",
    response_model=UserSettingsOut,
    dependencies=[Depends(security.access_token_required)]
)
async def get_settings(
    payload: TokenPayload = Depends(security.access_token_required),
    db: Session = Depends(get_db),
):
    user_id = int(payload.sub)
    user = db.get(User, user_id)

    return UserSettingsOut(random_word_lang=user.random_word_lang or "en")


@router.put(
    "/settings",
    response_model=UserSettingsOut,
    dependencies=[Depends(security.access_token_required)]
)
async def update_settings(
    data: UserSettingsIn,
    payload: TokenPayload = Depends(security.access_token_required),
    db: Session = Depends(get_db),
):
    user_id = int(payload.sub)
    user = db.get(User, user_id)

    user.random_word_lang = data.random_word_lang
    db.add(user)
    db.commit()
    db.refresh(user)

    return UserSettingsOut(random_word_lang=user.random_word_lang)
