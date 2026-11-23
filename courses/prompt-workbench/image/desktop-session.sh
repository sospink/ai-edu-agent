#!/usr/bin/env bash
set -euo pipefail
for attempt in $(seq 1 30); do
  if xdpyinfo -display :1 >/dev/null 2>&1; then exec dbus-run-session startxfce4; fi
  sleep 1
done
echo '桌面显示服务未就绪' >&2
exit 1
