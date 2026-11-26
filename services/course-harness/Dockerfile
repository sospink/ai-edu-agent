FROM python:3.11-slim-bookworm@sha256:fde1f6760706d480db8a58ab7200801747d0f549308af1311a442004f12ff939

RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && python -m venv /opt/venv \
    && groupadd --gid 1000 harness \
    && useradd --uid 1000 --gid 1000 --create-home harness \
    && mkdir -p /opt/course-harness /workspace
COPY requirements.txt /opt/course-harness/requirements.txt
RUN /opt/venv/bin/pip install --no-cache-dir -r /opt/course-harness/requirements.txt
COPY entrypoint.py course.patch.yml workspace-bootstrap.mjs course-policy.mjs /opt/course-harness/
ENV PATH="/opt/venv/bin:${PATH}" \
    HOME="/home/harness" \
    DSH_HOME="/home/harness" \
    DSH_PERMISSION_MODE="read-only" \
    PYTHONDONTWRITEBYTECODE="1" \
    PYTHONUNBUFFERED="1"
WORKDIR /opt/course-harness
USER 1000:1000
EXPOSE 3080
ENTRYPOINT ["/opt/venv/bin/python", "/opt/course-harness/entrypoint.py"]
