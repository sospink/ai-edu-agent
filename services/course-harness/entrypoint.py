"""校验后端注入的运行契约，并原样启动官方 Harness Web。"""
import ipaddress
import os
import socket
import sys
from urllib.parse import urlsplit


def fail(message):
    # 不把环境变量值或启动令牌写入校验错误。
    raise SystemExit(f"课程 Harness 启动失败：{message}")


def build_args(host):
    # 外层覆盖参数必须放在 Web 子命令选项前，否则会被内层 CLI 拒绝。
    args = ["/opt/venv/bin/dsh", "web", "--patch", "/opt/course-harness/course.patch.yml"]
    if os.environ.get("EDU_WORKSPACE_PROFILE") == "ai-square":
        args.extend(["--patch", "/opt/ai-square/square.patch.yml"])
    args.extend(["--host", host, "--port", "3080", "--no-open",
                 "--public-url", os.environ["EDU_PUBLIC_URL"],
                 "--trusted-host", os.environ["EDU_TRUSTED_HOST"]])
    return args


def main():
    required = ("EDU_PUBLIC_URL", "EDU_TRUSTED_HOST", "EDU_MODEL_BASE_URL",
                "EDU_MODEL_TOKEN", "EDU_LOCALE", "EDU_COURSE_TITLE")
    if any(not os.environ.get(key) for key in required):
        fail("缺少必需的 EDU 环境变量")
    public = urlsplit(os.environ["EDU_PUBLIC_URL"])
    model = urlsplit(os.environ["EDU_MODEL_BASE_URL"])
    if (public.scheme not in ("http", "https") or not public.netloc
            or public.username or public.password or public.query or public.fragment
            or not public.path.startswith("/api/course-harness/proxy/")
            or not public.path.endswith("/")
            or public.netloc != os.environ["EDU_TRUSTED_HOST"]):
        fail("公开地址与可信主机不符合代理契约")
    if (model.scheme not in ("http", "https") or not model.netloc
            or model.username or model.password or model.query or model.fragment
            or not model.path.startswith("/api/course-harness/model/")
            or not model.path.rstrip("/").endswith("/v1")):
        fail("模型网关地址不符合契约")
    if os.environ["EDU_LOCALE"] not in ("zh-CN", "en-US"):
        fail("不支持的语言")
    if not os.path.isdir("/workspace") or not os.access("/home/harness", os.W_OK):
        fail("课程快照或持久化目录不可用")
    addresses = socket.getaddrinfo(socket.gethostname(), 3080, socket.AF_INET, socket.SOCK_STREAM)
    hosts = [item[4][0] for item in addresses
             if not ipaddress.ip_address(item[4][0]).is_loopback
             and not ipaddress.ip_address(item[4][0]).is_unspecified]
    if not hosts:
        fail("无法解析容器的具体 IPv4 地址")
    os.umask(0o077)
    # 固定应用根目录；会话默认课程目录由宿主插件注册。
    os.chdir("/opt/course-harness")
    args = build_args(hosts[0])
    print("Harness：启动官方 Web，端口 3080", flush=True)
    os.execv(args[0], args)


if __name__ == "__main__":
    main()
