from pydantic import BaseModel
from typing import Literal

class UserSettingsIn(BaseModel):
    random_word_lang: Literal["en", "de"]

class UserSettingsOut(BaseModel):
    random_word_lang: Literal["en", "de"]
