"""add user-specific word ratings

Revision ID: 9fefc8991a0c
Revises: d77a86acfb9c
Create Date: 2025-02-14 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9fefc8991a0c"
down_revision: Union[str, Sequence[str], None] = "d77a86acfb9c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = inspector.get_table_names()
    table_exists = "user_words" in tables

    if not table_exists:
        op.create_table(
            "user_words",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("word", sa.String(length=50), nullable=False),
            sa.Column("status", sa.String(length=50), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.UniqueConstraint("user_id", "word", name="uq_user_words_user_word"),
        )
        existing_indexes: set[str] = set()
    else:
        existing_indexes = {idx["name"] for idx in inspector.get_indexes("user_words")}

    with op.batch_alter_table("user_words", schema=None) as batch_op:
        if batch_op.f("ix_user_words_user_id") not in existing_indexes:
            batch_op.create_index(
                batch_op.f("ix_user_words_user_id"), ["user_id"], unique=False
            )
        if batch_op.f("ix_user_words_word") not in existing_indexes:
            batch_op.create_index(
                batch_op.f("ix_user_words_word"), ["word"], unique=False
            )
        if batch_op.f("ix_user_words_status") not in existing_indexes:
            batch_op.create_index(
                batch_op.f("ix_user_words_status"), ["status"], unique=False
            )


def downgrade() -> None:
    with op.batch_alter_table("user_words", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_user_words_status"))
        batch_op.drop_index(batch_op.f("ix_user_words_word"))
        batch_op.drop_index(batch_op.f("ix_user_words_user_id"))
    op.drop_table("user_words")
