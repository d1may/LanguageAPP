from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from repositories.user_repo import UserRepository
from core.security import hash_password, verify_password, create_access_token, create_refresh_token, _to_plain
from typing import Union
from pydantic import SecretStr

class AuthService:
    def __init__(self, db: Session):
        self.repo = UserRepository(db)


    def register(self, *, email: str, username: str, password: Union[str, SecretStr]):
        if self.repo.get_by_email(email):
            raise HTTPException(status_code=400, detail="Email already registered")
        if self.repo.get_by_username(username):
            raise HTTPException(status_code=400, detail="Username already taken")
        user = self.repo.create(email=email, username=username, password_hash=hash_password(password))
        return user


    def login(self, *, email: str, password: Union[str, SecretStr]):
        user = self.repo.get_by_email(email)
        if not user or not verify_password(password, user.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
        return user
        