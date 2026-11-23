# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim@sha256:e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee AS node
FROM python:3.11-slim-bookworm@sha256:a83ba18aef0f865b1a4a611c2cf460fe446f2795673bbb9fe43be570439e3b39 AS runtime
ARG OPENCODE_VERSION=1.17.18
ENV DEBIAN_FRONTEND=noninteractive PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    PATH=/opt/venvs/prompt-workbench/bin:/usr/local/bin:/usr/bin:/bin \
    EDU_PROJECT_DIR=/workspace/prompt-workbench DISPLAY=:1 HOME=/home/student
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
 && ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
 && rm -f /etc/apt/apt.conf.d/docker-clean
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    apt-get update && PATH=/usr/sbin:/usr/bin:/sbin:/bin apt-get install -y --no-install-recommends \
    xfce4 xfce4-terminal dbus-x11 tigervnc-standalone-server novnc websockify \
    firefox-esr supervisor git curl jq ca-certificates fonts-noto-cjk xdg-utils \
    procps tmux rsync x11-utils \
 && rm -rf /var/lib/apt/lists/*
RUN /usr/sbin/useradd -m -u 1000 -s /bin/bash student
# 目标为linux/amd64，直接安装基线二进制，避免交叉构建时安装器误判CPU/libc。
RUN --mount=type=cache,target=/var/cache/npm,sharing=locked \
    npm_config_cache=/var/cache/npm npm install -g --ignore-scripts "opencode-linux-x64-baseline@${OPENCODE_VERSION}" \
 && ln -s /usr/local/lib/node_modules/opencode-linux-x64-baseline/bin/opencode /usr/local/bin/opencode
RUN python -m venv /opt/venvs/prompt-workbench
COPY requirements.txt /opt/course-deps/requirements.txt
RUN /opt/venvs/prompt-workbench/bin/pip install --no-cache-dir -r /opt/course-deps/requirements.txt
COPY frontend/package*.json /opt/course-deps/frontend/
RUN --mount=type=cache,target=/var/cache/npm,sharing=locked \
    cd /opt/course-deps/frontend && npm_config_cache=/var/cache/npm npm ci --no-audit --no-fund \
 && mkdir -p node_modules/.vite-temp node_modules/.vite \
 && chown -R 1000:1000 node_modules/.vite-temp node_modules/.vite
COPY . /opt/courses/prompt-workbench/
RUN ln -s /opt/course-deps/frontend/node_modules /opt/courses/prompt-workbench/frontend/node_modules \
 && cd /opt/courses/prompt-workbench/frontend && npm run build \
 && chmod +x /opt/courses/prompt-workbench/scripts/*.sh \
 && install -m 0755 /opt/courses/prompt-workbench/image/entrypoint.sh /usr/local/bin/course-entrypoint \
 && install -m 0755 /opt/courses/prompt-workbench/image/desktop-session.sh /usr/local/bin/course-desktop \
 && install -m 0644 /opt/courses/prompt-workbench/image/supervisord.conf /etc/supervisor/conf.d/course.conf \
 && mkdir -p /usr/lib/firefox-esr/distribution \
 && install -m 0644 /opt/courses/prompt-workbench/image/firefox-policies.json /usr/lib/firefox-esr/distribution/policies.json \
 && mkdir -p /workspace /var/log/course /home/student/Desktop \
 && chown -R student:student /home/student /var/log/course \
 && printf 'export PATH=/opt/venvs/prompt-workbench/bin:/usr/local/bin:$PATH\nexport PYTHON=/opt/venvs/prompt-workbench/bin/python\nexport OPENCODE_CONFIG=/home/student/.config/opencode/opencode.json\n' > /etc/profile.d/prompt-workbench.sh \
 && printf '\nexport PATH=/opt/venvs/prompt-workbench/bin:/usr/local/bin:$PATH\nif [ -d /workspace/prompt-workbench ]; then cd /workspace/prompt-workbench; fi\n' >> /home/student/.bashrc \
 && printf '\nexport PATH=/opt/venvs/prompt-workbench/bin:/usr/local/bin:$PATH\nif [ -d /workspace/prompt-workbench ]; then cd /workspace/prompt-workbench; fi\n' >> /root/.bashrc
ENV PATH=/opt/venvs/prompt-workbench/bin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
    PYTHON=/opt/venvs/prompt-workbench/bin/python OPENCODE_CONFIG=/home/student/.config/opencode/opencode.json
WORKDIR /workspace
EXPOSE 6080 8000
HEALTHCHECK --interval=20s --timeout=5s --start-period=60s CMD curl -fsS http://127.0.0.1:8000/api/health && curl -fsS http://127.0.0.1:6080/vnc.html >/dev/null || exit 1
ENTRYPOINT ["/usr/local/bin/course-entrypoint"]
