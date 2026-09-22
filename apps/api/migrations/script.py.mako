from alembic import op

from migrations.sql_file import run_sql_file

revision = ${repr(up_revision)}
down_revision = ${repr(down_revision)}
branch_labels = None
depends_on = None


def upgrade() -> None:
    run_sql_file(op.get_bind(), '${up_revision}.sql')
