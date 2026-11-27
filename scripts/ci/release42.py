#!/usr/bin/env python3
"""42 应用发布入口：只接受固定发布协议，不执行客户端传入的 Shell。"""
import fcntl
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.request

STATE = Path("/var/lib/edu-release42")
BACKEND = Path("/var/www/edu-backend-go/current/edu-backend-go")
FRONTEND = Path("/var/www/edu")
BACKUPS = Path("/var/www/edu-backups")
MAX_SIZE = 512 * 1024 * 1024


def run(*args):
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL)


def extract(archive, destination, required=None):
    """拒绝路径穿越、链接、设备、重复条目和超大归档后再落盘。"""
    with tarfile.open(archive, "r:gz") as source:
        members = source.getmembers()
        names = set()
        total = 0
        for member in members:
            path = PurePosixPath(member.name)
            if path.is_absolute() or ".." in path.parts or "\\" in member.name:
                raise ValueError("归档路径越界")
            if not member.isfile() and not member.isdir():
                raise ValueError("归档不得包含链接或特殊文件")
            name = str(path)
            if name in names:
                raise ValueError("归档含重复路径")
            names.add(name)
            total += member.size
            if total > MAX_SIZE:
                raise ValueError("解压体积超过上限")
            if required is not None and member.isfile() and name not in required:
                raise ValueError("发布包含非预期文件")
        if required is not None and not required.issubset(names):
            raise ValueError("发布包缺少必要文件")
        for member in members:
            target = destination / str(PurePosixPath(member.name))
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                with source.extractfile(member) as src, target.open("wb") as dst:
                    shutil.copyfileobj(src, dst)
                target.chmod(0o644)


def health():
    for _ in range(15):
        try:
            with urllib.request.urlopen("http://127.0.0.1:4000/api/health", timeout=4) as response:
                payload = json.load(response)
            if payload.get("success") and payload.get("data", {}).get("database") == "up":
                return
        except (OSError, ValueError):
            pass
        time.sleep(2)
    raise RuntimeError("后端健康检查失败")


def replace_binary(source):
    staging = BACKEND.with_name("edu-backend-go.next")
    shutil.copyfile(source, staging)
    staging.chmod(0o755)
    os.replace(staging, BACKEND)


def replace_index(source):
    staging = FRONTEND / "index.html.next"
    shutil.copyfile(source, staging)
    staging.chmod(0o644)
    os.replace(staging, FRONTEND / "index.html")


def upload(sha):
    destination = STATE / (sha + ".tar.gz")
    with tempfile.NamedTemporaryFile(dir=STATE, delete=False) as stream:
        temporary = Path(stream.name)
        size = 0
        try:
            while True:
                chunk = sys.stdin.buffer.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                if size > MAX_SIZE:
                    raise ValueError("发布包超过大小上限")
                stream.write(chunk)
            stream.flush()
            if not size:
                raise ValueError("发布包为空")
            os.replace(temporary, destination)
        finally:
            temporary.unlink(missing_ok=True)
    print("发布包上传成功", sha)


def deploy(sha):
    archive = STATE / (sha + ".tar.gz")
    with tempfile.TemporaryDirectory(dir=STATE) as folder:
        staging = Path(folder)
        extract(archive, staging, {"edu-backend-go", "frontend.tar.gz", "REVISION"})
        if (staging / "REVISION").read_text().strip() != sha:
            raise ValueError("发布提交号不匹配")
        frontend = staging / "frontend"
        frontend.mkdir()
        extract(staging / "frontend.tar.gz", frontend)
        if not (frontend / "index.html").is_file():
            raise ValueError("前端入口缺失")
        # 仅接受 Linux amd64 ELF；本入口不负责镜像或数据库迁移。
        header = (staging / "edu-backend-go").read_bytes()[:20]
        if header[:4] != b"\x7fELF" or header[4:6] != b"\x02\x01" or header[18:20] != b"\x3e\x00":
            raise ValueError("后端不是 Linux amd64 程序")
        stamp = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
        backup = BACKUPS / ("actions-" + stamp + "-" + sha[:12])
        backup.mkdir(parents=True, mode=0o700, exist_ok=False)
        shutil.copy2(BACKEND, backup / "edu-backend-go")
        shutil.copy2(FRONTEND / "index.html", backup / "index.html")
        marker = FRONTEND / "release.json"
        if marker.exists():
            shutil.copy2(marker, backup / "release.json")
        with tarfile.open(backup / "frontend.tar.gz", "w:gz") as saved:
            saved.add(FRONTEND, arcname=".")
        try:
            replace_binary(staging / "edu-backend-go")
            run("systemctl", "restart", "edu-backend-go")
            health()
            # 保留旧哈希资源供已打开页面使用，最后原子切换入口。
            run("rsync", "-a", "--chmod=D755,F644", "--exclude=index.html", "--exclude=release.json", str(frontend) + "/", str(FRONTEND) + "/")
            replace_index(frontend / "index.html")
            with urllib.request.urlopen("http://127.0.0.1:8080/", timeout=10) as response:
                body = response.read()
            if hashlib.sha256(body).digest() != hashlib.sha256((frontend / "index.html").read_bytes()).digest():
                raise RuntimeError("前端入口回读不一致")
            release = {"commit": sha, "deployedAt": stamp, "target": "42"}
            temporary = FRONTEND / "release.json.next"
            temporary.write_text(json.dumps(release) + "\n")
            temporary.chmod(0o644)
            os.replace(temporary, marker)
            print(json.dumps({"success": True, "commit": sha, "backup": str(backup)}))
        except Exception:
            replace_binary(backup / "edu-backend-go")
            # 恢复原有资源；新增哈希文件保留，不删除任何用户文件。
            with tempfile.TemporaryDirectory(dir=STATE) as restored:
                extract(backup / "frontend.tar.gz", Path(restored))
                run("rsync", "-a", str(restored) + "/", str(FRONTEND) + "/")
            replace_index(backup / "index.html")
            if (backup / "release.json").exists():
                shutil.copy2(backup / "release.json", marker)
            else:
                marker.unlink(missing_ok=True)
            run("systemctl", "restart", "edu-backend-go")
            health()
            print("发布失败，已恢复应用；备份：" + str(backup), file=sys.stderr)
            raise
    archive.unlink(missing_ok=True)


def main():
    command = os.environ.get("SSH_ORIGINAL_COMMAND", "").split()
    if len(command) != 2 or command[0] not in {"upload", "deploy", "status"} or not re.fullmatch(r"[a-f0-9]{40}", command[1]):
        raise ValueError("仅允许 upload/deploy/status + 完整提交号")
    if os.geteuid() != 0:
        raise PermissionError("发布入口需要管理员安装")
    STATE.mkdir(mode=0o700, parents=True, exist_ok=True)
    with (STATE / "release.lock").open("w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        action, sha = command
        if action == "upload":
            upload(sha)
        elif action == "deploy":
            deploy(sha)
        else:
            release = json.loads((FRONTEND / "release.json").read_text())
            if release["commit"] != sha:
                raise RuntimeError("线上版本与目标不一致")
            health()
            print(json.dumps(release))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print("发布入口失败：" + str(exc), file=sys.stderr)
        sys.exit(1)
