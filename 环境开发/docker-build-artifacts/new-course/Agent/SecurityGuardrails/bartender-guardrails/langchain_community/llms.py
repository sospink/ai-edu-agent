"""Minimal llms shim used by NeMo Guardrails provider discovery."""


def get_type_to_cls_dict():
    """Return empty provider mapping when community providers are unavailable."""
    return {}


# Backward compatibility path used by older code.
type_to_cls_dict = {}
