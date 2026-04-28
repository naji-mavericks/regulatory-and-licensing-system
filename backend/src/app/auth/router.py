import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import create_token, get_current_user
from app.auth.schemas import LoginRequest, TokenResponse
from app.database.session import get_db
from app.models import User

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Annotated[Session, Depends(get_db)]):
    user = db.query(User).filter(
        User.username == request.username,
        User.role == request.role,
    ).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
        )
    token = create_token({"sub": str(user.id), "role": user.role})
    return TokenResponse(access_token=token)


@router.get("/me")
def me(
    user: Annotated[dict, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    db_user = db.query(User).filter(User.id == uuid.UUID(user["sub"])).first()
    if db_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
        )
    return {
        "id": str(db_user.id),
        "username": db_user.username,
        "role": db_user.role,
        "full_name": db_user.full_name,
        "email": db_user.email,
        "phone": db_user.phone,
    }
