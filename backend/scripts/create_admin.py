"""Seed the first admin user.

Usage:
    python -m scripts.create_admin --email admin@example.com --password secret --name "Admin User"
"""
import argparse
import asyncio
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select  # noqa: E402

from app.core.database import SessionLocal  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.models.user import RoleEnum, User  # noqa: E402


async def create_admin(email: str, password: str, name: str):
    async with SessionLocal() as db:
        existing = await db.execute(select(User).where(User.email == email))
        if existing.scalars().first():
            print(f"User {email} already exists.")
            return

        user = User(email=email, hashed_password=hash_password(password), full_name=name, role=RoleEnum.ADMIN)
        db.add(user)
        await db.commit()
        print(f"Admin user created: {email}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--name", default="Admin")
    args = parser.parse_args()

    asyncio.run(create_admin(args.email, args.password, args.name))
