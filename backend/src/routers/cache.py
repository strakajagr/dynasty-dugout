"""
Dynasty Dugout - Cache Management Router
Provides endpoints to monitor, manage, and optimize the caching system.
"""
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Dict, Any
import logging

from core.cache import (
    cache,
    get_cache_info,
    invalidate_cache_pattern,
    warm_common_data,
    _lambda_cache,
    _dynamodb_cache
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/cache",
    tags=["Cache Management"]
)

# =============================================================================
# RESPONSE MODELS
# =============================================================================

class CacheStats(BaseModel):
    """Cache statistics response"""
    memory_cache: Dict[str, Any]
    dynamodb_cache: Dict[str, Any]

class CacheHealth(BaseModel):
    """Cache health check response"""
    status: str
    memory_cache_operational: bool
    dynamodb_cache_operational: bool
    details: Dict[str, Any]

class InvalidateRequest(BaseModel):
    """Request to invalidate cache keys"""
    pattern: str

# =============================================================================
# CACHE MONITORING ENDPOINTS
# =============================================================================

@router.get("/stats", response_model=CacheStats)
async def get_cache_stats():
    """
    Get comprehensive cache statistics from both tiers.
    
    Returns:
    - Hit/miss counts
    - Hit rates (%)
    - Cache sizes
    - Error counts
    
    Use this to monitor cache performance and identify optimization opportunities.
    """
    try:
        stats = cache.get_stats()
        return stats
    except Exception as e:
        logger.error(f"Failed to get cache stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve cache statistics: {str(e)}"
        )


@router.get("/info")
async def get_cache_information():
    """
    Get detailed cache configuration and information.
    
    Returns:
    - Cache tiers and their characteristics
    - Current statistics
    - Memory cache size
    - Uptime information
    """
    try:
        info = get_cache_info()
        return info
    except Exception as e:
        logger.error(f"Failed to get cache info: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve cache information: {str(e)}"
        )


@router.get("/health", response_model=CacheHealth)
async def check_cache_health():
    """
    Health check endpoint for the caching system.
    
    Tests both cache tiers to ensure they're operational.
    Returns detailed status for monitoring/alerting.
    """
    try:
        # Test memory cache
        test_key = "health_check_test"
        test_value = {"test": "data", "timestamp": "test"}
        
        _lambda_cache.set(test_key, test_value, ttl_seconds=10)
        memory_result = _lambda_cache.get(test_key)
        memory_operational = memory_result == test_value
        _lambda_cache.delete(test_key)
        
        # Test DynamoDB cache
        try:
            _dynamodb_cache.set(test_key, test_value, ttl_seconds=10)
            dynamo_result = _dynamodb_cache.get(test_key)
            dynamo_operational = dynamo_result == test_value
            _dynamodb_cache.delete(test_key)
        except Exception as e:
            logger.warning(f"DynamoDB cache health check failed: {e}")
            dynamo_operational = False
        
        overall_status = "healthy" if (memory_operational and dynamo_operational) else "degraded"
        
        return {
            "status": overall_status,
            "memory_cache_operational": memory_operational,
            "dynamodb_cache_operational": dynamo_operational,
            "details": {
                "memory_cache": "operational" if memory_operational else "failed",
                "dynamodb_cache": "operational" if dynamo_operational else "failed",
                "note": "Service is degraded if DynamoDB cache is down" if not dynamo_operational else None
            }
        }
        
    except Exception as e:
        logger.error(f"Cache health check failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Cache health check failed: {str(e)}"
        )

# =============================================================================
# CACHE MANAGEMENT ENDPOINTS
# =============================================================================

@router.post("/warm")
async def warm_cache():
    """
    Manually trigger cache warming.
    
    Pre-loads commonly accessed data into the cache to improve
    response times for subsequent requests.
    
    Useful to call:
    - After deployments
    - During low-traffic periods
    - Before expected traffic spikes
    """
    try:
        warm_common_data()
        
        return {
            "status": "success",
            "message": "Cache warming completed",
            "cache_stats": cache.get_stats()
        }
    except Exception as e:
        logger.error(f"Cache warming failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Cache warming failed: {str(e)}"
        )


@router.post("/invalidate/{pattern}")
async def invalidate_cache(pattern: str):
    """
    Invalidate cache entries matching a pattern.
    
    Use this to clear specific cache entries after data updates.
    
    Examples:
    - /api/cache/invalidate/player:12345 - Clear specific player
    - /api/cache/invalidate/league:67 - Clear specific league
    - /api/cache/invalidate/pricing - Clear all pricing data
    
    Args:
        pattern: String pattern to match cache keys against
    """
    try:
        invalidate_cache_pattern(pattern)
        
        return {
            "status": "success",
            "message": f"Invalidated cache entries matching pattern: {pattern}",
            "pattern": pattern
        }
    except Exception as e:
        logger.error(f"Cache invalidation failed for pattern {pattern}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Cache invalidation failed: {str(e)}"
        )


@router.post("/clear")
async def clear_cache():
    """
    Clear ALL cache entries from memory cache.
    
    ⚠️ WARNING: This clears the entire Lambda memory cache.
    Use with caution as it will cause temporary performance degradation.
    
    Note: This only clears the Lambda memory cache. DynamoDB cache
    entries will expire based on their TTL.
    """
    try:
        _lambda_cache.clear()
        
        return {
            "status": "success",
            "message": "Memory cache cleared successfully",
            "note": "DynamoDB cache entries will expire based on TTL"
        }
    except Exception as e:
        logger.error(f"Cache clear failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to clear cache: {str(e)}"
        )


# =============================================================================
# CACHE ANALYSIS ENDPOINTS
# =============================================================================

@router.get("/performance")
async def get_cache_performance():
    """
    Get detailed cache performance metrics.
    
    Returns:
    - Hit rates for both tiers
    - Performance comparison
    - Recommendations for optimization
    """
    try:
        stats = cache.get_stats()
        memory_stats = stats['memory_cache']
        dynamo_stats = stats['dynamodb_cache']
        
        # Calculate performance metrics
        total_requests = memory_stats['hits'] + memory_stats['misses']
        memory_hit_rate = memory_stats['hit_rate']
        dynamo_hit_rate = dynamo_stats['hit_rate']
        
        # Performance assessment
        performance_status = "excellent" if memory_hit_rate > 80 else \
                           "good" if memory_hit_rate > 60 else \
                           "needs_optimization"
        
        # Generate recommendations
        recommendations = []
        if memory_hit_rate < 60:
            recommendations.append("Consider increasing cache TTL for frequently accessed data")
        if dynamo_stats['errors'] > 0:
            recommendations.append("DynamoDB cache has errors - check CloudWatch logs")
        if memory_stats['size'] > 10000:
            recommendations.append("Memory cache is large - consider implementing cache size limits")
        
        return {
            "status": performance_status,
            "metrics": {
                "total_requests": total_requests,
                "memory_hit_rate": memory_hit_rate,
                "dynamodb_hit_rate": dynamo_hit_rate,
                "memory_cache_size": memory_stats['size'],
                "cache_efficiency": f"{memory_hit_rate}% of requests served from ultra-fast memory cache"
            },
            "recommendations": recommendations if recommendations else ["Cache is performing well"]
        }
        
    except Exception as e:
        logger.error(f"Failed to get cache performance: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve cache performance: {str(e)}"
        )


@router.get("/test")
async def test_cache():
    """
    Simple endpoint to test cache functionality end-to-end.
    
    Makes 3 requests:
    1. First request (cache miss - slow)
    2. Second request (cache hit - fast)
    3. Third request (cache hit - fast)
    
    Returns timing information to verify caching is working.
    """
    import time
    
    try:
        test_key = "cache_test_endpoint"
        
        # First request - should be a miss
        start = time.time()
        value1 = cache.get(test_key)
        time1 = (time.time() - start) * 1000
        
        if value1 is None:
            # Set a test value
            test_data = {"message": "Cache test", "timestamp": time.time()}
            cache.set(test_key, test_data, ttl_seconds=60)
            
            # Second request - should be a hit
            start = time.time()
            value2 = cache.get(test_key)
            time2 = (time.time() - start) * 1000
            
            # Third request - should be a hit
            start = time.time()
            value3 = cache.get(test_key)
            time3 = (time.time() - start) * 1000
            
            return {
                "status": "success",
                "test_results": {
                    "first_request": {"result": "miss", "time_ms": round(time1, 2)},
                    "second_request": {"result": "hit", "time_ms": round(time2, 2), "speedup": f"{round(time1/time2, 1)}x faster"},
                    "third_request": {"result": "hit", "time_ms": round(time3, 2), "speedup": f"{round(time1/time3, 1)}x faster"}
                },
                "conclusion": "✅ Caching is working!" if time2 < time1 else "⚠️ Cache may not be working optimally"
            }
        else:
            return {
                "status": "cached",
                "message": "Test key already in cache",
                "note": "Call /api/cache/clear first to run a fresh test"
            }
            
    except Exception as e:
        logger.error(f"Cache test failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Cache test failed: {str(e)}"
        )
