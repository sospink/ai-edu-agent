import pytest

from test_workbench import PROMPT, TestClient, app_for


@pytest.mark.parametrize("field", ["instruction", "context", "input", "outputRequirements"])
@pytest.mark.parametrize("value", ["", " \t\n", "\u3000"])
@pytest.mark.parametrize("language", ["zh-CN", "en-US"])
def test_run_required_fields_rejected_without_gateway(tmp_path, field, value, language):
    calls = []

    def forbidden_gateway(request):
        calls.append(request)
        raise AssertionError("无效输入不得调用网关")

    with TestClient(app_for(tmp_path, forbidden_gateway)) as client:
        response = client.post("/api/run", json={**PROMPT, field: value}, headers={"X-Locale": language})
        assert response.status_code == 422
        detail = response.json()["detail"]
        assert isinstance(detail, str)
        if language == "en-US":
            assert detail.isascii()
        else:
            assert "不能为空" in detail or "不符合契约" in detail
        assert client.get("/api/experiments").json() == []
        assert calls == []


def test_drafts_allow_incomplete_four_elements(tmp_path):
    calls = []

    def forbidden_gateway(request):
        calls.append(request)
        raise AssertionError("保存草稿不得调用网关")

    with TestClient(app_for(tmp_path, forbidden_gateway)) as client:
        incomplete = {"instruction": "", "context": " \t", "input": "", "outputRequirements": "\n", "name": "未完成草稿"}
        response = client.post("/api/drafts", json=incomplete)
        assert response.status_code == 200
        record = response.json()
        for field, value in incomplete.items():
            assert record[field] == value
        assert client.get("/api/drafts").json() == [record]
        assert calls == []
