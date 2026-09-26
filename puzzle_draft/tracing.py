"""Optional LangSmith tracing for the harness loop: one trace per generation (prompt + leak check, curator call,
memory check, Jev evaluation, gate), with the scorer's metrics attached as feedback.

On only when LANGSMITH_API_KEY is set and LANGSMITH_TRACING=true; otherwise every helper is a no-op. Builder-only:
the curator never reads LangSmith, and no answer key is sent (only scores and the curator's own digest).
"""

import contextlib
import os

_client = None


def enabled() -> bool:
    return bool(os.environ.get("LANGSMITH_API_KEY")) and os.environ.get("LANGSMITH_TRACING", "").lower() == "true"


def client():
    global _client
    if _client is None and enabled():
        from langsmith import Client
        _client = Client()
    return _client


@contextlib.contextmanager
def span(name: str, run_type: str = "chain", inputs=None, metadata=None, tags=None):
    if not enabled():
        yield None
        return
    from langsmith import trace
    with trace(name, run_type=run_type, inputs=inputs or {}, metadata=metadata or {}, tags=tags or [],
               project_name=os.environ.get("LANGSMITH_PROJECT") or None, client=client()) as rt:
        yield rt


def out(rt, outputs: dict) -> None:
    if rt is not None:
        rt.add_outputs(outputs)


def url(rt) -> str | None:
    """Link to a finished, uploaded trace (call after flush())."""
    if rt is None:
        return None
    try:
        return client().get_run_url(run=rt, project_name=os.environ.get("LANGSMITH_PROJECT") or "default")
    except Exception:
        return None


def scores(rt, values: dict) -> None:
    """The scorer's metrics as LangSmith feedback on the generation's trace (sortable, chartable per generation)."""
    if rt is None:
        return
    for key, value in values.items():
        if value is not None:
            try:
                client().create_feedback(rt.id, key=key, score=float(value))
            except Exception:
                pass


def flush() -> None:
    if _client is not None:
        try:
            _client.flush()
        except Exception:
            pass
