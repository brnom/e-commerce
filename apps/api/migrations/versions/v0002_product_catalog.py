from alembic import op
from migrations.sql_file import run_sql_file

revision = '20260921125149_product_catalog'
down_revision = '20260921011558_init'
branch_labels = None
depends_on = None


def upgrade() -> None:
    run_sql_file(op.get_bind(), '20260921125149_product_catalog.sql')
