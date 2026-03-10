#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$ROOT_DIR/.venv"
LOCAL_WHEEL="$ROOT_DIR/../nemoguardrails-0.20.0-py3-none-any.whl"
LOCAL_ANNOY_TAR="$ROOT_DIR/annoy-1.17.3.tar.gz"
PIP_CACHE_DIR_LOCAL="$ROOT_DIR/.pip-cache"

if [[ ! -d "$VENV_DIR" ]]; then
  # Use system site packages so offline/limited environments can reuse apt-installed build deps.
  python3 -m venv --system-site-packages "$VENV_DIR"
fi

mkdir -p "$PIP_CACHE_DIR_LOCAL"
export PIP_CACHE_DIR="$PIP_CACHE_DIR_LOCAL"

"$VENV_DIR/bin/python" -m pip install --upgrade pip

if [[ -f "$LOCAL_WHEEL" ]]; then
  "$VENV_DIR/bin/pip" install "$LOCAL_WHEEL"
fi

if [[ -f "$LOCAL_ANNOY_TAR" ]]; then
  "$VENV_DIR/bin/pip" install --no-build-isolation "$LOCAL_ANNOY_TAR"
fi

"$VENV_DIR/bin/pip" install --no-build-isolation -r "$ROOT_DIR/requirements.txt"

echo ""
echo "Environment ready. Use these commands:"
echo "  source .venv/bin/activate"
echo "  python main.py"
