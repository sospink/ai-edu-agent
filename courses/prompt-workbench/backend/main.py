"""课程 API；平台负责 Lab 入口鉴权，每个 Lab 使用独立数据库。"""

import asyncio
import hmac
import json
import os
import sqlite3
import time
from contextlib import suppress
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field
from starlette.exceptions import HTTPException as StarletteHTTPException

from .gateway import Gateway, Settings
from .store import Store
from .validation import validate_output
from .i18n import experiment_view, locale, translate, validation_view

ROOT = Path(__file__).resolve().parents[1]


class LabAccessMiddleware:
    def __init__(self, app, settings):
        self.app = app
        self.settings = settings

    async def __call__(self, scope, receive, send):
        if scope["type"] not in ("http", "websocket"):
            await self.app(scope, receive, send)
            return
        path = scope.get("path", "")
        root = scope.get("root_path", "").rstrip("/")
        if root and path.startswith(root + "/"):
            path = path[len(root):]
        health = scope["type"] == "http" and scope.get("method") == "GET" and path == "/api/health"
        client = scope.get("client")
        local = client is not None and client[0] in ("127.0.0.1", "::1")
        # 仅使用 ASGI 连接来源，不读取 Forwarded/X-Forwarded-For 等代理头。
        if not health and not local:
            supplied = [value for name, value in scope.get("headers", []) if name.lower() == b"x-edu-lab-access"]
            authorized = bool(self.settings.token) and len(supplied) == 1 and hmac.compare_digest(
                supplied[0], self.settings.token.encode("utf-8"))
            if not authorized:
                if scope["type"] == "websocket":
                    await send({"type": "websocket.close", "code": 1008})
                else:
                    response = JSONResponse(status_code=403, content={"detail": translate(
                        "无权访问此实验环境，请通过平台课程入口访问", locale(Request(scope)))},
                        headers={"Cache-Control": "no-store"})
                    await response(scope, receive, send)
                return
        await self.app(scope, receive, send)


class OptionalStaticFiles(StaticFiles):
    async def check_config(self):
        if Path(self.directory).exists():
            await super().check_config()


class Prompt(BaseModel):
    model_config = ConfigDict(extra="forbid")
    instruction: str = Field(max_length=32000)
    context: str = Field(max_length=64000)
    input: str = Field(min_length=1, max_length=64000)
    outputRequirements: str = Field(max_length=32000)
    maxTokens: int = Field(default=4096, ge=1, le=4096, strict=True)


class Run(Prompt):
    draftId: str | None = Field(default=None, max_length=128)


class Draft(Prompt):
    input: str = Field(default="", max_length=64000)
    id: str | None = Field(default=None, min_length=1, max_length=128, pattern=r"^[a-zA-Z0-9_-]+$")
    name: str = Field(min_length=1, max_length=200, pattern=r"\S")
    updatedAt: str | None = Field(default=None, max_length=64)


class ValidationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str = Field(max_length=200000)
    input: str = Field(max_length=64000)


def now():
    return datetime.now(timezone.utc).isoformat()


async def disconnected(request):
    while not await request.is_disconnected():
        await asyncio.sleep(0.025)


def create_app(*, db_path=None, settings=None, transport=None, dist_path=None):
    app = FastAPI(title="提示词工作台", version="1.0.0", docs_url=None, redoc_url=None)
    settings = settings or Settings()
    app.add_middleware(LabAccessMiddleware, settings=settings)
    # 延迟初始化，导入 ASGI 应用时不产生文件副作用。
    database = Path(db_path or os.getenv("PROMPT_WORKBENCH_DB", str(ROOT / "backend/data/workbench.sqlite3")))
    gateway = Gateway(settings, transport)

    def store():
        return Store(database)

    app.state.store = store
    app.state.gateway = gateway

    @app.exception_handler(StarletteHTTPException)
    async def http_error(request, exc):
        return JSONResponse(status_code=exc.status_code,
                            content={"detail": translate(str(exc.detail), locale(request))}, headers=exc.headers)

    @app.exception_handler(RequestValidationError)
    async def invalid_request(request, exc):
        return JSONResponse(status_code=422, content={"detail": translate("请求字段、类型或长度不符合契约", locale(request))})

    @app.exception_handler(sqlite3.Error)
    async def storage_error(request, exc):
        return JSONResponse(status_code=503, content={"detail": translate("本地数据存储暂时不可用", locale(request))})

    @app.exception_handler(OSError)
    async def file_error(request, exc):
        return JSONResponse(status_code=503, content={"detail": translate("本地文件暂时不可用", locale(request))})

    @app.get("/api/health")
    def health():
        store().list("draft", 1)
        return {"status": "ok", "version": "1.0.0"}

    @app.get("/api/config")
    async def config(request: Request):
        result = {**await gateway.probe(),
                  "capabilities": {"temperature": False, "topP": False, "maxTokens": True}, "maxOutputTokens": 4096}
        result["detail"] = translate(result["detail"], locale(request))
        return result

    @app.get("/api/samples")
    def samples(request: Request):
        name = "incidents.en-US.json" if locale(request) == "en-US" else "incidents.json"
        return json.loads((ROOT / "samples" / name).read_text(encoding="utf-8"))

    @app.get("/api/drafts")
    def drafts():
        return store().list("draft", -1)

    @app.post("/api/drafts")
    def save_draft(body: Draft):
        record = body.model_dump()
        record.update(id=body.id or str(uuid4()), updatedAt=now())
        settings.protect(record)
        return store().save("draft", record)

    @app.delete("/api/drafts/{identifier}")
    def delete_draft(identifier: str):
        store().delete("draft", identifier)
        return {"deleted": True}

    @app.get("/api/experiments")
    def experiments(request: Request):
        return [experiment_view(record, locale(request)) for record in store().list("experiment")]

    @app.get("/api/experiments/{identifier}")
    def experiment(identifier: str, request: Request):
        record = store().get("experiment", identifier)
        if record is None:
            raise HTTPException(404, "实验记录不存在")
        return experiment_view(record, locale(request))

    @app.delete("/api/experiments/{identifier}")
    def delete_experiment(identifier: str):
        store().delete("experiment", identifier)
        return {"deleted": True}

    @app.post("/api/validate")
    def validate(body: ValidationRequest, request: Request):
        settings.protect(body.model_dump())
        return validation_view(validate_output(body.text, body.input), locale(request))

    @app.post("/api/run")
    async def run(body: Run, request: Request):
        prompt = body.model_dump(exclude={"draftId"})
        settings.protect(prompt)
        if any(not prompt[field].strip() for field in ("instruction", "context", "input", "outputRequirements")):
            raise HTTPException(422, "指令、背景、原始输入和输出要求均不能为空或仅含空白")
        if body.draftId and store().get("draft", body.draftId) is None:
            raise HTTPException(404, "关联草稿不存在")
        started = time.monotonic()
        task = asyncio.create_task(gateway.complete(prompt))
        watcher = asyncio.create_task(disconnected(request))
        try:
            done, _ = await asyncio.wait((task, watcher), return_when=asyncio.FIRST_COMPLETED)
            if watcher in done or await request.is_disconnected():
                raise HTTPException(499, "客户端已取消请求")
            result = await task
            record = {"id": str(uuid4()), "createdAt": now(), "source": "live",
                      "latencyMs": round((time.monotonic() - started) * 1000), "prompt": prompt,
                      **result, "validation": validate_output(result["response"], body.input)}
            if await request.is_disconnected():
                raise HTTPException(499, "客户端已取消请求")
            store().save("experiment", record)
            return experiment_view(record, locale(request))
        finally:
            for pending in (task, watcher):
                pending.cancel()
            for pending in (task, watcher):
                with suppress(asyncio.CancelledError, Exception):
                    await pending

    @app.get("/api/export")
    def export():
        from .exporter import build_export
        try:
            content = build_export(ROOT, store().snapshot(), settings.token)
        except ValueError as exc:
            raise HTTPException(409, str(exc)) from None
        return Response(content, media_type="application/zip",
                        headers={"Content-Disposition": 'attachment; filename="prompt-workbench.zip"', "Cache-Control": "no-store"})

    # 未匹配 API 必须返回 JSON 404，不能被静态站点吞掉。
    @app.api_route("/api", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
    @app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
    def missing_api(path: str = ""):
        raise HTTPException(404, "API 不存在")

    dist = Path(dist_path) if dist_path else ROOT / "frontend/dist"
    app.mount("/", OptionalStaticFiles(directory=dist, html=True, check_dir=False), name="frontend")
    return app


app = create_app()
