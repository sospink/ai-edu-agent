#!/usr/bin/env bash
set -euo pipefail
project=/workspace/prompt-workbench
mkdir -p /workspace
if [ ! -e "$project/.course-initialized" ]; then
  if [ -d "$project" ] && [ -n "$(ls -A "$project")" ]; then
    echo '检测到已有项目，保留文件，不覆盖学生修改。'
  else
    mkdir -p "$project"
    rsync -a --exclude node_modules /opt/courses/prompt-workbench/ "$project/"
    ln -s /opt/course-deps/frontend/node_modules "$project/frontend/node_modules"
    git init -q -b main "$project"
    git -C "$project" add .
    git -C "$project" -c user.name='Course Baseline' -c user.email='baseline@lab.local' commit -qm 'Initial course workspace'
    printf '1.0.0\n' > "$project/.course-initialized"
    chown -R 1000:1000 "$project"
  fi
fi
mkdir -p /tmp/runtime-student /home/student/.config/opencode /var/log/course
chmod 0700 /tmp/runtime-student
chown -R 1000:1000 /tmp/runtime-student /home/student/.config /var/log/course
# 仅写入会话受限凭证，供应商密钥从不进入容器。
python - <<'PY'
import json, os
from pathlib import Path
config={"$schema":"https://opencode.ai/config.json","model":"edu/course-model","provider":{"edu":{"npm":"@ai-sdk/openai-compatible","name":"Agent EDU Course","options":{"baseURL":os.getenv("EDU_MODEL_BASE_URL",""),"apiKey":"{env:EDU_MODEL_TOKEN}"},"models":{"course-model":{"name":"Course Model","limit":{"context":32000,"output":4096}}}}},"permission":{"edit":"ask","bash":"ask","external_directory":"deny"}}
p=Path('/home/student/.config/opencode/opencode.json')
p.write_text(json.dumps(config,ensure_ascii=False),encoding='utf-8');p.chmod(0o600);os.chown(p,1000,1000)
desktop=Path('/home/student/Desktop/Prompt Workbench.desktop')
desktop.write_text('[Desktop Entry]\nType=Application\nName=Prompt Workbench\nName[zh_CN]=提示词工作台\nExec=firefox http://127.0.0.1:8000\nIcon=web-browser\nTerminal=false\n',encoding='utf-8');desktop.chmod(0o755);os.chown(desktop,1000,1000)
PY
export OPENCODE_CONFIG=/home/student/.config/opencode/opencode.json
export XDG_RUNTIME_DIR=/tmp/runtime-student
exec /usr/bin/supervisord -n -c /etc/supervisor/conf.d/course.conf
