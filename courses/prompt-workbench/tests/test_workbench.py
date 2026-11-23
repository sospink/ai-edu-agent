import asyncio
import io
import json
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import zipfile

import httpx
import pytest
from fastapi.testclient import TestClient as ASGITestClient

from backend.exporter import build_export
from backend.gateway import Settings
from backend.main import create_app
from backend.store import Store
from backend.validation import validate_output


TOKEN = "-".join(("test", "only", "credential", "never", "use", "in", "production"))


def TestClient(*args, **kwargs):
    kwargs.setdefault("client", ("127.0.0.1", 12345))
    return ASGITestClient(*args, **kwargs)


PROMPT = {"instruction": "提取报障信息", "context": "校园云服务", "input": "云盘显示503，无法上传。",
          "outputRequirements": "只输出 JSON", "maxTokens": 4096}
OUTPUT = {"service": "校园云盘", "symptom": "上传失败", "evidence": ["云盘显示503"], "missing_fields": ["发生时间"]}


def settings():
    return Settings(base_url="https://gateway.invalid/v1", token=TOKEN, model="course-model")


def success(request):
    assert request.headers["authorization"] == "Bearer " + TOKEN
    if request.method == "GET" and request.url.path == "/v1/models":
        return httpx.Response(200, json={"data": [{"id": "resolved-model"}]})
    assert request.url.path == "/v1/chat/completions"
    payload = json.loads(request.content)
    assert payload["model"] == "course-model"
    assert payload["max_tokens"] == 4096
    assert "temperature" not in payload and "top_p" not in payload
    return httpx.Response(200, headers={"X-Request-ID": "gateway-real-request"}, json={
        "model": "resolved-model", "choices": [{"message": {"content": json.dumps(OUTPUT, ensure_ascii=False)}}],
        "usage": {"prompt_tokens": 12, "completion_tokens": 23, "total_tokens": 35}})


def app_for(tmp_path, handler=success, **kwargs):
    return create_app(db_path=tmp_path / "db.sqlite3", settings=settings(),
                      transport=httpx.MockTransport(handler), **kwargs)


def test_full_lifecycle_and_restart(tmp_path):
    with TestClient(app_for(tmp_path)) as client:
        assert client.get("/api/health").json() == {"status": "ok", "version": "1.0.0"}
        assert client.get("/api/config").json()["configured"] is True
        assert TOKEN not in client.get("/api/config").text
        assert len(client.get("/api/samples").json()) >= 3
        assert client.get("/api/drafts").json() == []
        draft = client.post("/api/drafts", json={**PROMPT, "name": "初稿"}).json()
        draft["name"] = "修订稿"
        assert client.post("/api/drafts", json=draft).json()["name"] == "修订稿"
        assert len(client.get("/api/drafts").json()) == 1
        response = client.post("/api/run", json={**PROMPT, "draftId": draft["id"]})
        assert response.status_code == 200, response.text
        record = response.json()
        assert record["source"] == "live" and record["requestId"] == "gateway-real-request"
        assert record["model"] == "resolved-model" and record["usage"]["total_tokens"] == 35
        assert record["validation"]["valid"] is True
        assert record["prompt"] == PROMPT
        assert client.get("/api/experiments/" + record["id"]).json() == record
    with TestClient(app_for(tmp_path)) as client:
        assert client.get("/api/experiments").json() == [record]
        assert client.get("/api/drafts").json()[0]["name"] == "修订稿"
        for _ in range(2):
            assert client.delete("/api/drafts/" + draft["id"]).json() == {"deleted": True}
            assert client.delete("/api/experiments/" + record["id"]).json() == {"deleted": True}
        assert client.get("/api/experiments/" + record["id"]).status_code == 404


@pytest.mark.parametrize("change", [{"extra": True}, {"service": " "}, {"evidence": ["网络中断"]},
                                      {"evidence": [""]}, {"missing_fields": [12]}, {"symptom": None}])
def test_schema_and_evidence_reject(change):
    result = validate_output(json.dumps({**OUTPUT, **change}), PROMPT["input"])
    assert result["valid"] is False and result["issues"]


@pytest.mark.parametrize("text", ["```json\n{}\n```", "[]", "null", '{"service":"a","service":"b"}', '{"x":NaN}'])
def test_invalid_json_or_nonobject(text):
    result = validate_output(text, "")
    assert not result["valid"]
    assert result["parsed"] is None or isinstance(result["parsed"], dict)


def test_semantics_not_forced_equal():
    assert validate_output(json.dumps(OUTPUT), PROMPT["input"])["valid"]


@pytest.mark.parametrize("status", [401, 403, 429, 500, 302])
def test_upstream_failure_not_saved_or_leaked(tmp_path, status):
    def fail(request):
        return httpx.Response(status, text=TOKEN)
    with TestClient(app_for(tmp_path, fail)) as client:
        response = client.post("/api/run", json=PROMPT)
        assert response.status_code == (status if status in (401, 403, 429) else 502)
        assert TOKEN not in response.text
        assert client.get("/api/experiments").json() == []


@pytest.mark.parametrize("mode", ["missing_id", "bad_json", "bad_usage", "leaked_token", "missing_model", "timeout", "network"])
def test_bad_upstream(tmp_path, mode):
    def bad(request):
        if mode == "timeout":
            raise httpx.ReadTimeout("敏感异常" + TOKEN)
        if mode == "network":
            raise httpx.ConnectError(TOKEN)
        if mode == "bad_json":
            return httpx.Response(200, text="not json")
        response = success(request)
        data = response.json()
        if mode == "bad_usage":
            data["usage"] = {"total_tokens": True}
        if mode == "leaked_token":
            data["choices"][0]["message"]["content"] = TOKEN
        if mode == "missing_model":
            del data["model"]
        return httpx.Response(200, json=data, headers={} if mode == "missing_id" else response.headers)
    with TestClient(app_for(tmp_path, bad)) as client:
        response = client.post("/api/run", json=PROMPT)
        assert response.status_code == (504 if mode == "timeout" else 502)
        assert TOKEN not in response.text
        assert client.get("/api/experiments").json() == []


def test_missing_usage_is_null_and_invalid_model_output_preserved(tmp_path):
    def handler(request):
        return httpx.Response(200, headers={"X-Request-ID": "observed-id"}, json={
            "model": "observed-model", "choices": [{"message": {"content": "不是JSON"}}]})
    with TestClient(app_for(tmp_path, handler)) as client:
        record = client.post("/api/run", json=PROMPT).json()
        assert record["usage"] is None and record["validation"]["valid"] is False
        assert record["response"] == "不是JSON"


def test_unconfigured_and_invalid_input(tmp_path):
    app = create_app(db_path=tmp_path / "db", settings=Settings(base_url="", token="", model="course-model"))
    with TestClient(app) as client:
        assert client.get("/api/config").json()["configured"] is False
        assert client.post("/api/run", json=PROMPT).status_code == 503
        for update in ({"maxTokens": 4097}, {"maxTokens": True}, {"token": TOKEN}, {"input": " "}):
            response = client.post("/api/run", json={**PROMPT, **update})
            assert response.status_code == 422
            assert isinstance(response.json()["detail"], str) and TOKEN not in response.text
        assert client.post("/api/run", json={**PROMPT, "draftId": "missing"}).status_code == 404


def test_token_never_persisted(tmp_path):
    with TestClient(app_for(tmp_path)) as client:
        response = client.post("/api/drafts", json={**PROMPT, "name": "草稿", "context": TOKEN})
        assert response.status_code == 502 and TOKEN not in response.text
        assert client.get("/api/drafts").json() == []


def test_thread_safety_and_history_limit(tmp_path):
    store = Store(tmp_path / "db")
    def write(index):
        return store.save("experiment", {"id": str(index), "createdAt": f"{index:04}", "validation": {"valid": True}})
    with ThreadPoolExecutor(max_workers=12) as pool:
        list(pool.map(write, range(125)))
    assert len(store.snapshot()["experiment"]) == 125
    assert len(store.list("experiment")) == 100
    assert store.list("experiment")[0]["id"] == "124"


def test_disconnect_cancels_transport_without_record(tmp_path):
    async def scenario():
        started = asyncio.Event()
        cancelled = asyncio.Event()
        async def handler(request):
            started.set()
            try:
                await asyncio.Event().wait()
            except asyncio.CancelledError:
                cancelled.set()
                raise
        app = app_for(tmp_path, handler)
        body = json.dumps(PROMPT).encode()
        supplied = False
        async def receive():
            nonlocal supplied
            if not supplied:
                supplied = True
                return {"type": "http.request", "body": body, "more_body": False}
            # is_disconnected 使用取消作用域，必须在已就绪时立即返回。
            if started.is_set():
                return {"type": "http.disconnect"}
            await asyncio.sleep(10)
        messages = []
        async def send(message):
            messages.append(message)
        scope = {"type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1", "method": "POST",
                 "scheme": "http", "path": "/api/run", "raw_path": b"/api/run", "query_string": b"",
                 "root_path": "", "headers": [(b"content-type", b"application/json")],
                 "server": ("test", 80), "client": ("127.0.0.1", 123)}
        await asyncio.wait_for(app(scope, receive, send), timeout=3)
        assert cancelled.is_set()
        assert messages[0]["status"] == 499
        assert app.state.store().list("experiment") == []
    asyncio.run(scenario())


def test_static_api_priority_and_proxy_prefix(tmp_path):
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("<h1>工作台</h1>", encoding="utf-8")
    (dist / "app.js").write_text("console.log('ok')")
    app = app_for(tmp_path, dist_path=dist)
    with TestClient(app, root_path="/lab/session/proxy/8000") as client:
        assert client.get("/lab/session/proxy/8000/").status_code == 200
        assert client.get("/lab/session/proxy/8000/app.js").status_code == 200
        assert client.get("/lab/session/proxy/8000/api/health").json()["status"] == "ok"
        response = client.get("/lab/session/proxy/8000/api/not-found")
        assert response.status_code == 404 and response.json()["detail"] == "API 不存在"
    with TestClient(app_for(tmp_path, dist_path=tmp_path / "absent")) as client:
        assert client.get("/").status_code == 404
        assert client.get("/api").status_code == 404


def test_export_whitelist_links_secrets_and_snapshot(tmp_path):
    root = tmp_path / "project"
    (root / "frontend/src").mkdir(parents=True)
    (root / "backend").mkdir()
    (root / "samples").mkdir()
    outside = tmp_path / "outside.ts"
    outside.write_text("PRIVATE DATA")
    (root / "frontend/src/linked.ts").symlink_to(outside)
    (root / "frontend/src/external").symlink_to(tmp_path, target_is_directory=True)
    (root / "frontend/src/main.ts").write_text("export const value = 1")
    (root / "frontend/src/key.ts").write_text(TOKEN)
    (root / "backend/runtime.json").write_text(TOKEN)
    (root / ".env").write_text(TOKEN)
    (root / "frontend/node_modules").mkdir()
    (root / "frontend/node_modules/dependency.ts").write_text("excluded")
    (root / "samples/credentials.json").write_text("{}")
    snapshot = {"draft": [{"id": "draft-1"}], "experiment": []}
    archive = zipfile.ZipFile(io.BytesIO(build_export(root, snapshot, TOKEN)))
    names = archive.namelist()
    assert "source/frontend/src/main.ts" in names
    assert "drafts.json" in names and "MANUAL_REVIEW.md" in names
    assert not any("linked" in name or "external" in name or "node_modules" in name or ".env" in name or "runtime" in name or "credentials" in name for name in names)
    assert all(TOKEN.encode() not in archive.read(name) and b"PRIVATE DATA" not in archive.read(name) for name in names)
    assert json.loads(archive.read("drafts.json")) == snapshot["draft"]


def test_api_export_contains_actual_history(tmp_path):
    with TestClient(app_for(tmp_path)) as client:
        record = client.post("/api/run", json=PROMPT).json()
        response = client.get("/api/export")
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/zip"
        archive = zipfile.ZipFile(io.BytesIO(response.content))
        assert "source/tests/test_workbench.py" in archive.namelist()
        assert "source/backend/main.py" in archive.namelist()
        assert "source/backend/exporter.py" in archive.namelist()
        assert json.loads(archive.read("experiments.json")) == [record]
        assert json.loads(archive.read("report.json"))["experimentCount"] == 1


def test_cancel_request_task_propagates_to_upstream(tmp_path):
    async def scenario():
        started = asyncio.Event()
        cancelled = asyncio.Event()
        async def handler(request):
            started.set()
            try:
                await asyncio.Event().wait()
            finally:
                cancelled.set()
        app = app_for(tmp_path, handler)
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            task = asyncio.create_task(client.post("/api/run", json=PROMPT))
            await asyncio.wait_for(started.wait(), 2)
            task.cancel()
            with pytest.raises(asyncio.CancelledError):
                await task
        assert cancelled.is_set()
        assert app.state.store().list("experiment") == []
    asyncio.run(scenario())


def test_storage_failure_is_json(tmp_path):
    database = tmp_path / "broken.sqlite3"
    database.write_text("invalid database")
    with TestClient(create_app(db_path=database, settings=settings())) as client:
        response = client.get("/api/health")
        assert response.status_code == 503
        assert response.json() == {"detail": "本地数据存储暂时不可用"}


def test_local_export_script():
    import os
    import subprocess
    import sys
    from tempfile import TemporaryDirectory
    root = Path(__file__).resolve().parents[1]
    # 导出必须位于课程内，不依赖 pytest 的 basetemp；断言失败也清理全部产物。
    with TemporaryDirectory(prefix=".artifacts-", dir=root / "tests") as directory:
        artifacts = Path(directory)
        target = artifacts / "local-export.zip"
        env = {**os.environ, "PYTHON": sys.executable, "PROMPT_WORKBENCH_DB": str(artifacts / "export.sqlite3"),
               "EDU_MODEL_TOKEN": "", "PYTHONDONTWRITEBYTECODE": "1"}
        result = subprocess.run(["bash", "scripts/export.sh", "--output", str(target)], cwd=root,
                                env=env, capture_output=True, text=True, timeout=20)
        assert result.returncode == 0, result.stderr
        with zipfile.ZipFile(target) as archive:
            assert json.loads(archive.read("drafts.json")) == []
            assert "source/scripts/check.sh" in archive.namelist()


def test_export_rejects_hardlinks_and_embedded_secrets(tmp_path):
    import os
    root = tmp_path / "project"
    (root / "frontend/src").mkdir(parents=True)
    original = tmp_path / "private.ts"
    original.write_text("private source")
    os.link(original, root / "frontend/src/copied.ts")
    snapshot = {"draft": [], "experiment": []}
    with zipfile.ZipFile(io.BytesIO(build_export(root, snapshot))) as archive:
        assert "source/frontend/src/copied.ts" not in archive.namelist()
    with pytest.raises(ValueError, match="凭证"):
        build_export(root, {"draft": [{"input": TOKEN}], "experiment": []}, TOKEN)
