from alembic import op
from migrations.sql_file import run_sql_file

revision = '20260921011558_init'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    run_sql_file(op.get_bind(), '20260921011558_init.sql')
