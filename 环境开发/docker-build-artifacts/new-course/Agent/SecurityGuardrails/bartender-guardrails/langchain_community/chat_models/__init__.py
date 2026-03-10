"""Minimal chat_models shim used by NeMo Guardrails provider discovery."""

# Mapping of class name -> module path in real langchain_community.
# Empty mapping means no community chat providers are auto-registered.
_module_lookup = {}
