"""
server.py - FastAPI 服务模块
将多 Agent 工作流暴露为 RESTful API

服务化的意义：
1. 前端/其他系统可以调用
2. 支持并发请求
3. 支持流式输出（SSE），实时观察每个 Agent 的工作进度
"""

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from workflow import build_brainstorm_graph
import json
import asyncio


app = FastAPI(
    title="🧠 创意风暴 MAS API",
    description="基于 LangGraph 的多 Agent 创意风暴系统",
    version="1.0.0",
)

# 编译工作流（应用启动时只编译一次，避免重复开销）
brainstorm_graph = build_brainstorm_graph()


# ============================================================
# 请求/响应模型
# ============================================================

class BrainstormRequest(BaseModel):
    """创意风暴请求"""
    topic: str = Field(..., description="创意主题", examples=["AI驱动的个性化教育平台"])
    requirements: str = Field(default="", description="补充需求", examples=["面向K12学生"])


class BrainstormResponse(BaseModel):
    """创意风暴响应"""
    topic: str
    total_ideas: int
    top_ideas: list
    final_report: str


# ============================================================
# API 端点
# ============================================================

@app.post("/brainstorm", response_model=BrainstormResponse)
async def run_brainstorm(request: BrainstormRequest):
    """
    启动一次完整的创意风暴（同步）

    工作流：多视角创意生成 → 评审打分 → 方案优化 → 报告输出
    """
    initial_state = {
        "topic": request.topic,
        "requirements": request.requirements,
        "messages": [],
        "raw_ideas": [],
        "evaluated_ideas": [],
        "refined_ideas": [],
        "current_round": 1,
        "current_agent": "",
        "final_report": "",
    }

    try:
        final_state = await asyncio.to_thread(
            brainstorm_graph.invoke, initial_state
        )

        return BrainstormResponse(
            topic=request.topic,
            total_ideas=len(final_state.get("raw_ideas", [])),
            top_ideas=final_state.get("refined_ideas", [])[:5],
            final_report=final_state.get("final_report", "生成失败"),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创意风暴执行失败: {str(e)}")


@app.post("/brainstorm/stream")
async def run_brainstorm_stream(request: BrainstormRequest):
    """
    流式执行创意风暴（SSE）

    每个 Agent 执行完成后推送一条事件，前端可实时展示进度
    """
    initial_state = {
        "topic": request.topic,
        "requirements": request.requirements,
        "messages": [],
        "raw_ideas": [],
        "evaluated_ideas": [],
        "refined_ideas": [],
        "current_round": 1,
        "current_agent": "",
        "final_report": "",
    }

    async def event_generator():
        try:
            for event in brainstorm_graph.stream(initial_state):
                for node_name, node_output in event.items():
                    summary = _summarize(node_name, node_output)
                    data = json.dumps(
                        {"agent": node_name, "status": "completed", "summary": summary},
                        ensure_ascii=False,
                    )
                    yield f"data: {data}\n\n"

            yield f"data: {json.dumps({'agent': 'system', 'status': 'finished'}, ensure_ascii=False)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'agent': 'system', 'status': 'error', 'detail': str(e)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


def _summarize(node_name: str, output: dict) -> str:
    """为流式输出生成简要摘要"""
    if "raw_ideas" in output:
        return f"生成了 {len(output['raw_ideas'])} 条创意"
    elif "evaluated_ideas" in output:
        ideas = output["evaluated_ideas"]
        avg = sum(i.get("score", 0) for i in ideas) / max(len(ideas), 1)
        return f"评审完成，平均分 {avg:.1f}"
    elif "refined_ideas" in output:
        return f"优化了 {len(output['refined_ideas'])} 条创意"
    elif "final_report" in output:
        return "报告生成完成"
    return "执行中..."


@app.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "ok", "service": "brainstorm-mas"}
