#!/usr/bin/env python3
"""Import zh-CN Agent manuals from repository Markdown files.

Required environment variables:
  AGENT_EDU_BASE_URL, for example http://35.220.223.209
  AGENT_EDU_ADMIN_USERNAME
  AGENT_EDU_ADMIN_PASSWORD

The script updates only zh-CN Agent manual translations through the public API.
It does not modify main Agent manual records, verification rules, progress, or
Lab runtime bindings.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]

MANUALS = [
    (364, "环境开发/new-course/Agent实训文档修改/MCP_Server开发/MCP_Server开发_实操课_第二节_实训手册.md"),
    (367, "环境开发/new-course/Agent实训文档修改/ADE配置与智能体开发/ADE配置与智能体开发_第二节_实训手册.md"),
    (370, "环境开发/new-course/Agent实训文档修改/智能体框架与开发/智能体框架与开发_实训一_毒舌Gordon_实训手册.md"),
    (371, "环境开发/new-course/Agent实训文档修改/智能体框架与开发/智能体框架与开发_实训二_创意风暴_实训手册.md"),
    (373, "环境开发/new-course/Agent实训文档修改/安全与合规/安全与合规_第二节_AI酒吧调酒师_实训手册.md"),
]


def require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise SystemExit(f"missing required env: {name}")
    return value


def post_json(url: str, payload: dict, headers: dict[str, str] | None = None) -> dict:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json", **(headers or {})},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"POST {url} failed: {exc.code} {detail}") from exc


def main() -> int:
    base_url = require_env("AGENT_EDU_BASE_URL").rstrip("/")
    username = require_env("AGENT_EDU_ADMIN_USERNAME")
    password = require_env("AGENT_EDU_ADMIN_PASSWORD")

    login = post_json(
        f"{base_url}/api/auth/login",
        {"username": username, "password": password},
        {"X-Locale": "en-US"},
    )
    token = (login.get("data") or {}).get("token")
    if not token:
        raise SystemExit("login succeeded without token")

    for source_id, relative_path in MANUALS:
        path = REPO_ROOT / relative_path
        markdown = path.read_text(encoding="utf-8")
        result = post_json(
            f"{base_url}/api/teacher/manuals/import",
            {"sourceType": 1, "sourceId": source_id, "locale": "zh-CN", "markdown": markdown},
            {"Authorization": f"Bearer {token}", "X-Locale": "zh-CN"},
        )
        if not result.get("success"):
            raise RuntimeError(f"manual import failed for sourceId={source_id}: {result}")
        print(f"imported zh-CN manual sourceId={source_id} from {relative_path}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
