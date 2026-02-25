# 下一步操作指南

## 当前状态

✅ **所有同步工作已完成**

- 6个课程的示例代码都已支持真实API调用
- 6个课程的Agent手册验证命令都已更新
- 6个课程的Agent手册都已添加环境配置步骤
- Dockerfile包含所有必要依赖
- 测试脚本已创建

---

## 你需要做什么

### 1. 构建Docker镜像

```bash
cd 环境开发
docker build -f Dockerfile.ai-courses-optimized -t opencode-lab-ai:latest .
```

**预计时间**: 10-15分钟

### 2. 运行容器

```bash
docker run -d \
  --name ai-lab \
  -p 2222:22 \
  -p 5901:5901 \
  -p 6080:6080 \
  opencode-lab-ai:latest
```

### 3. 配置API Key

```bash
# 进入容器
docker exec -it ai-lab bash

# 配置API Key
cp /workspace/.env.template /workspace/.env
nano /workspace/.env
```

在 `.env` 文件中填写你的真实API Key:

```bash
OPENAI_API_KEY=sk-你的真实API-Key
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
OPENAI_MODEL=qwen-turbo
```

保存并退出（Ctrl+O, Enter, Ctrl+X）

### 4. 运行验证测试

```bash
# 在容器内执行
cd /workspace/courses
chmod +x test-all-verifications.sh
./test-all-verifications.sh
```

**预期结果**: 所有6个课程测试通过

### 5. 更新Agent手册到数据库

```bash
# 在宿主机执行
cd EDU_Backend
npm run seed:ai-courses
```

这会将更新后的Agent手册同步到数据库。

---

## 验证清单

完成上述步骤后，请验证：

- [ ] Docker镜像构建成功
- [ ] 容器正常运行
- [ ] API Key已配置
- [ ] 所有6个课程测试通过
- [ ] Agent手册已更新到数据库
- [ ] 前端可以正常访问课程
- [ ] 教学Agent可以正常验证学生代码

---

## 如果遇到问题

### 问题1: Docker构建失败

**解决方案**:
- 检查网络连接
- 使用代理: `docker build --build-arg HTTP_PROXY=http://proxy:port ...`
- 查看构建日志找到具体错误

### 问题2: 测试失败

**解决方案**:
- 检查API Key是否正确
- 检查网络是否能访问通义千问API
- 查看具体的错误信息
- 尝试手动运行单个课程: `cd /workspace/courses/prompt-engineering && python3 example.py`

### 问题3: Agent手册验证失败

**解决方案**:
- 检查验证命令路径是否正确
- 检查示例代码是否存在
- 查看教学Agent的错误日志

---

## 相关文档

- [FINAL-SYNC-STATUS.md](./courses/FINAL-SYNC-STATUS.md) - 完整的同步状态
- [测试成功总结.md](./测试成功总结.md) - 之前的测试报告
- [API-配置说明.md](./API-配置说明.md) - API配置详细说明

---

**准备好了吗？开始第一步：构建Docker镜像！**
