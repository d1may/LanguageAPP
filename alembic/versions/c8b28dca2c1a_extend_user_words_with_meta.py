"""add translation/comment/lang columns

Revision ID: c8b28dca2c1a
Revises: 9fefc8991a0c
Create Date: 2025-02-14 12:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c8b28dca2c1a"
down_revision: Union[str, Sequence[str], None] = "9fefc8991a0c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("user_words", schema=None) as batch_op:
        batch_op.add_column(sa.Column("translate", sa.String(length=50), nullable=True))
        batch_op.add_column(
            sa.Column("comment", sa.String(length=50), nullable=True),
        )
        batch_op.add_column(
            sa.Column("lang", sa.String(length=50), nullable=False, server_default="en"),
        )
        batch_op.create_index(batch_op.f("ix_user_words_translate"), ["translate"], unique=False)
        batch_op.create_index(batch_op.f("ix_user_words_comment"), ["comment"], unique=False)
        batch_op.create_index(batch_op.f("ix_user_words_lang"), ["lang"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("user_words", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_user_words_lang"))
        batch_op.drop_index(batch_op.f("ix_user_words_comment"))
        batch_op.drop_index(batch_op.f("ix_user_words_translate"))
        batch_op.drop_column("lang")
        batch_op.drop_column("comment")
        batch_op.drop_column("translate")
