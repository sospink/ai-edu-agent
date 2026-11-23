"""仅翻译服务生成的说明，用户输入、模型输出和解析数据保持原样。"""

import re
from copy import deepcopy

MESSAGES = {
    "指令、背景、原始输入和输出要求均不能为空或仅含空白": "Instruction, context, input and output requirements must all contain non-whitespace text.",
    "无权访问此实验环境，请通过平台课程入口访问": "Access to this lab environment is forbidden. Open it through the course platform.",
    "模型服务账户余额不足，请联系教师或管理员处理": "The model provider account has insufficient balance. Contact your teacher or administrator.",
    "模型服务凭证或权限被拒绝，请联系管理员检查上游配置": "The model provider rejected its credentials or permissions. Ask an administrator to check the provider configuration.",
    "模型服务额度或频率已达限制，请稍后重试或联系管理员": "The model provider quota or rate limit has been reached. Retry later or contact an administrator.",
    "模型服务暂时不可达或请求超时，请稍后重试": "The model provider is unreachable or the request timed out. Try again later.",
    "模型服务拒绝了请求，请联系管理员检查服务状态": "The model provider rejected the request. Ask an administrator to check the service.",
    "当前 Lab 会话凭证已失效，请重新进入实验环境": "The Lab session credentials have expired or are invalid. Reopen the lab environment.",
    "当前课程的 AI 辅助已停用，请联系教师": "AI assistance is disabled for this course. Contact your teacher.",
    "课程模型并发或请求次数已达限制，请稍后重试": "The course model concurrency or request limit has been reached. Try again later.",
    "课程模型尚未配置或配置不可用，请联系管理员": "The course model is not configured or its configuration is unavailable. Contact an administrator.",
    "请求的模型不在课程允许范围内，请检查模型别名": "The requested model is not allowed for this course. Check the model alias.",
    "模型请求格式无效或内容过大，请检查输入": "The model request is invalid or too large. Check the input.",
    "模型请求的消息格式或数量不符合要求": "The model request has an invalid message format or message count.",
    "模型请求包含课程不支持的参数": "The model request includes a parameter that this course does not support.",
    "模型请求的输出长度超出课程限制": "The requested output length exceeds the course limit.",
    "网关无法创建请求标识，请稍后重试": "The gateway could not create a request ID. Try again later.",
    "模型服务返回了无效响应，请稍后重试": "The model provider returned an invalid response. Try again later.",
    "内容包含受限凭证，已拒绝保存或返回": "Restricted credentials detected; saving or returning this content is not allowed.",
    "当前 Lab 尚未配置可用的模型网关": "This Lab does not have a configured model gateway.",
    "模型网关请求超时": "The model gateway request timed out.",
    "无法连接模型网关": "Unable to connect to the model gateway.",
    "模型网关响应无效或缺少真实请求标识": "The model gateway response is invalid or lacks a genuine request ID.",
    "请求字段、类型或长度不符合契约": "Request fields, types or lengths do not match the API contract.",
    "本地数据存储暂时不可用": "Local data storage is temporarily unavailable.",
    "实验记录不存在": "The experiment does not exist.",
    "原始输入不能为空": "The original input must not be empty.",
    "关联草稿不存在": "The linked draft does not exist.",
    "客户端已取消请求": "The client cancelled the request.",
    "API 不存在": "The API does not exist.",
    "源码成果超过导出大小限制": "Source files exceed the export size limit.",
    "成果含疑似凭证，请清理相关草稿或实验后重试": "Possible credentials found in the results. Remove them from drafts or experiments and retry.",
    "输出必须是合法 JSON，不能包含代码围栏、重复字段或非有限数值": "Output must be valid JSON without code fences, duplicate fields or non-finite numbers.",
    "证据必须是原始输入中非空的直接引用": "Evidence must be a non-empty direct quotation from the original input.",
    "模型网关已连接，模型列表可用；实际生成仍可能受额度或服务状态限制": "The gateway is reachable and its model list is available. Generation may still be limited by quota or service availability.",
    "模型网关未返回可用且明确的模型": "The gateway did not return an unambiguous available model.",
    "模型网关探测失败，请检查 Lab 网关授权或稍后重试": "Gateway discovery failed. Check the Lab gateway authorization or try again later.",
    "本地文件暂时不可用": "Local files are temporarily unavailable.",
    "Not Found": "Not Found",
    "Method Not Allowed": "Method Not Allowed",
}


def locale(request):
    explicit = request.headers.get("X-Locale", "").lower()
    if explicit in ("zh-cn", "en-us"):
        return "en-US" if explicit == "en-us" else "zh-CN"
    candidates = []
    for position, entry in enumerate(request.headers.get("Accept-Language", "").split(",")):
        language, *parameters = entry.strip().lower().split(";")
        quality = 1.0
        try:
            for parameter in parameters:
                if parameter.strip().startswith("q="):
                    quality = float(parameter.strip()[2:])
        except ValueError:
            continue
        if 0 < quality <= 1 and language.split("-")[0] in ("en", "zh"):
            candidates.append((quality, -position, "en-US" if language.startswith("en") else "zh-CN"))
    return max(candidates)[2] if candidates else "zh-CN"


def translate(message, language):
    if language != "en-US":
        return {"Not Found": "资源不存在", "Method Not Allowed": "不支持此请求方法"}.get(message, message)
    if message in MESSAGES:
        return MESSAGES[message]
    match = re.fullmatch(r"模型网关请求失败（HTTP (\d+)）", message)
    if match:
        return f"The model gateway request failed (HTTP {match[1]})."
    match = re.fullmatch(r"不符合输出 Schema（(.+)）", message)
    if match:
        return f"Output does not match the schema ({match[1]})."
    return message


def validation_view(validation, language):
    result = deepcopy(validation)
    for issue in result["issues"]:
        issue["message"] = translate(issue["message"], language)
    return result


def experiment_view(record, language):
    return {**record, "configVersion": record.get("configVersion"),
            "validation": validation_view(record["validation"], language)}
