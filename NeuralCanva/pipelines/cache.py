import hashlib
import json
from django.core.cache import cache
from django.conf import settings


def make_graph_cache_key(user_id: int, nodes: list, edges: list) -> str:
    """Generate a unique cache key based on user + graph structure."""
    graph_str = json.dumps({"nodes": nodes, "edges": edges}, sort_keys=True)
    graph_hash = hashlib.md5(graph_str.encode()).hexdigest()
    return f"graph:{user_id}:{graph_hash}"


def get_cached_result(user_id: int, nodes: list, edges: list):
    """Returns cached result or None."""
    key = make_graph_cache_key(user_id, nodes, edges)
    return cache.get(key)


def set_cached_result(user_id: int, nodes: list, edges: list, result: dict):
    """Store result in cache with TTL."""
    key = make_graph_cache_key(user_id, nodes, edges)
    ttl = getattr(settings, 'GRAPH_CACHE_TTL', 86400)
    cache.set(key, result, timeout=ttl)


def invalidate_graph_cache(user_id: int, nodes: list, edges: list):
    """Delete cache entry when graph is updated."""
    key = make_graph_cache_key(user_id, nodes, edges)
    cache.delete(key)