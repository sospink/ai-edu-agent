#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export PYTHONDONTWRITEBYTECODE=1
exec "${PYTHON:-python3}" -m backend.exporter "$@"
