"""
Redis cache utilities for performance optimization
"""
import redis.asyncio as redis
from typing import Optional, Any
import json
import hashlib
import logging

from app.config import settings

logger = logging.getLogger(__name__)

# Global Redis client
_redis_client: Optional[redis.Redis] = None


async def init_cache():
    """Initialize Redis connection"""
    global _redis_client
    
    try:
        _redis_client = redis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True
        )
        # Test connection
        await _redis_client.ping()
        logger.info("Redis cache connected")
    except Exception as e:
        logger.warning(f"Redis not available: {str(e)}")
        _redis_client = None


async def close_cache():
    """Close Redis connection"""
    global _redis_client
    
    if _redis_client:
        await _redis_client.close()
        logger.info("Redis cache closed")
        _redis_client = None


async def get_redis() -> Optional[redis.Redis]:
    """Get Redis client"""
    global _redis_client
    
    if not _redis_client:
        await init_cache()
    
    return _redis_client


async def check_cache_health() -> bool:
    """Check if Redis is accessible"""
    try:
        client = await get_redis()
        if client:
            await client.ping()
            return True
        return False
    except Exception as e:
        logger.error(f"Cache health check failed: {str(e)}")
        return False


# ============================================
# CACHE OPERATIONS
# ============================================

async def cache_get(key: str) -> Optional[Any]:
    """
    Get value from cache
    
    Args:
        key: Cache key
    
    Returns:
        Cached value or None
    """
    try:
        client = await get_redis()
        if not client:
            return None
        
        value = await client.get(key)
        if value:
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                return value
        return None
    except Exception as e:
        logger.warning(f"Cache get error: {str(e)}")
        return None


async def cache_set(key: str, value: Any, expire: int = None):
    """
    Set value in cache
    
    Args:
        key: Cache key
        value: Value to cache
        expire: Expiration time in seconds (optional)
    """
    try:
        client = await get_redis()
        if not client:
            return
        
        if not isinstance(value, str):
            value = json.dumps(value)
        
        if expire:
            await client.setex(key, expire, value)
        else:
            await client.set(key, value)
    except Exception as e:
        logger.warning(f"Cache set error: {str(e)}")


async def cache_delete(key: str):
    """Delete key from cache"""
    try:
        client = await get_redis()
        if not client:
            return
        
        await client.delete(key)
    except Exception as e:
        logger.warning(f"Cache delete error: {str(e)}")


async def cache_exists(key: str) -> bool:
    """Check if key exists in cache"""
    try:
        client = await get_redis()
        if not client:
            return False
        
        return await client.exists(key) > 0
    except Exception as e:
        logger.warning(f"Cache exists error: {str(e)}")
        return False


# ============================================
# Q&A CACHE HELPERS
# ============================================

def normalize_question(question: str) -> str:
    """
    Normalize question for caching
    - Convert to lowercase
    - Remove extra spaces
    - Remove punctuation
    """
    import re
    # Convert to lowercase
    question = question.lower()
    # Remove punctuation except alphanumeric and spaces
    question = re.sub(r'[^a-z0-9\s]', '', question)
    # Remove extra spaces
    question = ' '.join(question.split())
    return question


def hash_question(question: str, topic_id: str = None) -> str:
    """
    Create hash for question caching
    
    Args:
        question: Question text
        topic_id: Optional topic ID for context
    
    Returns:
        SHA256 hash
    """
    normalized = normalize_question(question)
    if topic_id:
        normalized = f"{topic_id}:{normalized}"
    
    return hashlib.sha256(normalized.encode()).hexdigest()


async def get_cached_answer(question: str, topic_id: str = None) -> Optional[dict]:
    """
    Get cached answer for a question
    
    Args:
        question: Question text
        topic_id: Optional topic ID for context
    
    Returns:
        Cached answer dict or None
    """
    question_hash = hash_question(question, topic_id)
    cache_key = f"qa:answer:{question_hash}"
    
    cached = await cache_get(cache_key)
    if cached:
        logger.info(f"Cache HIT for question hash: {question_hash[:8]}...")
        return cached
    
    logger.info(f"Cache MISS for question hash: {question_hash[:8]}...")
    return None


async def cache_answer(question: str, answer: str, topic_id: str = None):
    """
    Cache answer for a question
    
    Args:
        question: Question text
        answer: Answer text
        topic_id: Optional topic ID for context
    """
    question_hash = hash_question(question, topic_id)
    cache_key = f"qa:answer:{question_hash}"
    
    answer_data = {
        "question": question,
        "answer": answer,
        "topic_id": topic_id,
        "hash": question_hash
    }
    
    await cache_set(cache_key, answer_data, expire=settings.QA_CACHE_TIMEOUT)
    logger.info(f"Cached answer for hash: {question_hash[:8]}...")


# ============================================
# VIDEO ANALYTICS BUFFER
# ============================================

async def buffer_video_event(session_id: str, event_data: dict):
    """
    Buffer video engagement events before bulk insert
    
    Args:
        session_id: Video watch session ID
        event_data: Event details
    """
    buffer_key = f"video:events:{session_id}"
    
    try:
        client = await get_redis()
        if not client:
            return
        
        # Add event to list
        await client.rpush(buffer_key, json.dumps(event_data))
        
        # Set expiry (1 hour)
        await client.expire(buffer_key, 3600)
    except Exception as e:
        logger.warning(f"Error buffering video event: {str(e)}")


async def get_buffered_events(session_id: str) -> list:
    """
    Get all buffered events for a session
    
    Args:
        session_id: Video watch session ID
    
    Returns:
        List of event dictionaries
    """
    buffer_key = f"video:events:{session_id}"
    
    try:
        client = await get_redis()
        if not client:
            return []
        
        # Get all events
        events = await client.lrange(buffer_key, 0, -1)
        
        # Parse JSON
        return [json.loads(event) for event in events]
    except Exception as e:
        logger.warning(f"Error getting buffered events: {str(e)}")
        return []


async def clear_buffered_events(session_id: str):
    """Clear buffered events after processing"""
    buffer_key = f"video:events:{session_id}"
    await cache_delete(buffer_key)


# ============================================
# SESSION MANAGEMENT
# ============================================

async def set_user_session(user_id: str, session_data: dict, expire: int = 3600):
    """
    Store user session data
    
    Args:
        user_id: User ID
        session_data: Session information
        expire: Expiration in seconds (default 1 hour)
    """
    session_key = f"session:{user_id}"
    await cache_set(session_key, session_data, expire=expire)


async def get_user_session(user_id: str) -> Optional[dict]:
    """Get user session data"""
    session_key = f"session:{user_id}"
    return await cache_get(session_key)


async def delete_user_session(user_id: str):
    """Delete user session"""
    session_key = f"session:{user_id}"
    await cache_delete(session_key)


# ============================================
# ANALYTICS CACHE HELPERS
# Cache strategy:
#   live metrics    → 1 hour  (3600s)
#   daily scores    → 24 hrs  (86400s)
#   weekly reports  → 7 days  (604800s)
#   ai insights     → 30 days (2592000s)
# ============================================

_TTL_LIVE = 3600
_TTL_DAILY = 86400
_TTL_WEEKLY = 604800
_TTL_AI = 2592000


async def cache_analytics(key_parts: list, data: Any, ttl: int = _TTL_DAILY):
    """Cache an analytics result under a namespaced key."""
    key = "analytics:" + ":".join(str(p) for p in key_parts)
    await cache_set(key, data, expire=ttl)


async def get_cached_analytics(key_parts: list) -> Optional[Any]:
    """Retrieve a cached analytics result."""
    key = "analytics:" + ":".join(str(p) for p in key_parts)
    return await cache_get(key)


async def invalidate_analytics(key_parts: list):
    """Delete a cached analytics result (e.g. after recalculation)."""
    key = "analytics:" + ":".join(str(p) for p in key_parts)
    await cache_delete(key)


async def cache_student_shs(student_id: str, class_id: str, data: Any):
    """Cache student SHS data for 24 hours."""
    await cache_analytics(["shs", student_id, class_id], data, ttl=_TTL_DAILY)


async def get_cached_student_shs(student_id: str, class_id: str) -> Optional[Any]:
    return await get_cached_analytics(["shs", student_id, class_id])


async def cache_class_cvi(class_id: str, period: str, data: Any):
    """Cache class CVI analytics for 24 hours."""
    await cache_analytics(["cvi", class_id, period], data, ttl=_TTL_DAILY)


async def get_cached_class_cvi(class_id: str, period: str) -> Optional[Any]:
    return await get_cached_analytics(["cvi", class_id, period])


async def cache_teacher_overview(teacher_id: str, period: str, data: Any):
    """Cache teacher analytics overview for 1 hour (frequently viewed)."""
    await cache_analytics(["teacher_overview", teacher_id, period], data, ttl=_TTL_LIVE)


async def get_cached_teacher_overview(teacher_id: str, period: str) -> Optional[Any]:
    return await get_cached_analytics(["teacher_overview", teacher_id, period])


async def cache_manager_overview(school_id: str, period: str, data: Any):
    """Cache manager analytics overview for 1 hour."""
    await cache_analytics(["manager_overview", school_id, period], data, ttl=_TTL_LIVE)


async def get_cached_manager_overview(school_id: str, period: str) -> Optional[Any]:
    return await get_cached_analytics(["manager_overview", school_id, period])


async def cache_school_spi(school_id: str, period: str, data: Any):
    """Cache school SPI data for 7 days (recalculated weekly)."""
    await cache_analytics(["spi", school_id, period], data, ttl=_TTL_WEEKLY)


async def get_cached_school_spi(school_id: str, period: str) -> Optional[Any]:
    return await get_cached_analytics(["spi", school_id, period])


async def cache_ai_insights(entity_type: str, entity_id: str, data: Any):
    """Cache AI insights for 30 days (expensive to regenerate)."""
    await cache_analytics(["ai", entity_type, entity_id], data, ttl=_TTL_AI)


async def get_cached_ai_insights(entity_type: str, entity_id: str) -> Optional[Any]:
    return await get_cached_analytics(["ai", entity_type, entity_id])
