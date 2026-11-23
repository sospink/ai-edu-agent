import pytest
from fastapi.testclient import TestClient

from backend.gateway import Settings
from backend.main import create_app
from test_workbench import PROMPT, TOKEN, app_for


@pytest.mark.parametrize("path", ["/", "/app.js", "/api/config", "/api/samples", "/api/drafts",
    "/api/experiments", "/api/experiments/private", "/api/export", "/openapi.json", "/api/missing"])
@pytest.mark.parametrize("headers", [{}, {"X-EDU-Lab-Access": "wrong"},
    {"X-Forwarded-For": "127.0.0.1", "Forwarded": "for=127.0.0.1", "X-Real-IP": "::1"}])
def test_access_cross_pod_rejected_before_routes(tmp_path, path, headers):
    app = app_for(tmp_path)
    with TestClient(app, client=("10.244.2.18", 32100)) as client:
        response = client.get(path, headers=headers)
        assert response.status_code == 403
        assert TOKEN not in response.text
        assert response.headers["cache-control"] == "no-store"
    assert not (tmp_path / "db.sqlite3").exists()


@pytest.mark.parametrize("host", ["127.0.0.1", "::1"])
@pytest.mark.parametrize("token", [TOKEN, ""])
def test_access_loopback_and_anonymous_readiness(tmp_path, host, token):
    app = create_app(db_path=tmp_path / "db", settings=Settings(base_url="", token=token))
    with TestClient(app, client=(host, 12345)) as client:
        assert client.get("/api/drafts").json() == []
    with TestClient(app, client=("10.244.0.1", 12345)) as client:
        response = client.get("/api/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok", "version": "1.0.0"}
        for method in ("POST", "HEAD", "OPTIONS", "DELETE"):
            assert client.request(method, "/api/health").status_code == 403
        assert client.get("/api/health/").status_code == 403
        assert client.get("/api/health/private").status_code == 403


def test_access_correct_header_static_api_and_proxy_root(tmp_path):
    dist = tmp_path / "dist"
    dist.mkdir()
    (dist / "index.html").write_text("<h1>private lab</h1>")
    (dist / "app.js").write_text("const app = true;")
    app = app_for(tmp_path, dist_path=dist)
    root = "/lab/session/proxy/8000"
    with TestClient(app, client=("10.244.1.2", 12345), root_path=root) as client:
        assert client.get(root + "/api/health").status_code == 200
        assert client.get(root + "/").status_code == 403
        headers = {"X-EDU-Lab-Access": TOKEN}
        for path in ("/", "/app.js", "/api/config", "/api/drafts", "/api/export"):
            response = client.get(root + path, headers=headers)
            assert response.status_code == 200
            assert TOKEN.encode() not in response.content
        response = client.post(root + "/api/run", json=PROMPT, headers=headers)
        assert response.status_code == 200
        assert response.json()["requestId"] == "gateway-real-request"


@pytest.mark.parametrize("token", [TOKEN, ""])
def test_access_reject_bad_headers_and_nonloopback_names(tmp_path, token):
    app = create_app(db_path=tmp_path / "db", settings=Settings(base_url="", token=token))
    for host in ("localhost", "127.0.0.2", "::ffff:127.0.0.1", "10.244.2.18"):
        with TestClient(app, client=(host, 12345)) as client:
            for headers in ({}, {"X-EDU-Lab-Access": ""}, {"X-EDU-Lab-Access": "wrong"},
                            [("X-EDU-Lab-Access", TOKEN), ("X-EDU-Lab-Access", TOKEN)]):
                assert client.get("/api/drafts", headers=headers).status_code == 403
            if not token:
                assert client.get("/api/drafts", headers={"X-EDU-Lab-Access": TOKEN}).status_code == 403


def test_access_blocks_write_before_body_parsing_and_is_bilingual(tmp_path):
    with TestClient(app_for(tmp_path), client=("10.244.2.18", 12345)) as client:
        for path in ("/api/run", "/api/drafts", "/api/validate"):
            response = client.post(path, content=b"invalid json", headers={"X-Locale": "en-US"})
            assert response.status_code == 403
            assert "forbidden" in response.json()["detail"]
            assert TOKEN not in response.text
    assert not (tmp_path / "db.sqlite3").exists()
