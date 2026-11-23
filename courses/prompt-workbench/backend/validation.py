"""仅验证结构与直接引用，语义正确性仍需人工复核。"""

import json
from pathlib import Path

from jsonschema import Draft202012Validator

SCHEMA = json.loads((Path(__file__).resolve().parents[1] / "schemas/incident.schema.json").read_text(encoding="utf-8"))
VALIDATOR = Draft202012Validator(SCHEMA)


def _unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("JSON 对象包含重复字段")
        result[key] = value
    return result


def validate_output(text: str, original: str) -> dict:
    issues = []
    try:
        parsed = json.loads(text, object_pairs_hook=_unique_object,
                            parse_constant=lambda _: (_ for _ in ()).throw(ValueError("非法 JSON 常量")))
    except (ValueError, RecursionError):
        return {"valid": False, "parsed": None,
                "issues": [{"path": "$", "message": "输出必须是合法 JSON，不能包含代码围栏、重复字段或非有限数值"}],
                "checks": [{"name": "json", "passed": False}, {"name": "schema", "passed": False},
                           {"name": "evidence", "passed": False}]}
    for error in VALIDATOR.iter_errors(parsed):
        path = "$" + "".join(f"[{p}]" if isinstance(p, int) else f".{p}" for p in error.absolute_path)
        issues.append({"path": path, "message": f"不符合输出 Schema（{error.validator}）"})
    schema_ok = not issues
    evidence_ok = isinstance(parsed, dict) and isinstance(parsed.get("evidence"), list)
    if evidence_ok:
        for index, quote in enumerate(parsed["evidence"]):
            if not isinstance(quote, str) or not quote.strip() or quote not in original:
                evidence_ok = False
                issues.append({"path": f"$.evidence[{index}]", "message": "证据必须是原始输入中非空的直接引用"})
    return {"valid": schema_ok and evidence_ok, "parsed": parsed if isinstance(parsed, dict) else None,
            "issues": issues, "checks": [{"name": "json", "passed": True},
            {"name": "schema", "passed": schema_ok}, {"name": "evidence", "passed": evidence_ok}]}
