"""源码白名单导出；逐级使用 O_NOFOLLOW，拒绝链接与运行时文件。"""

import argparse
import io
import json
import os
import re
import stat
import zipfile
from pathlib import Path

from .store import Store

EXACT = {
    "requirements.txt", "README.md", "CONTRACT.md", "review.md",
    "frontend/package.json", "frontend/package-lock.json", "frontend/index.html",
    "frontend/tsconfig.json", "frontend/tsconfig.app.json", "frontend/tsconfig.node.json",
    "frontend/vite.config.ts", "frontend/postcss.config.js", "frontend/tailwind.config.js",
    "scripts/check.sh", "scripts/export.sh", "scripts/start.sh", "scripts/restart.sh",
}
BACKEND_FILES = {"__init__.py", "main.py", "gateway.py", "store.py", "validation.py", "i18n.py", "exporter.py", "README.md"}
SUFFIXES = {"frontend/src": {".ts", ".tsx", ".css", ".svg"},
            "schemas": {".json"}, "samples": {".json"}, "tests": {".py"},
            "materials": {".md"}, "manuals": {".md", ".json"}}
SENSITIVE = re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:sk-[A-Za-z0-9_-]{16,}|AKIA[A-Z0-9]{16})\b|(?:api[_-]?key|password|secret|token)\s*[=:]\s*[\"'][^\"'\s]{12,}[\"']", re.I)


def allowed(relative):
    parts = relative.parts
    if any(part.startswith(".") or part in {"node_modules", "dist", "data", "__pycache__", "exports"} for part in parts):
        return False
    if any(word in relative.name.lower() for word in ("credential", "secret", ".env", "runtime", "kubeconfig")):
        return False
    if relative.as_posix() in EXACT:
        return True
    if len(parts) == 2 and parts[0] == "backend":
        return parts[1] in BACKEND_FILES
    return any(relative.as_posix().startswith(prefix + "/") and relative.suffix in suffixes
               for prefix, suffixes in SUFFIXES.items())


def safe_read(root_fd, relative):
    descriptor = os.dup(root_fd)
    try:
        for part in relative.parts[:-1]:
            child = os.open(part, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=descriptor)
            os.close(descriptor)
            descriptor = child
        file_fd = os.open(relative.name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=descriptor)
        with os.fdopen(file_fd, "rb") as stream:
            info = os.fstat(stream.fileno())
            if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_size > 4 * 1024 * 1024:
                return None
            content = stream.read(4 * 1024 * 1024 + 1)
            return content if len(content) <= 4 * 1024 * 1024 else None
    except OSError:
        return None
    finally:
        os.close(descriptor)


def build_export(root: Path, snapshot: dict, token="") -> bytes:
    buffer = io.BytesIO()
    skipped = []
    total = 0
    root_fd = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
            for directory, dirs, files in os.walk(root, followlinks=False):
                dirs[:] = sorted(name for name in dirs if not name.startswith(".") and name not in
                                 {"node_modules", "dist", "data", "exports", "__pycache__"}
                                 and not (Path(directory) / name).is_symlink())
                for name in sorted(files):
                    relative = (Path(directory) / name).relative_to(root)
                    if not allowed(relative):
                        continue
                    content = safe_read(root_fd, relative)
                    if content is None:
                        skipped.append(relative.as_posix())
                        continue
                    text = content.decode("utf-8", errors="replace")
                    if (token and token in text) or SENSITIVE.search(text):
                        skipped.append(relative.as_posix())
                        continue
                    total += len(content)
                    if total > 32 * 1024 * 1024:
                        raise ValueError("源码成果超过导出大小限制")
                    archive.writestr("source/" + relative.as_posix(), content)
            for kind, filename in (("draft", "drafts.json"), ("experiment", "experiments.json")):
                text = json.dumps(snapshot[kind], ensure_ascii=False, indent=2)
                if (token and token in text) or SENSITIVE.search(text):
                    raise ValueError("成果含疑似凭证，请清理相关草稿或实验后重试")
                archive.writestr(filename, text)
            report = {"draftCount": len(snapshot["draft"]), "experimentCount": len(snapshot["experiment"]),
                      "validationPassed": sum(item.get("validation", {}).get("valid") is True for item in snapshot["experiment"]),
                      "skippedSourceFiles": skipped,
                      "notice": "自动校验仅覆盖 JSON Schema 与原文引用；service/symptom 的语义及信息完整性须人工复核。"}
            archive.writestr("report.json", json.dumps(report, ensure_ascii=False, indent=2))
            archive.writestr("MANUAL_REVIEW.md", "# 人工复核 / Manual Review\n\n"
                             "核对 service/symptom 是否忠实原文，missing_fields 是否合理，证据是否充分。\n"
                             "Schema 和引用通过不代表所有事实正确。对照真实 requestId、model、usage 与实验提示词，记录修改理由。\n"
                             "Review semantics, missing information and evidence sufficiency. Automated checks do not prove factual correctness.\n"
                             "导出不包含运行配置、凭证、数据库、依赖或构建产物。重新运行须由 Lab 注入网关环境变量。\n")
    finally:
        os.close(root_fd)
    return buffer.getvalue()


def main():
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description="本地导出提示词工作台源码和学习成果")
    parser.add_argument("--output", default=str(root / "backend/exports/prompt-workbench.zip"))
    args = parser.parse_args()
    target = Path(args.output).resolve()
    if not target.is_relative_to(root):
        parser.error("导出文件必须保存在当前课程目录内")
    db = Path(os.getenv("PROMPT_WORKBENCH_DB", str(root / "backend/data/workbench.sqlite3")))
    try:
        content = build_export(root, Store(db).snapshot(), os.getenv("EDU_MODEL_TOKEN", ""))
    except ValueError as exc:
        parser.error(str(exc))
    target.parent.mkdir(parents=True, exist_ok=True)
    # 不覆盖已有源码或已有成果，避免误操作。
    with target.open("xb") as stream:
        stream.write(content)
    print(f"成果已导出：{target}")


if __name__ == "__main__":
    main()
