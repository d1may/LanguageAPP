"""add theme to users

Revision ID: 7d15b6434bfe
Revises: c8b28dca2c1a
Create Date: 2025-02-14 12:34:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "7d15b6434bfe"
down_revision: Union[str, Sequence[str], None] = "c8b28dca2c1a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("theme", sa.String(length=20), nullable=False, server_default="default")
        )


def downgrade() -> None:
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_column("theme")
