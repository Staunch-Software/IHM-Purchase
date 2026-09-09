import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.deps.auth import require_admin
from app.models.user import User
from app.schemas.user import UserCreate, UserOut, UserUpdate
from app.services import user_service

router = APIRouter(prefix="/users", tags=["users"], dependencies=[Depends(require_admin)])


@router.get("", response_model=list[UserOut])
async def list_users_endpoint(db: AsyncSession = Depends(get_db)):
    return await user_service.list_users(db)


@router.post("", response_model=UserOut, status_code=201)
async def create_user_endpoint(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    return await user_service.create_user(db, payload, created_by_id=current_admin.id)


@router.patch("/{user_id}", response_model=UserOut)
async def update_user_endpoint(user_id: uuid.UUID, payload: UserUpdate, db: AsyncSession = Depends(get_db)):
    return await user_service.update_user(db, user_id, payload)


@router.delete("/{user_id}", status_code=204)
async def delete_user_endpoint(user_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    await user_service.delete_user(db, user_id)
