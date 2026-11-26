"""本机 Docker 冒烟；仅输出脱敏日志，启动令牌只在内存中参与登录交换。"""
import argparse
import http.client
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import time
from urllib.parse import parse_qs, urlencode, urlsplit

IMAGE = "registry.cn-beijing.aliyuncs.com/svinsight/course:harness-web-0.2.2rc2-20261126"


def docker(*args, check=True):
    result = subprocess.run(["docker", *args], capture_output=True, text=True)
    if check and result.returncode:
        raise RuntimeError(f"Docker 操作失败：{args[0]}；{redact(result.stderr)}")
    return result.stdout + (result.stderr if args[0] == "logs" else "")


def redact(text):
    return re.sub(r"(?i)(token[=:]\s*)[^&\s\"'<>]+", r"\1[REDACTED]", text)


def fetch_page(port, path="/", cookie=None):
    connection = http.client.HTTPConnection("127.0.0.1", port, timeout=15)
    headers = {"Host": f"127.0.0.1:{port}"}
    if cookie:
        headers["Cookie"] = cookie
    connection.request("GET", path, headers=headers)
    response = connection.getresponse()
    result = response.status, {key.lower(): value for key, value in response.getheaders()}, response.read()
    connection.close()
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--name", default="course-harness-smoke-20261126")
    parser.add_argument("--port", type=int, default=13080)
    parser.add_argument("--existing", action="store_true", help="只检查指定的已存在测试容器")
    args = parser.parse_args()
    root = Path(__file__).resolve().parent
    snapshot = root / ".artifacts" / "snapshot"
    snapshot.mkdir(parents=True, exist_ok=True)
    (snapshot / "lesson.md").write_text("# 课程验收\n\n课程助手只读取此课程快照。\n", encoding="utf-8")
    volume = f"{args.name}-home"
    docker("volume", "create", volume)
    env = {
        "EDU_PUBLIC_URL": f"http://127.0.0.1:{args.port}/api/course-harness/proxy/smoke/",
        "EDU_TRUSTED_HOST": f"127.0.0.1:{args.port}",
        "EDU_MODEL_BASE_URL": "http://gateway:4000/api/course-harness/model/smoke/v1",
        "EDU_MODEL_TOKEN": secrets.token_urlsafe(32),
        "EDU_LOCALE": "zh-CN",
        "EDU_COURSE_TITLE": "课程容器验收",
    }
    # 环境值不进入可打印的 argv 或异常消息。
    command = ["docker", "run", "-d", "--name", args.name, "--platform", "linux/amd64",
               "--read-only", "--cap-drop=ALL", "--security-opt=no-new-privileges:true",
               "--tmpfs", "/tmp:rw,exec,nosuid,size=128m,mode=1777",
               "--cpus", "0.75", "--memory", "768m", "--pids-limit", "160",
               "-v", f"{volume}:/home/harness",
               "-v", f"{snapshot}:/workspace:ro",
               "-p", f"127.0.0.1:{args.port}:3080"]
    for key in env:
        command += ["-e", key]
    command += [IMAGE]
    if not args.existing:
        result = subprocess.run(command, env={**os.environ, **env}, capture_output=True, text=True)
        if result.returncode:
            raise RuntimeError(redact(result.stderr))
    print(f"测试容器：{args.name}；本机端口：{args.port}；持久卷：{volume}", flush=True)
    deadline = time.monotonic() + 180
    token = None
    logs = ""
    while time.monotonic() < deadline:
        logs = docker("logs", args.name)
        for url in re.findall(r"https?://[^\s\x1b<>\"']+", logs):
            values = parse_qs(urlsplit(url).query).get("token")
            if values:
                token = values[0]
                break
        if token:
            break
        state = docker("inspect", "--format", "{{.State.Status}}", args.name).strip()
        if state != "running":
            break
        time.sleep(2)
    if not token:
        print(redact(logs[-12000:]))
        raise SystemExit("未获取到启动令牌；保留容器供排查")
    time.sleep(2)
    logs = docker("logs", args.name)
    if "did not activate" in logs:
        print(redact(logs[-12000:]))
        raise SystemExit("官方插件未全部激活，不能认定启动成功")
    status, headers, _ = fetch_page(args.port, "/?" + urlencode({"token": token}))
    if status != 303 or "set-cookie" not in headers:
        raise SystemExit(f"官方登录交换失败：HTTP {status}")
    cookie = headers["set-cookie"].split(";", 1)[0]
    status, _, body = fetch_page(args.port, "/", cookie)
    if status != 200 or b"<html" not in body.lower():
        raise SystemExit(f"官方页面读取失败：HTTP {status}")
    info = json.loads(docker("inspect", args.name))[0]
    image = json.loads(docker("image", "inspect", IMAGE))[0]
    report = {
        "container": args.name, "port": args.port,
        "imageId": image["Id"], "repoDigests": image.get("RepoDigests", []),
        "architecture": image["Architecture"], "user": info["Config"]["User"],
        "readonlyRootfs": info["HostConfig"]["ReadonlyRootfs"],
        "workspaceReadonly": next(not mount["RW"] for mount in info["Mounts"] if mount["Destination"] == "/workspace"),
        "loginExchange": 303, "officialHtml": status, "htmlBytes": len(body),
        "workspaceBootstrap": "课程工作区已初始化" in logs,
    }
    (root / ".artifacts" / "smoke-result.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    print(redact(logs[-5000:]))


if __name__ == "__main__":
    main()
