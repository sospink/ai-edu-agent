import json

import httpx
import pytest

from backend.main import create_app
from backend.gateway import Settings
from test_workbench import OUTPUT, PROMPT, TOKEN, TestClient, app_for, settings, success


def test_config_real_model_cache_and_locale(tmp_path):
    calls = []
    def handler(request):
        calls.append(request)
        return success(request)
    app = app_for(tmp_path, handler)
    with TestClient(app) as client:
        zh = client.get("/api/config").json()
        en = client.get("/api/config", headers={"X-Locale": "en-US"}).json()
        assert zh["configured"] is True and zh["model"] == "resolved-model"
        assert en["model"] == zh["model"] and "reachable" in en["detail"]
        assert "模型网关" in zh["detail"] and len(calls) == 1
        app.state.gateway._probe_cache = (0, {})
        client.get("/api/config")
        assert len(calls) == 2


@pytest.mark.parametrize("mode", ["timeout", "network", "unauthorized", "redirect", "malformed", "empty", "ambiguous", "secret"])
def test_config_failure_reports_unavailable_safely(tmp_path, mode):
    def handler(request):
        if mode == "timeout":
            raise httpx.ReadTimeout(TOKEN)
        if mode == "network":
            raise httpx.ConnectError(TOKEN)
        if mode == "unauthorized":
            return httpx.Response(401, text=TOKEN)
        if mode == "redirect":
            return httpx.Response(302, headers={"location": "https://elsewhere.invalid"})
        if mode == "malformed":
            return httpx.Response(200, text=TOKEN)
        ids = {"empty": [], "ambiguous": ["first", "second"], "secret": [TOKEN]}[mode]
        return httpx.Response(200, json={"data": [{"id": identifier} for identifier in ids]})
    with TestClient(app_for(tmp_path, handler)) as client:
        response = client.get("/api/config", headers={"X-Locale": "en-US"})
        assert response.status_code == 200
        assert response.json()["configured"] is False
        assert response.json()["model"] == "" and response.json()["detail"]
        assert TOKEN not in response.text and "gateway.invalid" not in response.text


def test_config_exact_model_selected(tmp_path):
    def handler(request):
        return httpx.Response(200, json={"data": [{"id": "other"}, {"id": "course-model"}]})
    with TestClient(app_for(tmp_path, handler)) as client:
        assert client.get("/api/config").json()["model"] == "course-model"


def test_config_malformed_environment_safe(tmp_path):
    app = create_app(db_path=tmp_path / "db", settings=Settings(base_url="http://[invalid", token=TOKEN))
    with TestClient(app) as client:
        assert client.get("/api/config").json()["configured"] is False


@pytest.mark.parametrize("headers,english", [({}, False), ({"X-Locale": "en-US"}, True),
    ({"Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.5"}, True),
    ({"Accept-Language": "en-US;q=0.1,zh-CN;q=0.9"}, False),
    ({"X-Locale": "zh-CN", "Accept-Language": "en-US"}, False),
    ({"Accept-Language": "en;q=0,zh;q=1"}, False), ({"Accept-Language": "en;q=invalid"}, False)])
def test_locale_negotiation_and_samples(tmp_path, headers, english):
    with TestClient(app_for(tmp_path)) as client:
        samples = client.get("/api/samples", headers=headers).json()
        error = client.get("/api/experiments/missing", headers=headers).json()["detail"]
        assert ("Campus" in samples[0]["title"]) is english
        assert ("does not exist" in error) is english
        assert samples[0]["id"] == "cloud-drive"


def test_validation_locale_preserves_user_data_and_history(tmp_path):
    output = {**OUTPUT, "evidence": ["用户原始引用，不翻译"]}
    def handler(request):
        response = success(request)
        data = response.json()
        data["choices"][0]["message"]["content"] = json.dumps(output, ensure_ascii=False)
        return httpx.Response(200, headers=response.headers, json=data)
    app = app_for(tmp_path, handler)
    headers = {"X-Locale": "en-US"}
    with TestClient(app) as client:
        text = json.dumps(output, ensure_ascii=False)
        validation = client.post("/api/validate", headers=headers, json={"text": text, "input": PROMPT["input"]}).json()
        assert validation["parsed"] == output
        assert "direct quotation" in validation["issues"][0]["message"]
        record = client.post("/api/run", json=PROMPT, headers=headers).json()
        assert record["prompt"] == PROMPT and record["response"] == text
        assert "direct quotation" in record["validation"]["issues"][0]["message"]
        stored = app.state.store().get("experiment", record["id"])
        assert "原始输入" in stored["validation"]["issues"][0]["message"]
        assert client.get("/api/experiments", headers=headers).json()[0] == record
        zh = client.get("/api/experiments/" + record["id"]).json()
        assert zh["prompt"] == record["prompt"] and zh["response"] == text
        assert zh["validation"]["parsed"] == output


def test_locale_error_types(tmp_path):
    def handler(request):
        return httpx.Response(403, text=TOKEN)
    with TestClient(app_for(tmp_path, handler)) as client:
        headers = {"X-Locale": "en-US"}
        assert "HTTP 403" in client.post("/api/run", json=PROMPT, headers=headers).json()["detail"]
        assert "Request fields" in client.post("/api/run", json={}, headers=headers).json()["detail"]
        assert "API does not exist" in client.get("/api/missing", headers=headers).json()["detail"]
        result = client.post("/api/validate", json={"text": "{}", "input": "原文"}, headers=headers).json()
        assert all("schema" in issue["message"] for issue in result["issues"])
        result = client.post("/api/validate", json={"text": "bad", "input": "原文"}, headers=headers).json()
        assert "valid JSON" in result["issues"][0]["message"]
