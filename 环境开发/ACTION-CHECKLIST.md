# 行动清单

## ✅ 已完成的工作

- [x] 检查所有6个课程的示例代码
- [x] 确认5个课程已有真实API调用
- [x] 完善ade-skill示例代码的API调用
- [x] 确认所有验证命令路径正确
- [x] 确认4个手册已有环境配置步骤
- [x] 为多Agent手册添加环境配置步骤
- [x] 为AI安全手册添加环境配置步骤
- [x] 创建自动化测试脚本
- [x] 创建完整的同步状态文档
- [x] 创建操作指南文档
- [x] 创建修改总结文档

## 📋 你需要做的事情

### 第1步: 构建Docker镜像 ⏱️ 10-15分钟

```bash
cd 环境开发
docker build -f Dockerfile.ai-courses-optimized -t opencode-lab-ai:latest .
```

**检查点**: 构建成功,无错误

---

### 第2步: 运行容器 ⏱️ 1分钟

```bash
docker run -d \
  --name ai-lab \
  -p 2222:22 \
  -p 5901:5901 \
  -p 6080:6080 \
  opencode-lab-ai:latest
```

**检查点**: 容器正常运行 `docker ps | grep ai-lab`

---

### 第3步: 配置API Key ⏱️ 2分钟

```bash
# 进入容器
docker exec -it ai-lab bash

# 配置API Key
cp /workspace/.env.template /workspace/.env
nano /workspace/.env
```

填写真实的API Key:
```bash
OPENAI_API_KEY=sk-你的真实API-Key
```

保存退出: `Ctrl+O` → `Enter` → `Ctrl+X`

**检查点**: `cat /workspace/.env` 显示正确的API Key

---

### 第4步: 运行验证测试 ⏱️ 5分钟

```bash
# 在容器内执行
cd /workspace/courses
chmod +x test-all-verifications.sh
./test-all-verifications.sh
```

**检查点**: 所有6个课程测试通过

**如果失败**:
- 检查API Key是否正确
- 检查网络连接
- 手动测试单个课程找出问题

---

### 第5步: 更新Agent手册到数据库 ⏱️ 2分钟

```bash
# 退出容器,在宿主机执行
exit
cd EDU_Backend
npm run seed:ai-courses
```

**检查点**: 数据库更新成功,无错误

---

### 第6步: 前端验证 ⏱️ 5分钟

1. 访问前端: `http://localhost:5173`
2. 进入任意课程
3. 查看实验手册是否正确显示
4. 检查环境配置步骤是否存在
5. 尝试运行验证命令

**检查点**: 
- 手册显示正常
- 环境配置步骤清晰
- 验证命令可以执行

---

### 第7步: 教学Agent验证 ⏱️ 10分钟

1. 在前端进入课程实验
2. 按照手册步骤操作
3. 让教学Agent验证你的代码
4. 确认验证命令正确执行
5. 确认验证结果正确返回

**检查点**:
- Agent可以正确验证代码
- 验证命令路径正确
- 验证结果符合预期

---

## 🎯 最终验证清单

完成所有步骤后,确认以下项目:

- [ ] Docker镜像构建成功
- [ ] 容器正常运行
- [ ] API Key已配置
- [ ] 所有6个课程测试通过
- [ ] Agent手册已更新到数据库
- [ ] 前端可以正常访问课程
- [ ] 手册显示环境配置步骤
- [ ] 教学Agent可以正常验证代码
- [ ] 验证命令路径正确
- [ ] 验证结果符合预期

---

## 📊 预计总时间

- 构建镜像: 10-15分钟
- 运行容器: 1分钟
- 配置API: 2分钟
- 运行测试: 5分钟
- 更新数据库: 2分钟
- 前端验证: 5分钟
- Agent验证: 10分钟

**总计**: 约35-40分钟

---

## 🆘 遇到问题?

### 问题1: Docker构建失败

**症状**: 构建过程中出现错误

**解决方案**:
1. 检查网络连接
2. 查看错误日志找到具体问题
3. 如果是网络问题,使用代理
4. 如果是依赖问题,检查Dockerfile

### 问题2: 测试失败

**症状**: test-all-verifications.sh 报告失败

**解决方案**:
1. 检查API Key是否正确配置
2. 检查网络是否能访问通义千问API
3. 手动运行单个课程找出问题:
   ```bash
   cd /workspace/courses/prompt-engineering
   python3 example.py
   ```
4. 查看具体的错误信息

### 问题3: Agent验证失败

**症状**: 教学Agent无法验证代码

**解决方案**:
1. 检查验证命令路径是否正确
2. 检查示例代码文件是否存在
3. 查看Agent的错误日志
4. 确认数据库中的手册已更新

---

## 📚 参考文档

- [NEXT-STEPS.md](./NEXT-STEPS.md) - 详细操作指南
- [FINAL-SYNC-STATUS.md](./courses/FINAL-SYNC-STATUS.md) - 完整同步状态
- [CHANGES-SUMMARY.md](./CHANGES-SUMMARY.md) - 修改内容总结
- [测试成功总结.md](./测试成功总结.md) - 之前的测试报告

---

**准备好了吗? 开始第1步!** 🚀
