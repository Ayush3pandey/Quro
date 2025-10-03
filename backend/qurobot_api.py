# qurobot_api.py
"""
QuroBot API Router for FastAPI.

This router is intentionally defensive:
- It tries to import your QuroBot module (common names).
- It detects available handlers in the module:
  * preferred: an instance method `UnifiedResearchChatbot.query`
  * or a plain function `handle_query(text, context)`
  * or functions named 'answer', 'run', 'respond', 'get_response'
- Chatbot instance (if needed) is created lazily on first request.
- Exposes: /ping, /info, /query (POST), /upload_pdf (POST)
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Any, Callable, Dict
import importlib
import importlib.util
import inspect
import os
import threading
import traceback
import logging

logger = logging.getLogger("qurobot-api")
router = APIRouter(prefix="/api/qurobot", tags=["qurobot"])

# ---------- Request/response models ----------
class QueryPayload(BaseModel):
    text: str
    context: Optional[Dict[str, Any]] = None

class UploadPDFPayload(BaseModel):
    pdf_path: str

# ---------- Dynamic import of your bot module ----------
_candidate_module_names = ["QuroBot", "qurobot", "Qurobot", "quroBot", "QuroBot.py", "qurobot.py"]
_bot_module = None
_bot_module_name = None

# Try direct import by module name (case-sensitive)
for name in ["QuroBot", "qurobot", "QuroBotModule"]:
    try:
        _bot_module = importlib.import_module(name)
        _bot_module_name = name
        break
    except Exception:
        _bot_module = None

# If direct import fails, try loading common filenames from cwd
if _bot_module is None:
    cwd = os.getcwd()
    for fname in ("QuroBot.py", "qurobot.py", "quroBot.py", "Qurobot.py"):
        fpath = os.path.join(cwd, fname)
        if os.path.exists(fpath):
            try:
                spec = importlib.util.spec_from_file_location("qurobot_module", fpath)
                mod = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(mod)  # type: ignore
                _bot_module = mod
                _bot_module_name = fname
                break
            except Exception as e:
                logger.error(f"Failed to load {fname}: {e}")
                _bot_module = None

if _bot_module is None:
    logger.warning("Could not import QuroBot module automatically. Ensure QuroBot.py exists in project root.")
else:
    logger.info(f"Loaded QuroBot module: {_bot_module_name}")

# ---------- Handler / Chatbot instance discovery ----------
_handler: Optional[Callable[..., Any]] = None
_handler_name: Optional[str] = None
_chatbot_instance = None
_instance_lock = threading.Lock()
_instance_info: Dict[str, Any] = {"created": False, "type": None}

def _discover_handler_from_module(mod) -> Optional[Callable[..., Any]]:
    """
    Return a callable that can be used to answer queries.
    Priority:
      1. If module defines UnifiedResearchChatbot class -> instantiate and use instance.query
      2. If module defines handle_query(text, context) -> use it
      3. If module defines functions answer/run/respond/get_response -> use first
    """
    # 1. UnifiedResearchChatbot class
    try:
        if hasattr(mod, "UnifiedResearchChatbot"):
            cls = getattr(mod, "UnifiedResearchChatbot")
            if inspect.isclass(cls):
                def factory_instance_query(text: str, context: Optional[dict] = None):
                    global _chatbot_instance
                    # create singleton instance lazily
                    if _chatbot_instance is None:
                        with _instance_lock:
                            if _chatbot_instance is None:
                                _chatbot_instance = cls()
                                _instance_info["created"] = True
                                _instance_info["type"] = "UnifiedResearchChatbot"
                    # call query method
                    return _chatbot_instance.query(text)
                factory_instance_query.__name__ = "UnifiedResearchChatbot.query"
                return factory_instance_query
    except Exception:
        logger.exception("Error detecting UnifiedResearchChatbot")

    # 2. handle_query function
    for name in ("handle_query", "handle", "answer", "run", "respond", "get_response"):
        try:
            if hasattr(mod, name) and callable(getattr(mod, name)):
                fn = getattr(mod, name)
                return fn
        except Exception:
            continue
    return None

# Detect handler now (but instance creation is lazy inside factory)
if _bot_module:
    _handler = _discover_handler_from_module(_bot_module)
    if _handler:
        _handler_name = getattr(_handler, "__name__", str(_handler))
        logger.info(f"QuroBot handler discovered: {_handler_name}")
    else:
        logger.warning("No handler discovered in QuroBot module. The API will return a fallback response.")

# ---------- Helper to call handler safely ----------
def _call_handler(text: str, context: Optional[dict] = None) -> Dict[str, Any]:
    """
    Calls the discovered handler and normalizes the result:
    returns {"reply": str, "meta": {...}}
    """
    if _handler is None:
        # fallback: no handler available
        return {"reply": f"QuroBot handler not available. Echo: {text}", "meta": {"success": False, "reason": "no_handler"}}

    try:
        sig = inspect.signature(_handler)
        # call with (text, context) if handler accepts two or more params
        if len(sig.parameters) >= 2:
            result = _handler(text, context or {})
        else:
            result = _handler(text)
        
        # Handle ChatbotResponse object (from UnifiedResearchChatbot.query)
        if hasattr(result, "answer") and hasattr(result, "sources"):
            reply = getattr(result, "answer", "")
            sources = getattr(result, "sources", [])
            method = getattr(result, "method", "unknown")
            mode = getattr(result, "mode", "unknown")
            
            return {
                "reply": str(reply), 
                "meta": {
                    "success": True,
                    "sources": sources,
                    "method": method,
                    "mode": mode
                }
            }
        
        # normalize response types for other formats
        if isinstance(result, dict):
            reply = result.get("reply") or result.get("text") or str(result)
            meta = result.get("meta", {"success": True})
            return {"reply": reply, "meta": meta}
        else:
            # otherwise stringify
            return {"reply": str(result), "meta": {"success": True}}
    except Exception as e:
        tb = traceback.format_exc()
        logger.exception("Error while calling QuroBot handler")
        return {"reply": f"Error processing query: {str(e)}", "meta": {"success": False, "error": str(e), "traceback": tb}}

# ---------- Router endpoints ----------
@router.get("/ping")
def ping():
    return {
        "status": "ok",
        "bot_module": _bot_module_name,
        "handler": _handler_name,
        "chatbot_instance_created": _instance_info.get("created", False)
    }

@router.get("/info")
def info():
    functions = []
    mod_info = None
    if _bot_module:
        mod_info = getattr(_bot_module, "__name__", _bot_module_name)
        try:
            for name in dir(_bot_module):
                if name.startswith("_"):
                    continue
                attr = getattr(_bot_module, name)
                if callable(attr):
                    functions.append(name)
        except Exception:
            functions = []
    return {
        "module": mod_info,
        "available_functions": sorted(functions),
        "handler": _handler_name,
        "chatbot_instance_created": _instance_info.get("created", False),
        "instance_type": _instance_info.get("type")
    }

@router.post("/query")
def query(payload: QueryPayload):
    """
    POST /api/qurobot/query
    Body: {"text": "...", "context": {...}}
    Response: {"reply": "...", "meta": {...}}
    """
    if not payload or not payload.text:
        raise HTTPException(status_code=400, detail="Missing 'text' in request body")

    res = _call_handler(payload.text, payload.context)
    if not res.get("meta", {}).get("success", True):
        # include error detail for debugging (sanitize for prod)
        raise HTTPException(status_code=500, detail=res["meta"])
    return res

@router.post("/upload_pdf")
def upload_pdf(payload: UploadPDFPayload):
    """
    Optional: ask the chatbot to upload a PDF and switch to PDF mode.
    Body: {"pdf_path": "/absolute/or/relative/path/to/file.pdf"}
    """
    pdf_path = payload.pdf_path
    if not pdf_path:
        raise HTTPException(status_code=400, detail="Missing 'pdf_path'")

    # If the underlying module provides UnifiedResearchChatbot and upload_pdf method,
    # create instance (if not created) and call upload_pdf.
    if _bot_module and hasattr(_bot_module, "UnifiedResearchChatbot"):
        # ensure instance exists by calling handler factory if not already created
        # _handler might already be factory that creates instance internally
        try:
            # If chatbot instance is not created, create it now (thread-safe)
            if _chatbot_instance is None:
                with _instance_lock:
                    if _chatbot_instance is None:
                        cls = getattr(_bot_module, "UnifiedResearchChatbot")
                        _chatbot_instance_local = cls()
                        # assign to global instance used by factory above
                        globals()["_chatbot_instance"] = _chatbot_instance_local
                        _instance_info["created"] = True
                        _instance_info["type"] = "UnifiedResearchChatbot"
            # call upload_pdf if available
            inst = globals().get("_chatbot_instance")
            if hasattr(inst, "upload_pdf") and callable(getattr(inst, "upload_pdf")):
                ok = inst.upload_pdf(pdf_path)
                if ok:
                    return {"result": "uploaded", "pdf_path": pdf_path}
                else:
                    raise HTTPException(status_code=500, detail="upload_pdf failed (see server logs)")
            else:
                raise HTTPException(status_code=501, detail="Chatbot instance does not support upload_pdf")
        except HTTPException:
            raise
        except Exception as e:
            tb = traceback.format_exc()
            logger.exception("Error in /upload_pdf")
            raise HTTPException(status_code=500, detail={"error": str(e), "traceback": tb})
    else:
        raise HTTPException(status_code=501, detail="UnifiedResearchChatbot not available in bot module")

# ---------- fallback route note ----------
# If handler was not found at import time, the /query endpoint will still return a helpful
# fallback echo so the frontend can continue to operate while you wire the real handler.
