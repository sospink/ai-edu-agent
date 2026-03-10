"""Offline compatibility shim for langchain_community.

This project runs in a restricted environment where installing
`langchain-community` from PyPI may be blocked.

The shim only exposes the minimal symbols NeMo Guardrails imports at startup.
"""

from . import llms  # re-export for: from langchain_community import llms

__all__ = ["llms"]
