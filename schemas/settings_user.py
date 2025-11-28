from pydantic import BaseModel
from typing import Literal


ThemeLiteral = Literal["amber", "sapphire"]
LangLiteral = Literal["en", "de"]


class UserSettingsIn(BaseModel):
    random_word_lang: LangLiteral
    theme: ThemeLiteral


class UserSettingsOut(BaseModel):
    random_word_lang: LangLiteral
    theme: ThemeLiteral
