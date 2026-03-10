# 🧠 创意风暴 - 多 Agent 协作系统

基于 LangGraph 和 GLM-4 的多智能体创意风暴协作系统。

## 项目结构

```
brainstorm-mas/
├── .env                    # 环境变量配置
├── config.py               # 配置管理
├── state.py                # 共享状态定义
├── agents.py               # 所有 Agent 定义（创意/评审/优化/汇报）
├── workflow.py             # LangGraph 工作流编排
├── server.py               # FastAPI 服务
├── main.py                 # 主程序入口
└── requirements.txt        # 依赖清单
```

## 安装依赖

```bash
pip install -r requirements.txt
```

## 运行方式

### 命令行交互模式

```bash
python main.py
```

### 演示模式（自动执行）

```bash
python main.py --demo
```

### 启动 API 服务

```bash
python main.py --api
```

然后访问 http://localhost:8000/docs 查看 API 文档

## API 调用示例

```bash
# 同步调用
curl -X POST http://localhost:8000/brainstorm \
  -H "Content-Type: application/json" \
  -d '{"topic": "AI赋能的智慧校园管理平台", "requirements": "面向高职院校"}'

# 流式调用（SSE）
curl -X POST http://localhost:8000/brainstorm/stream \
  -H "Content-Type: application/json" \
  -d '{"topic": "面向Z世代的AI学习伴侣"}'
```

## Agent 角色

| 角色 | 描述 | 温度 |
|------|------|------|
| 🔧 技术创意 Agent | 从技术可行性角度提出创意 | 0.9 |
| 💰 商业创意 Agent | 从商业价值角度提出创意 | 0.9 |
| 🎨 用户体验 Agent | 从用户体验角度提出创意 | 0.9 |
| 📝 评审 Agent | 对所有创意进行评分筛选 | 0.3 |
| ✨ 优化 Agent | 对 Top-K 创意进行深化 | 0.5 |
| 📊 汇报 Agent | 生成最终创意报告 | 0.3 |
