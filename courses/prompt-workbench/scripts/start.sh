#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if curl -fsS http://127.0.0.1:8000/api/health >/dev/null 2>&1; then
  echo '提示词工作台已运行：http://127.0.0.1:8000'
  exit 0
fi
if [ ! -f frontend/dist/index.html ]; then (cd frontend && npm run build); fi
exec "${PYTHON:-python3}" -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --no-proxy-headers
