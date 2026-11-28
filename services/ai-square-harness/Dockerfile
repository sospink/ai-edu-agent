# 在仓库根目录构建，使用线上课程助教已验证的镜像作为基础。
ARG COURSE_IMAGE
FROM node:22-bookworm-slim AS catalog
WORKDIR /src
COPY scripts/sync-dsh-skills.mjs scripts/
COPY EDU_Frontend/src/data/agentHubSkills.ts EDU_Frontend/src/data/
RUN node scripts/sync-dsh-skills.mjs --dir=/catalog

FROM ${COURSE_IMAGE}
COPY --from=catalog /catalog/skills/ /opt/ai-square/skills/
COPY services/ai-square-harness/square.patch.yml services/ai-square-harness/square-policy.mjs /opt/ai-square/
COPY services/course-harness/entrypoint.py /opt/course-harness/entrypoint.py
ENV EDU_WORKSPACE_PROFILE=ai-square
