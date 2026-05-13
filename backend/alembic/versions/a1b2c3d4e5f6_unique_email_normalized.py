"""unique normalized email for import upserts

Revision ID: a1b2c3d4e5f6
Revises: eeb0391a8053
Create Date: 2026-05-12

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "eeb0391a8053"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """One logical person per non-blank email (case- and whitespace-insensitive)."""
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS ix_candidates_email_lower_unique
        ON candidates (lower(trim(email)))
        WHERE length(trim(email)) > 0
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_candidates_email_lower_unique")
