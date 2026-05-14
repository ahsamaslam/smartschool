"""
Socket.IO server instance and per-connection user registry.

Defined here (not in main.py) to break the potential circular import:
  main.py  ←imports─  chat.py  ←imports─  socket_manager.py
                                                ↑
                                        sio is created here
"""
import asyncio
import socketio
from typing import Dict, Any, Optional

# ---------------------------------------------------------------------------
# Global Socket.IO async server
# ---------------------------------------------------------------------------
sio: socketio.AsyncServer = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",  # tighten in production
    logger=False,
    engineio_logger=False,
)

# ---------------------------------------------------------------------------
# Connection registry
# sid → { user_id, role, school_id }
# ---------------------------------------------------------------------------
_sid_users: Dict[str, Dict[str, Any]] = {}

# user_id → pending asyncio.Task for delayed offline update
_offline_tasks: Dict[str, asyncio.Task] = {}


def get_user_for_sid(sid: str) -> Optional[Dict[str, Any]]:
    return _sid_users.get(sid)


def register_sid(sid: str, user_info: Dict[str, Any]) -> None:
    _sid_users[sid] = user_info


def unregister_sid(sid: str) -> Optional[Dict[str, Any]]:
    return _sid_users.pop(sid, None)


def sids_for_user(user_id: str) -> list:
    return [s for s, u in _sid_users.items() if u.get("user_id") == user_id]


def cancel_offline_task(user_id: str) -> None:
    task = _offline_tasks.pop(user_id, None)
    if task and not task.done():
        task.cancel()


def set_offline_task(user_id: str, task: asyncio.Task) -> None:
    _offline_tasks[user_id] = task
