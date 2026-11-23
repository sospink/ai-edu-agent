#!/usr/bin/env bash
set -euo pipefail
if [ ! -f /etc/supervisor/conf.d/course.conf ]; then
  echo '本地开发请在启动终端按 Ctrl+C，再执行 bash scripts/start.sh。' >&2
  exit 1
fi
supervisorctl -c /etc/supervisor/conf.d/course.conf restart workbench
for attempt in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:8000/api/health; then exit 0; fi
  sleep 1
done
echo '课程服务尚未恢复，请检查 /var/log/course/workbench-error.log。' >&2
exit 1
