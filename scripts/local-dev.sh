#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
CONFIG="$ROOT/.runtime/local-dev.env"
action="${1:-help}"
if [[ "$action" == init ]]; then
  if [[ -e "$CONFIG" ]]; then
    echo "已有本地配置，保留原数据库密码和管理员密码：$CONFIG"
    exit 0
  fi
  command -v openssl >/dev/null
  mkdir -p "$ROOT/.runtime"
  umask 077
  # 仅创建本地随机凭据，不读取或复制生产环境配置。
  {
    printf 'LOCAL_DB_PASSWORD=%s\n' "$(openssl rand -hex 24)"
    printf 'LOCAL_JWT_SECRET=%s\n' "$(openssl rand -hex 32)"
    printf 'LOCAL_ADMIN_PASSWORD=%s\n' "$(openssl rand -hex 12)"
    printf 'LOCAL_WEB_PORT=3000\nLOCAL_API_PORT=4000\n'
  } > "$CONFIG"
  echo "本地配置已生成：$CONFIG"
  echo "首次管理员账号：admin；密码见该文件的 LOCAL_ADMIN_PASSWORD。"
  exit 0
fi
case "$action" in
  up|down|logs|status|check) ;;
  *)
    echo "用法：bash scripts/local-dev.sh {init|up|down|logs|status|check}"
    exit 0
    ;;
esac
[[ -f "$CONFIG" ]] || { echo "请先执行 bash scripts/local-dev.sh init"; exit 1; }
compose=(docker compose --env-file "$CONFIG" -f "$ROOT/compose.local.yaml")
case "$action" in
  up) "${compose[@]}" up -d --build --wait --wait-timeout 240 ;;
  down) "${compose[@]}" down ;;
  logs) "${compose[@]}" logs --tail 100 -f ;;
  status) "${compose[@]}" ps ;;
  check)
    # 在容器内检查同源 API，避免依赖本机端口及额外工具。
    "${compose[@]}" exec -T frontend node --input-type=module -e '
      for (const path of ["/", "/api/health", "/api/courses"]) {
        const response = await fetch(`http://127.0.0.1:3000${path}`);
        console.log(path, response.status);
        if (!response.ok) process.exitCode = 1;
      }
    '
    ;;
esac
