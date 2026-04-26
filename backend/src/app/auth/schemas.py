from typing import Literal

from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    role: Literal["operator", "officer"]


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
