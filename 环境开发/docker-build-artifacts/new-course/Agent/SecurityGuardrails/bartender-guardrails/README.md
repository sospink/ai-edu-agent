# AI 酒吧调酒师 - NeMo Guardrails 完整实现

基于 NeMo Guardrails + Colang + GLM(OpenAI 兼容接口) 的完整护栏实现，包含：
- 输入护栏：拦截越狱、提示注入、违法内容
- 对话护栏：限制越界话题并引导回饮品领域
- 输出护栏：防止泄露商业机密与不当内容

## 项目结构

```text
bartender-guardrails/
├── config/
│   ├── config.yml
│   ├── actions.py
│   ├── kb/
│   │   └── drinks.md
│   └── rails/
│       ├── greeting.co
│       ├── bartender.co
│       ├── disallowed.co
│       ├── input_check.co
│       └── output_check.co
├── main.py
├── test_rails.py
├── test_glm.py
├── simple_main.py
├── setup_env.sh
└── requirements.txt
```

## 1. 安装依赖

```bash
cd bartender-guardrails
pip install -r requirements.txt
```

推荐优先使用初始化脚本（自动创建 `.venv` 并安装依赖）：

```bash
cd bartender-guardrails
bash setup_env.sh
source .venv/bin/activate
```

如果你在离线环境，项目根目录已提供 `nemoguardrails-0.20.0-py3-none-any.whl`，可手动安装：

```bash
pip install ../nemoguardrails-0.20.0-py3-none-any.whl
```

## 2. 配置环境变量

创建 `.env`：

```env
OPENAI_API_KEY=你的GLM_API_KEY
OPENAI_BASE_URL=https://open.bigmodel.cn/api/paas/v4
```

说明：
- `OPENAI_API_KEY` 必填。
- `OPENAI_BASE_URL` 可不填，默认会使用 GLM 兼容地址（具体模型配置见 `config/config.yml`）。

## 3. 运行完整 NeMo Guardrails 版本

交互模式：

```bash
python main.py
```

演示模式：

```bash
python main.py --demo
```

API 服务模式：

```bash
python main.py --server
```

指定其他配置目录：

```bash
python main.py --config /absolute/path/to/config
```

## 4. 运行测试

先测试模型连接：

```bash
python test_glm.py
```

再运行护栏回归测试：

```bash
python test_rails.py
```

## 5. 护栏策略说明

- `config/rails/input_check.co`
  - 输入前安全自检，拦截高风险请求。
- `config/rails/disallowed.co`
  - 对政治、违法、竞品攻击、商业机密、跑题、越狱进行显式流控。
- `config/rails/output_check.co`
  - 输出后安全自检，阻断不当内容。
- `config/actions.py`
  - 自定义 Action（推荐、知识查询、关键词安全检查）。

## 6. 常见问题

1. `ModuleNotFoundError: langchain_community`
   - 原因：NeMo Guardrails 运行依赖未安装完整。
   - 解决：`pip install -r requirements.txt`。

2. 启动时报 `OPENAI_API_KEY` 缺失
   - 解决：在 `.env` 或系统环境变量中设置 `OPENAI_API_KEY`。

3. `nemoguardrails server` 找不到配置
   - 解决：使用 `python main.py --server --config <绝对路径>`。

4. `externally-managed-environment`
   - 原因：系统 Python 开启了 PEP 668，禁止全局 `pip install`。
   - 解决：使用 `bash setup_env.sh` 后在 `.venv` 内运行。

## 7. 简化版说明

`simple_main.py` 是不依赖 NeMo Guardrails 的对照实现，仅用于教学对比。生产或实训验收建议使用 `main.py + config/` 的完整方案。
