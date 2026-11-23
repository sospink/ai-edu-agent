import io
import json
import zipfile

import httpx
import pytest

from backend.gateway import GATEWAY_ERRORS
from backend.i18n import translate
from test_workbench import PROMPT, TOKEN, TestClient, app_for, success


@pytest.mark.parametrize("header,expected", [(None, None), ("7", 7), ("0", 0), (" 12 ", 12),
    ("9007199254740991", 9007199254740991), ("9007199254740992", None),
    ("-1", None), ("1.5", None), ("NaN", None), ("1e3", None), ("", None), ("1, 2", None)])
def test_upstream_config_version_persistence_and_export(tmp_path, header, expected):
    def handler(request):
        response = success(request)
        if header is not None:
            response.headers["X-Model-Config-Version"] = header
        return response
    with TestClient(app_for(tmp_path, handler)) as client:
        record = client.post("/api/run", json=PROMPT).json()
        assert record["configVersion"] == expected
        assert record["requestId"] == "gateway-real-request"
    with TestClient(app_for(tmp_path, handler)) as client:
        assert client.get("/api/experiments/" + record["id"]).json()["configVersion"] == expected
        assert client.get("/api/experiments").json()[0]["configVersion"] == expected
        with zipfile.ZipFile(io.BytesIO(client.get("/api/export").content)) as archive:
            assert json.loads(archive.read("experiments.json"))[0]["configVersion"] == expected


@pytest.mark.parametrize("error_type", list(GATEWAY_ERRORS))
def test_upstream_error_types_safe_bilingual(tmp_path, error_type):
    def handler(request):
        assert request.headers["authorization"] == "Bearer " + TOKEN
        return httpx.Response(502, json={"error": {"type": error_type, "message": TOKEN, "debug": "private-provider-url"}})
    with TestClient(app_for(tmp_path, handler)) as client:
        for language in ("zh-CN", "en-US"):
            response = client.post("/api/run", json=PROMPT, headers={"X-Locale": language})
            assert response.status_code == 502
            assert response.json()["detail"] == translate(GATEWAY_ERRORS[error_type], language)
            assert TOKEN not in response.text and "private-provider-url" not in response.text
            if language == "en-US":
                assert response.json()["detail"] != GATEWAY_ERRORS[error_type]
        assert client.get("/api/experiments").json() == []


@pytest.mark.parametrize("payload", [{"error": {"type": TOKEN}}, {"error": {"type": []}},
                                     {"error": None}, ["unexpected"], {"error": {"message": TOKEN}}])
def test_upstream_unknown_error_is_sanitized(tmp_path, payload):
    with TestClient(app_for(tmp_path, lambda request: httpx.Response(502, json=payload))) as client:
        response = client.post("/api/run", json=PROMPT, headers={"X-Locale": "en-US"})
        assert response.status_code == 502
        assert response.json()["detail"] == "The model gateway request failed (HTTP 502)."
        assert TOKEN not in response.text


def test_config_invalid_session_safe_and_bilingual(tmp_path):
    with TestClient(app_for(tmp_path, lambda request: httpx.Response(401, json={
        "error": {"type": "invalid_session", "message": TOKEN}}))) as client:
        result = client.get("/api/config", headers={"X-Locale": "en-US"}).json()
        assert result["configured"] is False and result["model"] == ""
        assert "session credentials" in result["detail"] and TOKEN not in result["detail"]


def test_model_switch_records_response_version_not_discovery_cache(tmp_path):
    versions = iter((3, 4))
    def handler(request):
        if request.method == "GET":
            assert request.headers["authorization"] == "Bearer " + TOKEN
            return httpx.Response(200, json={"data": [{"id": "kimi-for-coding"}]})
        response = success(request)
        version = next(versions)
        data = response.json()
        data["model"] = "kimi-for-coding" if version == 3 else "next-configured-model"
        return httpx.Response(200, headers={"X-Request-ID": f"actual-request-{version}",
                                          "X-Model-Config-Version": str(version)}, json=data)
    with TestClient(app_for(tmp_path, handler)) as client:
        assert client.get("/api/config").json()["model"] == "kimi-for-coding"
        first = client.post("/api/run", json=PROMPT).json()
        second = client.post("/api/run", json=PROMPT).json()
        assert (first["model"], first["configVersion"]) == ("kimi-for-coding", 3)
        assert (second["model"], second["configVersion"]) == ("next-configured-model", 4)
