"""
Dynasty Dugout - Comprehensive 2-Tier Caching System
Tier 1: Lambda Memory (in-process, ultra-fast)
Tier 2: DynamoDB (persistent, shared across Lambdas)

This dramatically reduces cold starts and database load.
"""
import json
import time
import logging
import hashlib
from typing import Any, Optional, Dict, Callable
from datetime import datetime, timedelta
import boto3
from functools import wraps

logger = logging.getLogger(__name__)

# =============================================================================
# TIER 1: LAMBDA MEMORY CACHE (In-Process, Ultra-Fast)
# =============================================================================

class LambdaMemoryCache:
    """
    In-memory cache that persists between Lambda invocations.
    This is EXTREMELY fast (microseconds) but only lasts for the lifetime 
    of the Lambda container (~15-30 minutes typically).
    """
    
    def __init__(self):
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._stats = {
            'hits': 0,
            'misses': 0,
            'sets': 0,
            'evictions': 0
        }
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache if not expired"""
        if key not in self._cache:
            self._stats['misses'] += 1
            return None
        
        entry = self._cache[key]
        
        # Check if expired
        if entry['expires_at'] < time.time():
            del self._cache[key]
            self._stats['evictions'] += 1
            self._stats['misses'] += 1
            return None
        
        self._stats['hits'] += 1
        return entry['value']
    
    def set(self, key: str, value: Any, ttl_seconds: int = 300):
        """Set value in cache with TTL"""
        self._cache[key] = {
            'value': value,
            'expires_at': time.time() + ttl_seconds,
            'created_at': time.time()
        }
        self._stats['sets'] += 1
    
    def delete(self, key: str):
        """Delete key from cache"""
        if key in self._cache:
            del self._cache[key]
    
    def clear(self):
        """Clear entire cache"""
        count = len(self._cache)
        self._cache.clear()
        self._stats['evictions'] += count
    
    def get_stats(self) -> Dict[str, int]:
        """Get cache statistics"""
        total_requests = self._stats['hits'] + self._stats['misses']
        hit_rate = (self._stats['hits'] / total_requests * 100) if total_requests > 0 else 0
        
        return {
            **self._stats,
            'size': len(self._cache),
            'hit_rate': round(hit_rate, 2)
        }
    
    def warm_cache(self, data_loaders: Dict[str, Callable]):
        """
        Pre-populate cache with commonly needed data.
        Called during Lambda init to reduce first-request latency.
        """
        logger.info("🔥 Warming Lambda memory cache...")
        warmed = 0
        
        for key, loader_func in data_loaders.items():
            try:
                data = loader_func()
                if data:
                    self.set(key, data, ttl_seconds=600)  # 10 minute TTL for warmed data
                    warmed += 1
            except Exception as e:
                logger.warning(f"Failed to warm cache for {key}: {e}")
        
        logger.info(f"✅ Warmed {warmed} cache entries")


# Global instance - persists between Lambda invocations
_lambda_cache = LambdaMemoryCache()

# =============================================================================
# TIER 2: DYNAMODB CACHE (Persistent, Shared Across Lambdas)
# =============================================================================

class DynamoDBCache:
    """
    Persistent cache layer using DynamoDB.
    Slower than memory cache (~10-50ms) but shared across all Lambda instances
    and persists indefinitely until TTL expires.
    """
    
    def __init__(self, table_name: str = 'dynasty-dugout-cache'):
        self.table_name = table_name
        self.dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
        self._table = None
        self._stats = {
            'hits': 0,
            'misses': 0,
            'sets': 0,
            'errors': 0
        }
    
    @property
    def table(self):
        """Lazy load DynamoDB table"""
        if self._table is None:
            try:
                self._table = self.dynamodb.Table(self.table_name)
            except Exception as e:
                logger.error(f"Failed to connect to DynamoDB table {self.table_name}: {e}")
                raise
        return self._table
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from DynamoDB cache"""
        try:
            response = self.table.get_item(Key={'cache_key': key})
            
            if 'Item' not in response:
                self._stats['misses'] += 1
                return None
            
            item = response['Item']
            
            # DynamoDB TTL might not have cleaned up yet
            if item.get('ttl', 0) < int(time.time()):
                self._stats['misses'] += 1
                return None
            
            self._stats['hits'] += 1
            
            # Deserialize the cached value
            return json.loads(item['value'])
            
        except Exception as e:
            logger.error(f"DynamoDB cache get error for key {key}: {e}")
            self._stats['errors'] += 1
            return None
    
    def set(self, key: str, value: Any, ttl_seconds: int = 3600):
        """Set value in DynamoDB cache with TTL"""
        try:
            ttl = int(time.time()) + ttl_seconds
            
            self.table.put_item(
                Item={
                    'cache_key': key,
                    'value': json.dumps(value, default=str),  # Serialize to JSON
                    'ttl': ttl,
                    'created_at': int(time.time())
                }
            )
            
            self._stats['sets'] += 1
            return True
            
        except Exception as e:
            logger.error(f"DynamoDB cache set error for key {key}: {e}")
            self._stats['errors'] += 1
            return False
    
    def delete(self, key: str):
        """Delete key from DynamoDB cache"""
        try:
            self.table.delete_item(Key={'cache_key': key})
        except Exception as e:
            logger.error(f"DynamoDB cache delete error for key {key}: {e}")
    
    def get_stats(self) -> Dict[str, int]:
        """Get cache statistics"""
        total_requests = self._stats['hits'] + self._stats['misses']
        hit_rate = (self._stats['hits'] / total_requests * 100) if total_requests > 0 else 0
        
        return {
            **self._stats,
            'hit_rate': round(hit_rate, 2)
        }


# Global DynamoDB cache instance
_dynamodb_cache = DynamoDBCache()

# =============================================================================
# UNIFIED CACHE INTERFACE (Uses Both Tiers Automatically)
# =============================================================================

class UnifiedCache:
    """
    Intelligent 2-tier caching system that automatically:
    1. Checks Lambda memory first (fastest)
    2. Falls back to DynamoDB (persistent)
    3. Populates both caches on miss
    """
    
    def __init__(self):
        self.memory_cache = _lambda_cache
        self.dynamo_cache = _dynamodb_cache
    
    def get(self, key: str, default: Any = None) -> Any:
        """
        Get value from cache using 2-tier strategy:
        1. Check Lambda memory (microseconds)
        2. Check DynamoDB (milliseconds)
        3. Return default if not found
        """
        # Tier 1: Lambda memory
        value = self.memory_cache.get(key)
        if value is not None:
            logger.debug(f"Cache HIT (memory): {key}")
            return value
        
        # Tier 2: DynamoDB
        value = self.dynamo_cache.get(key)
        if value is not None:
            logger.debug(f"Cache HIT (DynamoDB): {key}")
            # Populate memory cache for next time
            self.memory_cache.set(key, value, ttl_seconds=300)
            return value
        
        logger.debug(f"Cache MISS: {key}")
        return default
    
    def set(self, key: str, value: Any, ttl_seconds: int = 3600):
        """
        Set value in both cache tiers.
        Memory cache gets shorter TTL since it's temporary.
        """
        # Set in memory with 5 min TTL (or less if specified)
        memory_ttl = min(ttl_seconds, 300)
        self.memory_cache.set(key, value, ttl_seconds=memory_ttl)
        
        # Set in DynamoDB with full TTL
        self.dynamo_cache.set(key, value, ttl_seconds=ttl_seconds)
    
    def delete(self, key: str):
        """Delete from both cache tiers"""
        self.memory_cache.delete(key)
        self.dynamo_cache.delete(key)
    
    def get_stats(self) -> Dict[str, Any]:
        """Get statistics from both cache tiers"""
        return {
            'memory_cache': self.memory_cache.get_stats(),
            'dynamodb_cache': self.dynamo_cache.get_stats()
        }


# Global unified cache instance
cache = UnifiedCache()

# =============================================================================
# CACHE DECORATORS FOR EASY USE
# =============================================================================

def cached(
    ttl_seconds: int = 3600,
    key_prefix: str = '',
    key_params: list = None
):
    """
    Decorator to automatically cache function results.
    
    Usage:
        @cached(ttl_seconds=600, key_prefix='player', key_params=['player_id'])
        def get_player_data(player_id: int):
            # Expensive database query
            return query_player(player_id)
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Build cache key from function name and parameters
            if key_params:
                # Use specific parameters for the key
                key_parts = [key_prefix or func.__name__]
                for param in key_params:
                    if param in kwargs:
                        key_parts.append(str(kwargs[param]))
                cache_key = ':'.join(key_parts)
            else:
                # Use all args/kwargs for the key
                cache_key = f"{key_prefix or func.__name__}:{_hash_args(args, kwargs)}"
            
            # Try to get from cache
            cached_value = cache.get(cache_key)
            if cached_value is not None:
                return cached_value
            
            # Cache miss - execute function
            result = await func(*args, **kwargs)  # AWAIT the async function!
            
            # Store in cache
            if result is not None:
                cache.set(cache_key, result, ttl_seconds=ttl_seconds)
            
            return result
        
        return wrapper
    return decorator


def _hash_args(args: tuple, kwargs: dict) -> str:
    """Create a hash of function arguments for cache key"""
    key_data = f"{args}:{sorted(kwargs.items())}"
    return hashlib.md5(key_data.encode()).hexdigest()[:16]


# =============================================================================
# CACHE WARMING HELPERS
# =============================================================================

def warm_common_data():
    """
    Pre-load commonly accessed data into cache during Lambda init.
    This reduces latency on first requests.
    """
    from core.database import execute_sql
    
    def load_active_players():
        """Load list of active player IDs"""
        try:
            result = execute_sql(
                "SELECT player_id, first_name, last_name FROM mlb_players WHERE is_active = true LIMIT 1000",
                database_name='postgres'
            )
            if result and result.get('records'):
                return [{'player_id': r[0].get('longValue'), 
                        'name': f"{r[1].get('stringValue')} {r[2].get('stringValue')}"} 
                       for r in result['records']]
        except Exception as e:
            logger.warning(f"Failed to warm active players cache: {e}")
        return None
    
    # Add more data loaders here as needed
    data_loaders = {
        'active_players': load_active_players,
        # Add more: 'league_settings', 'scoring_categories', etc.
    }
    
    _lambda_cache.warm_cache(data_loaders)


# =============================================================================
# CACHE MANAGEMENT ENDPOINTS
# =============================================================================

def get_cache_info() -> Dict[str, Any]:
    """Get comprehensive cache information and statistics"""
    return {
        'cache_enabled': True,
        'tiers': {
            'tier1': 'Lambda Memory (in-process)',
            'tier2': 'DynamoDB (persistent)'
        },
        'statistics': cache.get_stats(),
        'memory_cache_size': _lambda_cache.get_stats().get('size', 0),
        'uptime': time.time()  # Lambda container uptime approximation
    }


def invalidate_cache_pattern(pattern: str):
    """
    Invalidate all cache keys matching a pattern.
    Useful for cache busting after data updates.
    
    Example: invalidate_cache_pattern('player:12345')
    """
    # For Lambda memory cache
    keys_to_delete = [k for k in _lambda_cache._cache.keys() if pattern in k]
    for key in keys_to_delete:
        _lambda_cache.delete(key)
    
    logger.info(f"Invalidated {len(keys_to_delete)} cache entries matching pattern: {pattern}")
    
    # Note: DynamoDB doesn't support pattern matching efficiently,
    # so we rely on TTL expiration there


# =============================================================================
# EXPORT PUBLIC API
# =============================================================================

__all__ = [
    'cache',
    'cached',
    'warm_common_data',
    'get_cache_info',
    'invalidate_cache_pattern',
    'LambdaMemoryCache',
    'DynamoDBCache',
    'UnifiedCache'
]
