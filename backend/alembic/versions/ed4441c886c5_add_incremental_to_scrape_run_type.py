"""Add INCREMENTAL to scrape_run_type

Revision ID: ed4441c886c5
Revises: 8e50362642ef
Create Date: 2026-09-09 12:59:57.104101

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ed4441c886c5'
down_revision: Union[str, None] = '8e50362642ef'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Disable transactions since ALTER TYPE cannot be run inside a transaction block
    op.execute("ALTER TYPE scrape_run_type ADD VALUE IF NOT EXISTS 'INCREMENTAL'")


def downgrade() -> None:
    # PostgreSQL doesn't support dropping enum values easily, so we leave it
    pass
