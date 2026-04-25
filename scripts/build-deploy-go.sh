#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/EDU_Frontend"
BACKEND_DIR="$ROOT_DIR/EDU_Backend_Go"
STAGING_DIR="${DEPLOY_STAGING_DIR:-$ROOT_DIR/.runtime/deploy-go-dist}"
FRONTEND_STAGE_DIR="$STAGING_DIR/frontend"
BACKEND_STAGE_DIR="$STAGING_DIR/backend"

REMOTE_GOARCH="${DEPLOY_GOARCH:-amd64}"
REMOTE_GOOS="${DEPLOY_GOOS:-linux}"

log() {
  printf '\033[1;34m[deploy-build]\033[0m %s\n' "$1"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "缺少依赖命令: $1" >&2
    exit 1
  fi
}

copy_if_exists() {
  local src="$1"
  local dest="$2"
  if [ -e "$src" ]; then
    mkdir -p "$(dirname "$dest")"
    cp -R "$src" "$dest"
  fi
}

require_cmd npm
require_cmd go
require_cmd rsync

log "清理构建目录: $STAGING_DIR"
rm -rf "$STAGING_DIR"
mkdir -p "$FRONTEND_STAGE_DIR" "$BACKEND_STAGE_DIR"

log "构建前端产物"
(
  cd "$FRONTEND_DIR"
  npm run build
)
rsync -a --delete "$FRONTEND_DIR/dist/" "$FRONTEND_STAGE_DIR/"

log "构建 Go 后端二进制 (${REMOTE_GOOS}/${REMOTE_GOARCH})"
(
  cd "$BACKEND_DIR"
  GOOS="$REMOTE_GOOS" GOARCH="$REMOTE_GOARCH" CGO_ENABLED=0 \
    go build -trimpath -ldflags="-s -w" -o "$BACKEND_STAGE_DIR/edu-backend-go" ./cmd/server
  GOOS="$REMOTE_GOOS" GOARCH="$REMOTE_GOARCH" CGO_ENABLED=0 \
    go build -trimpath -ldflags="-s -w" -o "$BACKEND_STAGE_DIR/schema-audit" ./cmd/schema_audit
)

log "组装后端部署目录"
rsync -a "$BACKEND_DIR/configs/" "$BACKEND_STAGE_DIR/configs/"
rsync -a "$BACKEND_DIR/public/" "$BACKEND_STAGE_DIR/public/"
rsync -a "$BACKEND_DIR/deployments/" "$BACKEND_STAGE_DIR/deployments/"
copy_if_exists "$BACKEND_DIR/.env.example" "$BACKEND_STAGE_DIR/.env.example"
copy_if_exists "$BACKEND_DIR/.kube" "$BACKEND_STAGE_DIR/.kube"
copy_if_exists "$BACKEND_DIR/.openclaw-device-identity.json" "$BACKEND_STAGE_DIR/.openclaw-device-identity.json"
copy_if_exists "$BACKEND_DIR/README.md" "$BACKEND_STAGE_DIR/README.md"

if git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  {
    printf 'commit=%s\n' "$(git -C "$ROOT_DIR" rev-parse HEAD)"
    printf 'branch=%s\n' "$(git -C "$ROOT_DIR" rev-parse --abbrev-ref HEAD)"
    printf 'built_at=%s\n' "$(date '+%Y-%m-%d %H:%M:%S %z')"
    printf 'target=%s/%s\n' "$REMOTE_GOOS" "$REMOTE_GOARCH"
  } > "$STAGING_DIR/REVISION"
fi

log "部署包已生成: $STAGING_DIR"
