from typing import Annotated

from fastapi import APIRouter, Depends

from app.auth.dependencies import create_token, get_current_user
from app.auth.schemas import LoginRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest):
    token = create_token({"sub": request.username, "role": request.role})
    return TokenResponse(access_token=token)


@router.get("/me")
def me(user: Annotated[dict, Depends(get_current_user)]) -> dict:
    return user
