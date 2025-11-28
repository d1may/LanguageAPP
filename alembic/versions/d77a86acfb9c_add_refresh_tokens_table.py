"""add refresh tokens table

Revision ID: d77a86acfb9c
Revises: 7ff2a0296676
Create Date: 2025-03-20 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d77a86acfb9c"
down_revision: Union[str, Sequence[str], None] = "7ff2a0296676"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = inspector.get_table_names()

    if "refresh_tokens" not in table_names:
        op.create_table(
            "refresh_tokens",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("jti", sa.String(length=64), nullable=False),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("revoked", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.UniqueConstraint("jti", name="uq_refresh_tokens_jti"),
        )

    existing_indexes = {idx["name"] for idx in inspector.get_indexes("refresh_tokens")}

    if "ix_refresh_tokens_user_id" not in existing_indexes:
        op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])
    if "ix_refresh_tokens_jti" not in existing_indexes:
        op.create_index("ix_refresh_tokens_jti", "refresh_tokens", ["jti"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_refresh_tokens_jti", table_name="refresh_tokens")
    op.drop_index("ix_refresh_tokens_user_id", table_name="refresh_tokens")
    op.drop_table("refresh_tokens")
