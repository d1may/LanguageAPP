"""add difficulty to flashcard words

Revision ID: 8b67e0b7f8fb
Revises: 540bf1beb09b
Create Date: 2025-12-05 15:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8b67e0b7f8fb'
down_revision: Union[str, Sequence[str], None] = '540bf1beb09b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('flashcard_words', schema=None) as batch_op:
        batch_op.add_column(sa.Column('difficulty', sa.String(length=50), nullable=True))
        batch_op.create_index(batch_op.f('ix_flashcard_words_difficulty'), ['difficulty'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('flashcard_words', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_flashcard_words_difficulty'))
        batch_op.drop_column('difficulty')

