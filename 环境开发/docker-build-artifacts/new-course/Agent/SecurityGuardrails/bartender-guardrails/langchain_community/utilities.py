"""Minimal utilities shim for NeMo Guardrails safetools registration.

These classes are placeholders used only so imports/class declarations succeed
in offline environments without langchain-community.
"""


class _BaseWrapper:
    def __init__(self, *args, **kwargs):
        pass


class ApifyWrapper(_BaseWrapper):
    pass


class BingSearchAPIWrapper(_BaseWrapper):
    pass


class GoogleSearchAPIWrapper(_BaseWrapper):
    pass


class GoogleSerperAPIWrapper(_BaseWrapper):
    pass


class OpenWeatherMapAPIWrapper(_BaseWrapper):
    pass


class SearxSearchWrapper(_BaseWrapper):
    pass


class SerpAPIWrapper(_BaseWrapper):
    pass


class WikipediaAPIWrapper(_BaseWrapper):
    pass


class WolframAlphaAPIWrapper(_BaseWrapper):
    pass


class ZapierNLAWrapper(_BaseWrapper):
    pass
