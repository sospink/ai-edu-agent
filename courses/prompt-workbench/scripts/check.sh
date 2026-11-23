#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export PYTHONDONTWRITEBYTECODE=1
# 使用测试专用临时数据库和 mock transport，不消耗模型额度。
stage="${1:-all}"
if [[ "$stage" == --* ]]; then
  stage=all
elif [[ $# -gt 0 ]]; then
  shift
fi
case "$stage" in
  all) selection=(-k '') ;;
  environment) selection=(-k 'unconfigured or static_api or config_ or locale_ or access') ;;
  schema) selection=(-k 'schema or evidence or invalid_json or semantics or validation_locale') ;;
  drafts) selection=(-k 'lifecycle or token_never or thread_safety or storage_failure') ;;
  run) selection=(-k 'lifecycle or upstream or disconnect or cancel_request or missing_usage') ;;
  export) selection=(-k 'export') ;;
  *) printf '未知阶段 / Unknown stage: %s\n支持 / Supported: all environment schema drafts run export\n' "$stage" >&2; exit 2 ;;
esac
if [[ -z "${PYTHON:-}" && -x /opt/venvs/prompt-workbench/bin/python ]]; then
  PYTHON=/opt/venvs/prompt-workbench/bin/python
fi
mkdir -p tests/.tmp
temporary=$(mktemp -d "$PWD/tests/.tmp/${stage}-XXXXXX")
trap 'rm -rf "$temporary"' EXIT
"${PYTHON:-python3}" -m pytest -q -p no:cacheprovider --basetemp="$temporary" tests "${selection[@]}" "$@"
