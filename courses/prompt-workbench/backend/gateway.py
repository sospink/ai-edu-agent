"""受限网关调用；不记录请求头、配置或上游错误正文。"""

import asyncio
import os
import re
import time
from dataclasses import dataclass, field
from urllib.parse import urlsplit

import httpx
from fastapi import HTTPException


GATEWAY_ERRORS = {
    "provider_balance": "模型服务账户余额不足，请联系教师或管理员处理",
    "provider_auth": "模型服务凭证或权限被拒绝，请联系管理员检查上游配置",
    "provider_limit": "模型服务额度或频率已达限制，请稍后重试或联系管理员",
    "provider_unavailable": "模型服务暂时不可达或请求超时，请稍后重试",
    "provider_error": "模型服务拒绝了请求，请联系管理员检查服务状态",
    "invalid_session": "当前 Lab 会话凭证已失效，请重新进入实验环境",
    "ai_disabled": "当前课程的 AI 辅助已停用，请联系教师",
    "course_limit": "课程模型并发或请求次数已达限制，请稍后重试",
    "model_unavailable": "课程模型尚未配置或配置不可用，请联系管理员",
    "model_not_allowed": "请求的模型不在课程允许范围内，请检查模型别名",
    "invalid_request": "模型请求格式无效或内容过大，请检查输入",
    "invalid_messages": "模型请求的消息格式或数量不符合要求",
    "unsupported_parameter": "模型请求包含课程不支持的参数",
    "output_limit": "模型请求的输出长度超出课程限制",
    "request_id_failed": "网关无法创建请求标识，请稍后重试",
    "invalid_response": "模型服务返回了无效响应，请稍后重试",
}


def gateway_detail(response):
    # 只消费已知类型，不透传任意上游 message、URL、鉴权信息或未知类型。
    try:
        error_type = response.json()["error"]["type"]
        if isinstance(error_type, str) and error_type in GATEWAY_ERRORS:
            return GATEWAY_ERRORS[error_type]
    except (ValueError, KeyError, TypeError):
        pass
    return f"模型网关请求失败（HTTP {response.status_code}）"


def config_version(response):
    value = response.headers.get("X-Model-Config-Version", "").strip()
    # 限制为 JavaScript 可精确表示的非负整数；缺失或非法值表示未知。
    if not re.fullmatch(r"[0-9]{1,16}", value):
        return None
    version = int(value)
    return version if version <= 9007199254740991 else None


@dataclass(repr=False)
class Settings:
    base_url: str = field(default_factory=lambda: os.getenv("EDU_MODEL_BASE_URL", "").rstrip("/"))
    token: str = field(default_factory=lambda: os.getenv("EDU_MODEL_TOKEN", ""))
    model: str = field(default_factory=lambda: os.getenv("EDU_MODEL_NAME", "course-model"))

    @property
    def configured(self):
        try:
            url = urlsplit(self.base_url)
            url.port
        except ValueError:
            return False
        return bool(url.scheme in ("http", "https") and url.netloc and not url.username
                    and not url.password and not url.query and not url.fragment and self.token and self.model)

    def protect(self, value):
        # 防止网关意外回显凭证后进入浏览器、数据库或成果包。
        import json
        serialized = json.dumps(value, ensure_ascii=False)
        if self.token and self.token in serialized:
            raise HTTPException(502, "内容包含受限凭证，已拒绝保存或返回")


class Gateway:
    def __init__(self, settings, transport=None):
        self.settings = settings
        self.transport = transport
        self._probe_lock = asyncio.Lock()
        self._probe_cache = None

    async def probe(self):
        # 缓存只存安全结果，不缓存凭证或网关响应正文。
        async with self._probe_lock:
            if self._probe_cache and self._probe_cache[0] > time.monotonic():
                return dict(self._probe_cache[1])
            result = {"configured": False, "model": "", "detail": "当前 Lab 尚未配置可用的模型网关"}
            if self.settings.configured:
                try:
                    async with asyncio.timeout(5):
                        async with httpx.AsyncClient(timeout=5, transport=self.transport,
                                                     follow_redirects=False, trust_env=False) as client:
                            response = await client.get(self.settings.base_url + "/models",
                                headers={"Authorization": "Bearer " + self.settings.token})
                    if response.status_code != 200:
                        result["detail"] = gateway_detail(response)
                    else:
                        data = response.json()["data"]
                        if not isinstance(data, list):
                            raise ValueError("模型列表格式无效")
                        models = list(dict.fromkeys(item["id"] for item in data if isinstance(item, dict)
                                      and isinstance(item.get("id"), str) and item["id"].strip()))
                        selected = self.settings.model if self.settings.model in models else (models[0] if len(models) == 1 else "")
                        if selected:
                            self.settings.protect(selected)
                            result = {"configured": True, "model": selected,
                                      "detail": "模型网关已连接，模型列表可用；实际生成仍可能受额度或服务状态限制"}
                        else:
                            result["detail"] = "模型网关未返回可用且明确的模型"
                except (httpx.TimeoutException, TimeoutError):
                    result["detail"] = "模型网关请求超时"
                except httpx.RequestError:
                    result["detail"] = "无法连接模型网关"
                except (ValueError, KeyError, TypeError, HTTPException):
                    result["detail"] = "模型网关探测失败，请检查 Lab 网关授权或稍后重试"
            self._probe_cache = (time.monotonic() + 5, result)
            return dict(result)

    async def complete(self, prompt):
        settings = self.settings
        if not settings.configured:
            raise HTTPException(503, "当前 Lab 尚未配置可用的模型网关")
        try:
            async with asyncio.timeout(90):
                async with httpx.AsyncClient(timeout=90, transport=self.transport, follow_redirects=False,
                                             trust_env=False) as client:
                    response = await client.post(settings.base_url + "/chat/completions",
                        headers={"Authorization": "Bearer " + settings.token},
                        json={"model": settings.model, "stream": False, "max_tokens": prompt["maxTokens"],
                              "messages": [
                                  {"role": "system", "content": prompt["instruction"]},
                                  {"role": "user", "content": "背景资料：\n" + prompt["context"] +
                                   "\n\n原始输入：\n" + prompt["input"] + "\n\n输出要求：\n" + prompt["outputRequirements"]}]})
            if response.status_code != 200:
                code = response.status_code if response.status_code in (400, 401, 403, 429, 503, 504) else 502
                raise HTTPException(code, gateway_detail(response))
            data = response.json()
            request_id = response.headers.get("X-Request-ID", "").strip()
            content = data["choices"][0]["message"]["content"]
            model = data.get("model")
            if not request_id or not isinstance(content, str) or not isinstance(model, str) or not model:
                raise ValueError("缺少可追溯信息")
            usage = data.get("usage")
            if usage is not None:
                if not isinstance(usage, dict):
                    raise ValueError("无效用量")
                usage = {key: usage[key] for key in ("prompt_tokens", "completion_tokens", "total_tokens") if key in usage}
                if any(type(value) is not int or value < 0 for value in usage.values()):
                    raise ValueError("无效用量")
            result = {"response": content, "model": model, "requestId": request_id,
                      "configVersion": config_version(response), "usage": usage}
            settings.protect(result)
            return result
        except (httpx.TimeoutException, TimeoutError):
            raise HTTPException(504, "模型网关请求超时") from None
        except httpx.RequestError:
            raise HTTPException(502, "无法连接模型网关") from None
        except (ValueError, KeyError, IndexError, TypeError):
            raise HTTPException(502, "模型网关响应无效或缺少真实请求标识") from None
