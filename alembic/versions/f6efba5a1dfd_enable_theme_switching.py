"""enable theme switching between amber and sapphire

Revision ID: f6efba5a1dfd
Revises: 1b2b9a3e32bf
Create Date: 2024-03-20 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f6efba5a1dfd"
down_revision: Union[str, Sequence[str], None] = "1b2b9a3e32bf"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text(
            "UPDATE users SET theme = 'amber' "
            "WHERE theme NOT IN ('amber','sapphire') OR theme IS NULL"
        )
    )
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.alter_column(
            "theme",
            existing_type=sa.String(length=20),
            server_default="amber",
            existing_nullable=False,
        )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text(
            "UPDATE users SET theme = 'home' "
            "WHERE theme = 'amber' OR theme NOT IN ('home','random','wordle','flashcard')"
        )
    )
    conn.execute(
        sa.text(
            "UPDATE users SET theme = 'wordle' "
            "WHERE theme = 'sapphire'"
        )
    )
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.alter_column(
            "theme",
            existing_type=sa.String(length=20),
            server_default="home",
            existing_nullable=False,
        )
