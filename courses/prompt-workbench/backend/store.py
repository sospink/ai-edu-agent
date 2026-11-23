"""每次操作独立连接，事务与 SQLite 锁保证多线程写入一致性。"""

import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path


class Store:
    def __init__(self, path: Path):
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        with self.connection() as connection:
            connection.execute("PRAGMA journal_mode=WAL")
            connection.execute("CREATE TABLE IF NOT EXISTS records (kind TEXT, id TEXT, stamp TEXT, body TEXT, PRIMARY KEY(kind,id))")

    @contextmanager
    def connection(self):
        connection = sqlite3.connect(self.path, timeout=10)
        try:
            with connection:
                yield connection
        finally:
            connection.close()

    def save(self, kind, record):
        with self.connection() as connection:
            connection.execute("INSERT INTO records VALUES (?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET stamp=excluded.stamp, body=excluded.body",
                               (kind, record["id"], record.get("updatedAt", record.get("createdAt")), json.dumps(record, ensure_ascii=False)))
        return record

    def list(self, kind, limit=100):
        with self.connection() as connection:
            return [json.loads(row[0]) for row in connection.execute(
                "SELECT body FROM records WHERE kind=? ORDER BY stamp DESC, id DESC LIMIT ?", (kind, limit))]

    def get(self, kind, identifier):
        with self.connection() as connection:
            row = connection.execute("SELECT body FROM records WHERE kind=? AND id=?", (kind, identifier)).fetchone()
        return json.loads(row[0]) if row else None

    def delete(self, kind, identifier):
        with self.connection() as connection:
            connection.execute("DELETE FROM records WHERE kind=? AND id=?", (kind, identifier))

    def snapshot(self):
        with self.connection() as connection:
            rows = connection.execute("SELECT kind, body FROM records ORDER BY stamp DESC, id DESC").fetchall()
        return {kind: [json.loads(body) for key, body in rows if key == kind] for kind in ("draft", "experiment")}
