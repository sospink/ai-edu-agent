#!/bin/bash
# 示例：验证学生是否创建了指定文件
# 步骤说明：在 /workspace 目录下创建 hello.py 文件

TARGET_FILE="/workspace/hello.py"

if [ -f "$TARGET_FILE" ]; then
  echo '{"success": true, "message": "文件 hello.py 创建成功！"}'
  exit 0
else
  echo '{"success": false, "message": "未找到 hello.py 文件，请在 /workspace 目录下创建该文件"}'
  exit 1
fi
