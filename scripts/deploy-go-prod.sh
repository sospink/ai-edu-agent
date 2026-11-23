#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_SCRIPT="$ROOT_DIR/scripts/build-deploy-go.sh"
STAGING_DIR="${DEPLOY_STAGING_DIR:-$ROOT_DIR/.runtime/deploy-go-dist}"

DEPLOY_HOST="${DEPLOY_HOST:-}"
DEPLOY_USER="${DEPLOY_USER:-ubuntu}"
DEPLOY_PASSWORD="${DEPLOY_PASSWORD:-}"
REMOTE_UPLOAD_ROOT="${DEPLOY_REMOTE_UPLOAD_ROOT:-/home/$DEPLOY_USER/agent-edu-deploy}"
REMOTE_FRONTEND_DIR="${DEPLOY_REMOTE_FRONTEND_DIR:-/var/www/edu}"
REMOTE_BACKEND_DIR="${DEPLOY_REMOTE_BACKEND_DIR:-/var/www/edu-backend-go}"
REMOTE_OLD_BACKEND_DIR="${DEPLOY_REMOTE_OLD_BACKEND_DIR:-/var/www/edu-backend}"
DEPLOY_BACKEND_PORT="${DEPLOY_BACKEND_PORT:-4000}"
DEPLOY_SERVICE_NAME="${DEPLOY_SERVICE_NAME:-edu-backend-go}"
DEPLOY_NGINX_SITE="${DEPLOY_NGINX_SITE:-edu}"
DEPLOY_DATABASE_HOST="${DEPLOY_DATABASE_HOST:-127.0.0.1}"
DEPLOY_DATABASE_NAME="${DEPLOY_DATABASE_NAME:-edu_db_prod}"
DEPLOY_SKIP_SCHEMA_AUDIT="${DEPLOY_SKIP_SCHEMA_AUDIT:-false}"
DEPLOY_APPLY_SCHEMA_REPAIR="${DEPLOY_APPLY_SCHEMA_REPAIR:-true}"
DEPLOY_SKIP_DB_BACKUP="${DEPLOY_SKIP_DB_BACKUP:-false}"
DEPLOY_SCHEMA_REPAIR_FILES="${DEPLOY_SCHEMA_REPAIR_FILES:-20260422_m1_classroom.sql,20260425_agent_teaching_v2.sql,20260425_schema_repair_lab_agent_v2.sql}"
DEPLOY_DATA_REPAIR_FILES="${DEPLOY_DATA_REPAIR_FILES:-20260714_retire_openclaw.sql}"
DEPLOY_K8S_NAMESPACE="${DEPLOY_K8S_NAMESPACE:-edu-backend-go-prod}"
DEPLOY_K8S_RUNTIME_NAMESPACE="${DEPLOY_K8S_RUNTIME_NAMESPACE:-edu-runtime-prod}"
DEPLOY_PUBLIC_DOMAIN="${DEPLOY_PUBLIC_DOMAIN:-}"
DEFAULT_PUBLIC_ORIGINS="http://${DEPLOY_HOST}:8080,http://${DEPLOY_HOST},https://${DEPLOY_HOST}"
if [ -n "$DEPLOY_PUBLIC_DOMAIN" ]; then
  DEPLOY_PUBLIC_DOMAIN="${DEPLOY_PUBLIC_DOMAIN%/}"
  DEFAULT_PUBLIC_ORIGINS="${DEFAULT_PUBLIC_ORIGINS},http://${DEPLOY_PUBLIC_DOMAIN}:8080,http://${DEPLOY_PUBLIC_DOMAIN},https://${DEPLOY_PUBLIC_DOMAIN}"
fi
DEPLOY_PUBLIC_ORIGINS="${DEPLOY_PUBLIC_ORIGINS:-$DEFAULT_PUBLIC_ORIGINS}"

log() {
  printf '\033[1;32m[deploy]\033[0m %s\n' "$1"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "缺少依赖命令: $1" >&2
    exit 1
  fi
}

if [ -z "$DEPLOY_HOST" ]; then
  echo "请通过 DEPLOY_HOST 指定目标服务器，例如: DEPLOY_HOST=42.240.132.79" >&2
  exit 1
fi

if [ -z "$DEPLOY_PASSWORD" ]; then
  read -r -s -p "请输入 ${DEPLOY_USER}@${DEPLOY_HOST} 的登录密码: " DEPLOY_PASSWORD
  echo
fi

require_cmd sshpass
require_cmd ssh
require_cmd rsync

ssh_remote() {
  sshpass -p "$DEPLOY_PASSWORD" ssh -o StrictHostKeyChecking=no "$DEPLOY_USER@$DEPLOY_HOST" "$@"
}

log "探测远端架构"
REMOTE_ARCH_RAW="$(ssh_remote 'uname -m')"
case "$REMOTE_ARCH_RAW" in
  x86_64|amd64) DEPLOY_GOARCH="${DEPLOY_GOARCH:-amd64}" ;;
  aarch64|arm64) DEPLOY_GOARCH="${DEPLOY_GOARCH:-arm64}" ;;
  *)
    echo "暂不支持的远端架构: $REMOTE_ARCH_RAW" >&2
    exit 1
    ;;
esac
export DEPLOY_GOARCH
export DEPLOY_GOOS="${DEPLOY_GOOS:-linux}"

log "本地构建前后端部署包"
bash "$BUILD_SCRIPT"

log "准备远端临时上传目录: $REMOTE_UPLOAD_ROOT"
ssh_remote "mkdir -p '$REMOTE_UPLOAD_ROOT'"

log "增量同步部署包到远端"
sshpass -p "$DEPLOY_PASSWORD" rsync -az --delete -e "ssh -o StrictHostKeyChecking=no" \
  "$STAGING_DIR/" "$DEPLOY_USER@$DEPLOY_HOST:$REMOTE_UPLOAD_ROOT/"

log "执行远端切换"
sshpass -p "$DEPLOY_PASSWORD" ssh -o StrictHostKeyChecking=no "$DEPLOY_USER@$DEPLOY_HOST" \
  "REMOTE_UPLOAD_ROOT='$REMOTE_UPLOAD_ROOT' REMOTE_FRONTEND_DIR='$REMOTE_FRONTEND_DIR' REMOTE_BACKEND_DIR='$REMOTE_BACKEND_DIR' REMOTE_OLD_BACKEND_DIR='$REMOTE_OLD_BACKEND_DIR' DEPLOY_BACKEND_PORT='$DEPLOY_BACKEND_PORT' DEPLOY_SERVICE_NAME='$DEPLOY_SERVICE_NAME' DEPLOY_NGINX_SITE='$DEPLOY_NGINX_SITE' DEPLOY_PUBLIC_ORIGINS='$DEPLOY_PUBLIC_ORIGINS' DEPLOY_DATABASE_HOST='$DEPLOY_DATABASE_HOST' DEPLOY_DATABASE_NAME='$DEPLOY_DATABASE_NAME' DEPLOY_SKIP_SCHEMA_AUDIT='$DEPLOY_SKIP_SCHEMA_AUDIT' DEPLOY_APPLY_SCHEMA_REPAIR='$DEPLOY_APPLY_SCHEMA_REPAIR' DEPLOY_SKIP_DB_BACKUP='$DEPLOY_SKIP_DB_BACKUP' DEPLOY_SCHEMA_REPAIR_FILES='$DEPLOY_SCHEMA_REPAIR_FILES' DEPLOY_DATA_REPAIR_FILES='$DEPLOY_DATA_REPAIR_FILES' DEPLOY_K8S_NAMESPACE='$DEPLOY_K8S_NAMESPACE' DEPLOY_K8S_RUNTIME_NAMESPACE='$DEPLOY_K8S_RUNTIME_NAMESPACE' bash -s" <<'REMOTE_SCRIPT'
set -euo pipefail

log() {
  printf '\033[1;36m[remote-deploy]\033[0m %s\n' "$1"
}

ensure_env() {
  local key="$1"
  local value="$2"
  local file="$3"
  if ! grep -q "^${key}=" "$file" 2>/dev/null; then
    printf '%s=%s\n' "$key" "$value" | sudo tee -a "$file" >/dev/null
  fi
}

upsert_env() {
  local key="$1"
  local value="$2"
  local file="$3"
  sudo python3 - "$file" "$key" "$value" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
key = sys.argv[2]
value = sys.argv[3]
lines = path.read_text().splitlines() if path.exists() else []
updated = []
matched = False
for line in lines:
    if line.startswith(f"{key}="):
        updated.append(f"{key}={value}")
        matched = True
    else:
        updated.append(line)
if not matched:
    updated.append(f"{key}={value}")
path.write_text("\n".join(updated) + "\n")
PY
}

remove_retired_runtime_env() {
  local file="$1"
  sudo python3 - "$file" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
if not path.exists():
    raise SystemExit(0)

retired_prefixes = ("OPENCLAW_", "FEISHU_")
retired_keys = {"PROJECT_LAB_RUNTIME"}
kept = []
for line in path.read_text().splitlines():
    key = line.split("=", 1)[0].strip() if "=" in line else ""
    if key in retired_keys or key.startswith(retired_prefixes):
        continue
    kept.append(line)
path.write_text("\n".join(kept) + "\n")
PY
}

normalize_origin_list() {
  python3 - "$1" <<'PY'
import sys

items = []
seen = set()
for raw in sys.argv[1].split(","):
    origin = raw.strip().rstrip("/")
    if origin and origin not in seen:
        items.append(origin)
        seen.add(origin)
print(",".join(items))
PY
}

db_env_exports() {
  sudo python3 - "$1" <<'PY'
from pathlib import Path
import shlex
import sys

env_path = Path(sys.argv[1])
values = {}
if env_path.exists():
    for raw in env_path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")

def pick(*keys, default=""):
    for key in keys:
        value = values.get(key, "").strip()
        if value:
            return value
    return default

exports = {
    "DB_HOST": pick("MYSQL_HOST", "DATABASE_HOST", default="127.0.0.1"),
    "DB_PORT": pick("MYSQL_PORT", "DATABASE_PORT", default="3306"),
    "DB_USER": pick("MYSQL_USER", "DATABASE_USER", default="root"),
    "DB_PASSWORD": pick("MYSQL_PASSWORD", "DATABASE_PASSWORD"),
    "DB_NAME": pick("MYSQL_DATABASE", "DATABASE_NAME", default="edu_db_prod"),
}
for key, value in exports.items():
    print(f"export {key}={shlex.quote(value)}")
PY
}

apply_schema_repairs() {
  if [ "$DEPLOY_APPLY_SCHEMA_REPAIR" != "true" ]; then
    log "已跳过生产数据库迁移修复"
    return
  fi

  if [ ! -f "$REMOTE_BACKEND_DIR/current/.env" ]; then
    echo "缺少线上 .env，无法执行数据库迁移修复" >&2
    exit 1
  fi

  if ! command -v mysql >/dev/null 2>&1; then
    echo "远端缺少 mysql 客户端，无法同步生产数据库字段。请先安装 mysql-client 后重试。" >&2
    exit 1
  fi

  eval "$(db_env_exports "$REMOTE_BACKEND_DIR/current/.env")"
  if [ "$DB_NAME" != "$DEPLOY_DATABASE_NAME" ]; then
    echo "数据库名不一致：.env=$DB_NAME, 部署目标=$DEPLOY_DATABASE_NAME，迁移中止" >&2
    exit 1
  fi

  if [ "$DEPLOY_SKIP_DB_BACKUP" != "true" ]; then
    if ! command -v mysqldump >/dev/null 2>&1; then
      echo "远端缺少 mysqldump，无法在迁移前备份生产库。请先安装 mysql-client 后重试。" >&2
      exit 1
    fi
    local backup_dir="$REMOTE_BACKEND_DIR/backups"
    local backup_file="$backup_dir/${DB_NAME}_before_schema_repair_$(date +%Y%m%d_%H%M%S).sql"
    log "备份生产数据库: $backup_file"
    sudo mkdir -p "$backup_dir"
    MYSQL_PWD="$DB_PASSWORD" mysqldump \
      --host="$DB_HOST" \
      --port="$DB_PORT" \
      --user="$DB_USER" \
      --single-transaction \
      --routines \
      --triggers \
      "$DB_NAME" | sudo tee "$backup_file" >/dev/null
    sudo chmod 600 "$backup_file"
  fi

  IFS=',' read -r -a schema_files <<< "$DEPLOY_SCHEMA_REPAIR_FILES"
  for schema_file in "${schema_files[@]}"; do
    schema_file="$(printf '%s' "$schema_file" | xargs)"
    [ -n "$schema_file" ] || continue
    local schema_path="$REMOTE_BACKEND_DIR/current/deployments/sql/$schema_file"
    if [ ! -f "$schema_path" ]; then
      echo "缺少数据库迁移文件: $schema_path" >&2
      exit 1
    fi
    log "执行数据库迁移修复: $schema_file"
    sudo cat "$schema_path" | MYSQL_PWD="$DB_PASSWORD" mysql \
      --host="$DB_HOST" \
      --port="$DB_PORT" \
      --user="$DB_USER" \
      "$DB_NAME"
  done
}

apply_data_repairs() {
  if [ -z "$DEPLOY_DATA_REPAIR_FILES" ]; then
    return
  fi

  if [ ! -f "$REMOTE_BACKEND_DIR/current/.env" ]; then
    echo "缺少线上 .env，无法执行数据修复" >&2
    exit 1
  fi

  if ! command -v mysql >/dev/null 2>&1; then
    echo "远端缺少 mysql 客户端，无法执行数据修复。请先安装 mysql-client 后重试。" >&2
    exit 1
  fi

  eval "$(db_env_exports "$REMOTE_BACKEND_DIR/current/.env")"
  if [ "$DB_NAME" != "$DEPLOY_DATABASE_NAME" ]; then
    echo "数据库名不一致：.env=$DB_NAME, 部署目标=$DEPLOY_DATABASE_NAME，数据修复中止" >&2
    exit 1
  fi

  if [ "$DEPLOY_SKIP_DB_BACKUP" != "true" ]; then
    if ! command -v mysqldump >/dev/null 2>&1; then
      echo "远端缺少 mysqldump，无法在数据修复前备份生产库。请先安装 mysql-client 后重试。" >&2
      exit 1
    fi
    local backup_dir="$REMOTE_BACKEND_DIR/backups"
    local backup_file="$backup_dir/${DB_NAME}_before_data_repair_$(date +%Y%m%d_%H%M%S).sql"
    log "备份生产数据库: $backup_file"
    sudo mkdir -p "$backup_dir"
    MYSQL_PWD="$DB_PASSWORD" mysqldump \
      --host="$DB_HOST" \
      --port="$DB_PORT" \
      --user="$DB_USER" \
      --single-transaction \
      --routines \
      --triggers \
      "$DB_NAME" | sudo tee "$backup_file" >/dev/null
    sudo chmod 600 "$backup_file"
  fi

  IFS=',' read -r -a data_files <<< "$DEPLOY_DATA_REPAIR_FILES"
  for data_file in "${data_files[@]}"; do
    data_file="$(printf '%s' "$data_file" | xargs)"
    [ -n "$data_file" ] || continue
    local data_path="$REMOTE_BACKEND_DIR/current/deployments/sql/$data_file"
    if [ ! -f "$data_path" ]; then
      echo "缺少数据修复文件: $data_path" >&2
      exit 1
    fi
    log "执行数据修复: $data_file"
    sudo cat "$data_path" | MYSQL_PWD="$DB_PASSWORD" mysql \
      --host="$DB_HOST" \
      --port="$DB_PORT" \
      --user="$DB_USER" \
      "$DB_NAME"
  done
}

sudo mkdir -p "$REMOTE_FRONTEND_DIR" "$REMOTE_BACKEND_DIR/current"

log "同步前端静态文件"
sudo rsync -a --delete "$REMOTE_UPLOAD_ROOT/frontend/" "$REMOTE_FRONTEND_DIR/"

log "同步 Go 后端文件"
sudo rsync -a --delete \
  --exclude '.env' \
  --exclude 'public/uploads' \
  --exclude 'public/.settings' \
  --exclude 'EDU_Backend_Go' \
  "$REMOTE_UPLOAD_ROOT/backend/" "$REMOTE_BACKEND_DIR/current/"

if [ -f "$REMOTE_BACKEND_DIR/current/.env" ]; then
  :
elif [ -f "$REMOTE_BACKEND_DIR/.env" ]; then
  log "复用已存在的 Go .env"
  sudo cp "$REMOTE_BACKEND_DIR/.env" "$REMOTE_BACKEND_DIR/current/.env"
elif [ -f "$REMOTE_OLD_BACKEND_DIR/.env" ]; then
  log "从旧 TS 后端迁移 .env"
  sudo cp "$REMOTE_OLD_BACKEND_DIR/.env" "$REMOTE_BACKEND_DIR/current/.env"
elif [ -f "$REMOTE_BACKEND_DIR/current/.env.example" ]; then
  log "未发现线上 .env，使用 .env.example 初始化"
  sudo cp "$REMOTE_BACKEND_DIR/current/.env.example" "$REMOTE_BACKEND_DIR/current/.env"
fi

if [ -f "$REMOTE_BACKEND_DIR/current/.env" ]; then
  sudo chmod 600 "$REMOTE_BACKEND_DIR/current/.env"
  upsert_env HOST "0.0.0.0" "$REMOTE_BACKEND_DIR/current/.env"
  upsert_env PORT "$DEPLOY_BACKEND_PORT" "$REMOTE_BACKEND_DIR/current/.env"
  upsert_env SERVER_HOST "0.0.0.0" "$REMOTE_BACKEND_DIR/current/.env"
  upsert_env SERVER_PORT "$DEPLOY_BACKEND_PORT" "$REMOTE_BACKEND_DIR/current/.env"
  upsert_env NODE_ENV "production" "$REMOTE_BACKEND_DIR/current/.env"
  upsert_env DATABASE_HOST "$DEPLOY_DATABASE_HOST" "$REMOTE_BACKEND_DIR/current/.env"
  upsert_env MYSQL_HOST "$DEPLOY_DATABASE_HOST" "$REMOTE_BACKEND_DIR/current/.env"
  upsert_env DATABASE_NAME "$DEPLOY_DATABASE_NAME" "$REMOTE_BACKEND_DIR/current/.env"
  upsert_env MYSQL_DATABASE "$DEPLOY_DATABASE_NAME" "$REMOTE_BACKEND_DIR/current/.env"
  upsert_env DATABASE_AUTO_MIGRATE "false" "$REMOTE_BACKEND_DIR/current/.env"
  upsert_env K8S_NAMESPACE "$DEPLOY_K8S_NAMESPACE" "$REMOTE_BACKEND_DIR/current/.env"
  upsert_env K8S_RUNTIME_NAMESPACE "$DEPLOY_K8S_RUNTIME_NAMESPACE" "$REMOTE_BACKEND_DIR/current/.env"
  upsert_env REDIS_ENABLED "false" "$REMOTE_BACKEND_DIR/current/.env"
  ensure_env UPLOAD_ROOT "public/uploads" "$REMOTE_BACKEND_DIR/current/.env"
  ensure_env UPLOAD_PUBLIC_BASE "/uploads" "$REMOTE_BACKEND_DIR/current/.env"
  ensure_env LOG_DIR "logs" "$REMOTE_BACKEND_DIR/current/.env"
  ensure_env JWT_ISSUER "edu-backend-go" "$REMOTE_BACKEND_DIR/current/.env"
  DEPLOY_PUBLIC_ORIGINS="$(normalize_origin_list "$DEPLOY_PUBLIC_ORIGINS")"
  upsert_env SECURITY_ALLOWED_ORIGINS "$DEPLOY_PUBLIC_ORIGINS" "$REMOTE_BACKEND_DIR/current/.env"
  if [ -f "$REMOTE_BACKEND_DIR/current/.kube/remote-dev.yaml" ]; then
    ensure_env K8S_KUBECONFIG ".kube/remote-dev.yaml" "$REMOTE_BACKEND_DIR/current/.env"
  fi
  remove_retired_runtime_env "$REMOTE_BACKEND_DIR/current/.env"
  sudo rm -f "$REMOTE_BACKEND_DIR/current/.openclaw-device-identity.json"
fi

sudo mkdir -p "$REMOTE_BACKEND_DIR/current/EDU_Backend_Go"
sudo ln -sfn ../.env "$REMOTE_BACKEND_DIR/current/EDU_Backend_Go/.env"
sudo ln -sfn ../configs "$REMOTE_BACKEND_DIR/current/EDU_Backend_Go/configs"

if [ -d "$REMOTE_OLD_BACKEND_DIR/conf" ] && [ ! -e "$REMOTE_BACKEND_DIR/current/conf" ]; then
  log "复用旧后端 conf 证书目录"
  sudo cp -a "$REMOTE_OLD_BACKEND_DIR/conf" "$REMOTE_BACKEND_DIR/current/conf"
fi

if [ -d "$REMOTE_OLD_BACKEND_DIR/public/uploads" ]; then
  log "复用旧后端上传目录"
  sudo rm -rf "$REMOTE_BACKEND_DIR/current/public/uploads"
  sudo ln -sfn "$REMOTE_OLD_BACKEND_DIR/public/uploads" "$REMOTE_BACKEND_DIR/current/public/uploads"
else
  sudo mkdir -p "$REMOTE_BACKEND_DIR/current/public/uploads"
fi

sudo mkdir -p "$REMOTE_BACKEND_DIR/current/logs"
sudo chmod +x "$REMOTE_BACKEND_DIR/current/edu-backend-go"
if [ -f "$REMOTE_BACKEND_DIR/current/schema-audit" ]; then
  sudo chmod +x "$REMOTE_BACKEND_DIR/current/schema-audit"
fi

apply_schema_repairs
apply_data_repairs

if [ "$DEPLOY_SKIP_SCHEMA_AUDIT" != "true" ]; then
  if [ ! -x "$REMOTE_BACKEND_DIR/current/schema-audit" ]; then
    echo "缺少 schema-audit，部署中止" >&2
    exit 1
  fi
  log "执行生产数据库结构审计"
  sudo bash -lc "cd '$REMOTE_BACKEND_DIR/current' && ./schema-audit"
else
  log "已跳过生产数据库结构审计"
fi

SERVICE_FILE="/etc/systemd/system/${DEPLOY_SERVICE_NAME}.service"
log "写入 systemd 服务: $SERVICE_FILE"
sudo tee "$SERVICE_FILE" >/dev/null <<SERVICE
[Unit]
Description=Agent EDU Go Backend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$REMOTE_BACKEND_DIR/current
ExecStart=$REMOTE_BACKEND_DIR/current/edu-backend-go
Restart=always
RestartSec=3
Environment=GIN_MODE=release

[Install]
WantedBy=multi-user.target
SERVICE

log "停止旧后端占用"
sudo systemctl stop "$DEPLOY_SERVICE_NAME" 2>/dev/null || true
sudo pm2 delete edu-backend 2>/dev/null || true
sudo pm2 save --force 2>/dev/null || true
sudo pkill -f '/var/www/edu-backend/dist/index.js' 2>/dev/null || true

sleep 1
CONFLICT_PIDS="$(sudo lsof -t -iTCP:${DEPLOY_BACKEND_PORT} -sTCP:LISTEN || true)"
if [ -n "$CONFLICT_PIDS" ]; then
  for pid in $CONFLICT_PIDS; do
    cmd="$(ps -p "$pid" -o command= || true)"
    if echo "$cmd" | grep -Eq '/var/www/edu-backend/dist/index.js|edu-backend-go'; then
      log "终止端口冲突进程: $pid $cmd"
      sudo kill "$pid" || true
    else
      echo "发现未知进程占用端口 ${DEPLOY_BACKEND_PORT}: $pid $cmd" >&2
      exit 1
    fi
  done
fi

sleep 1
if sudo lsof -t -iTCP:${DEPLOY_BACKEND_PORT} -sTCP:LISTEN >/dev/null 2>&1; then
  echo "端口 ${DEPLOY_BACKEND_PORT} 仍被占用，部署中止" >&2
  exit 1
fi

log "启动 Go 后端服务"
sudo systemctl daemon-reload
sudo systemctl enable "$DEPLOY_SERVICE_NAME" >/dev/null
sudo systemctl restart "$DEPLOY_SERVICE_NAME"
sleep 2
sudo systemctl status "$DEPLOY_SERVICE_NAME" --no-pager -n 20

if [ -f "/etc/nginx/sites-available/$DEPLOY_NGINX_SITE" ]; then
  log "校验并重载 Nginx"
  sudo nginx -t
  sudo systemctl reload nginx
fi

log "校验本机健康检查"
health_ok=false
for _ in $(seq 1 20); do
  if curl -fsS "http://127.0.0.1:${DEPLOY_BACKEND_PORT}/api/health" >/dev/null; then
    health_ok=true
    break
  fi
  sleep 1
done

if [ "$health_ok" != "true" ]; then
  echo "健康检查失败：无法连接 http://127.0.0.1:${DEPLOY_BACKEND_PORT}/api/health" >&2
  echo "最近服务日志：" >&2
  sudo journalctl -u "$DEPLOY_SERVICE_NAME" --no-pager -n 80 >&2 || true
  echo "当前监听端口：" >&2
  sudo ss -ltnp >&2 || true
  exit 1
fi
REMOTE_SCRIPT

log "部署完成"
log "前端目录: $REMOTE_FRONTEND_DIR"
log "后端目录: $REMOTE_BACKEND_DIR/current"
log "服务名称: $DEPLOY_SERVICE_NAME"
