from pathlib import Path

from sqlalchemy import Connection

SQL_DIRECTORY = Path(__file__).resolve().parent / 'sql'


def run_sql_file(connection: Connection, name: str) -> None:
    connection.exec_driver_sql((SQL_DIRECTORY / name).read_text(encoding='utf-8'))
