#!/usr/bin/env bash
# 仅发布42的EDU应用，保留Dify、K8S、上传文件及模型配置。
set -euo pipefail
phase=${1:?backend 或 frontend}
bundle=${2:?本地构建目录}
target=ubuntu@42.240.132.79
stage=/home/ubuntu/edu-harness-deploy
ssh -o BatchMode=yes "$target" "mkdir -p '$stage'"
if [[ "$phase" == backend ]]; then
  image=${3:?已推送并验证的镜像digest}
  [[ "$image" =~ ^registry.cn-beijing.aliyuncs.com/svinsight/course@sha256:[a-f0-9]{64}$ ]] || exit 2
  scp "$bundle/edu-backend-go" "$target:$stage/edu-backend-go"
  scp EDU_Backend_Go/deployments/nginx-course-harness.conf "$target:$stage/nginx-course-harness.conf"
  ssh -o BatchMode=yes "$target" bash -s -- "$image" <<'REMOTE'
set -euo pipefail
image=$1
stage=/home/ubuntu/edu-harness-deploy
root=/var/www/edu-backend-go/current
backup=/var/www/edu-backend-go/backups/harness-$(date -u +%Y%m%dT%H%M%S)
sudo docker image inspect "$image" >/dev/null
sudo mkdir -p "$backup"
sudo cp -a "$root/edu-backend-go" "$root/.env" "$backup/"
sudo cp -L /etc/nginx/sites-enabled/edu "$backup/nginx-edu"
rollback() {
  sudo cp "$backup/.env" "$root/.env"
  sudo cp "$backup/nginx-edu" /etc/nginx/sites-enabled/edu
  sudo install -m 0755 "$backup/edu-backend-go" "$root/edu-backend-go.rollback"
  sudo mv "$root/edu-backend-go.rollback" "$root/edu-backend-go"
  sudo systemctl restart edu-backend-go
  sudo nginx -t && sudo systemctl reload nginx
  echo "发布失败，已恢复应用备份：$backup" >&2
}
trap rollback ERR
sudo install -m 0644 "$stage/nginx-course-harness.conf" /etc/nginx/snippets/edu-course-harness.conf
sudo python3 - "$image" <<'PY'
import pathlib, sys
env = pathlib.Path("/var/www/edu-backend-go/current/.env")
values = {"COURSE_HARNESS_IMAGE": sys.argv[1], "COURSE_HARNESS_PUBLIC_ORIGIN": "http://42.240.132.79:8080"}
lines = env.read_text().splitlines()
kept = [line for line in lines if line.split("=", 1)[0].strip() not in values]
env.write_text("\n".join(kept + [f"{key}={value}" for key,value in values.items()])+"\n")
path = pathlib.Path("/etc/nginx/sites-enabled/edu").resolve()
text = path.read_text()
include = "    include /etc/nginx/snippets/edu-course-harness.conf;"
if include not in text:
    marker = "    location ^~ /api/ {"
    if text.count(marker) != 1:
        raise RuntimeError("无法确定现有API代理配置位置")
    path.write_text(text.replace(marker,include+"\n\n"+marker,1))
PY
sudo nginx -t
sudo install -m 0755 "$stage/edu-backend-go" "$root/edu-backend-go.next"
sudo mv "$root/edu-backend-go.next" "$root/edu-backend-go"
sudo systemctl restart edu-backend-go
sudo systemctl reload nginx
healthy=false
for attempt in 1 2 3 4 5; do
  if curl --fail --silent http://127.0.0.1:4000/api/health >/dev/null; then healthy=true; break; fi
  sleep 2
done
$healthy
trap - ERR
echo "后端发布与健康检查通过，备份：$backup"
REMOTE
elif [[ "$phase" == frontend ]]; then
  scp "$bundle/frontend.tar.gz" "$target:$stage/frontend.tar.gz"
  ssh -o BatchMode=yes "$target" bash -s <<'REMOTE'
set -euo pipefail
stage=/home/ubuntu/edu-harness-deploy
backup=/var/www/edu-backups/harness-$(date -u +%Y%m%dT%H%M%S)
sudo mkdir -p "$backup"
sudo tar -czf "$backup/frontend.tar.gz" -C /var/www/edu .
mkdir -p "$stage/frontend"
tar -xzf "$stage/frontend.tar.gz" -C "$stage/frontend"
test -s "$stage/frontend/index.html"
sudo rsync -a --exclude index.html "$stage/frontend/" /var/www/edu/
sudo install -m 0644 "$stage/frontend/index.html" /var/www/edu/index.html.next
sudo mv /var/www/edu/index.html.next /var/www/edu/index.html
echo "前端增量发布通过，旧资源保留，备份：$backup"
REMOTE
else
  echo "不支持的发布阶段" >&2
  exit 2
fi
