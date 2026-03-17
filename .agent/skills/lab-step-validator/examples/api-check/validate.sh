#!/bin/bash
# 示例：验证学生启动的 Web 服务是否正常运行
# 步骤说明：启动一个监听 3000 端口的 Node.js 服务

PORT=3000
TIMEOUT=5

# 尝试访问服务健康检查端点
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  --max-time $TIMEOUT \
  "http://localhost:$PORT/health" 2>/dev/null)

if [ "$HTTP_STATUS" = "200" ]; then
  echo '{"success": true, "message": "服务已成功启动并在端口 3000 上响应！"}'
  exit 0
elif [ "$HTTP_STATUS" = "000" ]; then
  echo "{\"success\": false, \"message\": \"服务未启动或端口 $PORT 未监听，请运行 node app.js\"}"
  exit 1
else
  echo "{\"success\": false, \"message\": \"服务响应异常（HTTP $HTTP_STATUS），请检查服务是否正常\"}"
  exit 1
fi
