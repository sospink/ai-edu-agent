#!/bin/bash
# 示例：验证学生是否成功拉取并运行了指定 Docker 镜像
# 步骤说明：使用 docker run 运行 nginx 容器

CONTAINER_NAME="student-nginx"
IMAGE_NAME="nginx"

# 检查容器是否在运行
RUNNING=$(docker ps --filter "name=$CONTAINER_NAME" --filter "status=running" --format "{{.Names}}" 2>/dev/null)

if [ "$RUNNING" = "$CONTAINER_NAME" ]; then
  echo "{\"success\": true, \"message\": \"$CONTAINER_NAME 容器正在运行！\"}"
  exit 0
else
  # 检查容器是否存在但未运行
  EXISTS=$(docker ps -a --filter "name=$CONTAINER_NAME" --format "{{.Names}}" 2>/dev/null)
  if [ "$EXISTS" = "$CONTAINER_NAME" ]; then
    echo "{\"success\": false, \"message\": \"容器 $CONTAINER_NAME 存在但未运行，请执行 docker start $CONTAINER_NAME\"}"
  else
    echo "{\"success\": false, \"message\": \"未找到容器 $CONTAINER_NAME，请执行 docker run --name $CONTAINER_NAME -d $IMAGE_NAME\"}"
  fi
  exit 1
fi
