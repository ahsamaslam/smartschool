"""
General-purpose helper utilities shared across the application.
"""
import uuid
import math
from datetime import datetime
from typing import Any


def generate_uuid() -> str:
    """Return a new UUID4 string."""
    return str(uuid.uuid4())


def paginate(items: list, page: int, page_size: int) -> dict:
    """
    Slice *items* and return pagination metadata.

    Args:
        items:      Full list to paginate.
        page:       1-based page number.
        page_size:  Number of items per page.

    Returns:
        dict with keys: items, page, page_size, total, total_pages.
    """
    page = max(1, page)
    page_size = max(1, min(page_size, 100))  # cap at 100
    total = len(items)
    total_pages = math.ceil(total / page_size) if total else 1
    start = (page - 1) * page_size
    end = start + page_size

    return {
        "items": items[start:end],
        "page": page,
        "page_size": page_size,
        "total": total,
        "total_pages": total_pages,
    }


def format_date(dt: datetime, fmt: str = "%Y-%m-%d") -> str:
    """Format a datetime object to a string. Returns '' for None."""
    if dt is None:
        return ""
    return dt.strftime(fmt)


def format_datetime(dt: datetime) -> str:
    """Return ISO-8601 datetime string. Returns '' for None."""
    if dt is None:
        return ""
    return dt.isoformat()


def safe_dict(record: Any) -> dict:
    """
    Convert an asyncpg Record (or any mapping) to a plain dict.
    Returns {} for None.
    """
    if record is None:
        return {}
    return dict(record)


def safe_list(records: Any) -> list:
    """
    Convert a list of asyncpg Records to a list of plain dicts.
    Returns [] for None.
    """
    if records is None:
        return []
    return [dict(r) for r in records]
