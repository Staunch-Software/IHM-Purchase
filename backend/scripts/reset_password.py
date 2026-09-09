"""Reset a user's password.

Usage:
    python -m scripts.reset_password --email user@example.com --password NewPass@123
"""
import argparse
import asyncio
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select  # noqa: E402

from app.core.database import SessionLocal  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.models.user import User  # noqa: E402


async def reset_password(email: str, password: str):
    async with SessionLocal() as db:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalars().first()
        if not user:
            print(f"❌  User not found: {email}")
            return
        user.hashed_password = hash_password(password)
        await db.commit()
        print(f"✅  Password updated for {email}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    args = parser.parse_args()
    asyncio.run(reset_password(args.email, args.password))
