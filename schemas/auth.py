from pydantic import BaseModel, EmailStr, Field, SecretStr, AfterValidator
import re
from typing import Annotated

PASSWORD_REGEX = re.compile(
    r"^[A-Za-z0-9!@#$%^&*()_\-+=\[\]{};:'\",.<>/?|`~]+$"
)

def validate_password(v: SecretStr) -> SecretStr:
    password = v.get_secret_value()

    # 1. Длина
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long")

    # 2. Без пробелов
    if " " in password:
        raise ValueError("Password must not contain spaces")

    # 3. Только английские буквы + цифры + специальные символы
    if not PASSWORD_REGEX.fullmatch(password):
        raise ValueError(
            "Password may contain only English letters, digits and special symbols"
        )

    return v


ValidatePassword = Annotated[SecretStr, AfterValidator(validate_password)]

class CreateUserRequest(BaseModel):
   password: ValidatePassword


class RegisterIn(BaseModel):

    email : EmailStr
    username: str = Field(min_length=3, max_length=50)
    password: ValidatePassword

class LoginIn(BaseModel):

    email : EmailStr
    password: str = Field(min_length=6, max_length=128)

class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: int
    email: EmailStr
    username: str