"""update theme palette choices

Revision ID: 1b2b9a3e32bf
Revises: 7d15b6434bfe
Create Date: 2025-02-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "1b2b9a3e32bf"
down_revision: Union[str, Sequence[str], None] = "7d15b6434bfe"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


THEME_MAPPING = {
    "default": "home",
    "teal": "random",
    "amber": "wordle",
    "green": "flashcard",
}


def upgrade() -> None:
    conn = op.get_bind()
    for old_value, new_value in THEME_MAPPING.items():
        conn.execute(
            sa.text("UPDATE users SET theme = :new WHERE theme = :old"),
            {"new": new_value, "old": old_value},
        )

    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column(
            "theme",
            existing_type=sa.String(length=20),
            server_default="home",
        )


def downgrade() -> None:
    reverse_mapping = {new: old for old, new in THEME_MAPPING.items()}
    conn = op.get_bind()
    for new_value, old_value in reverse_mapping.items():
        conn.execute(
            sa.text("UPDATE users SET theme = :old WHERE theme = :new"),
            {"new": new_value, "old": old_value},
        )

    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column(
            "theme",
            existing_type=sa.String(length=20),
            server_default="default",
        )
