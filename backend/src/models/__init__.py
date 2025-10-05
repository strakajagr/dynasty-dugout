"""
Dynasty Dugout Response Models Package
Import commonly used models here for convenience
"""

from .responses import (
    # Base models
    BaseResponse,
    ErrorResponse,
    PaginationMetadata,
    
    # Player models
    PlayerBasicInfo,
    PlayerStats,
    LeagueContext,
    PlayerSearchResponse,
    PlayerCompleteResponse,
    
    # League models
    LeagueBasicInfo,
    LeagueDetailResponse,
    LeagueListResponse,
    
    # Roster models
    RosterResponse,
    FreeAgentsResponse,
    
    # Transaction models
    TransactionRequest,
    TransactionResponse,
    
    # Health
    HealthCheckResponse,
    
    # Multi-league (Phase 2)
    PlayerMultiLeagueResponse,
    BulkPlayerStatusRequest,
    BulkPlayerStatusResponse,
    
    # Helpers
    create_success_response,
    create_error_response,
)

__all__ = [
    "BaseResponse",
    "ErrorResponse",
    "PaginationMetadata",
    "PlayerBasicInfo",
    "PlayerStats",
    "LeagueContext",
    "PlayerSearchResponse",
    "PlayerCompleteResponse",
    "LeagueBasicInfo",
    "LeagueDetailResponse",
    "LeagueListResponse",
    "RosterResponse",
    "FreeAgentsResponse",
    "TransactionRequest",
    "TransactionResponse",
    "HealthCheckResponse",
    "PlayerMultiLeagueResponse",
    "BulkPlayerStatusRequest",
    "BulkPlayerStatusResponse",
    "create_success_response",
    "create_error_response",
]
