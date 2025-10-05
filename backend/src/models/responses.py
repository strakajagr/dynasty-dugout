"""
Dynasty Dugout - Response Models
Pydantic models for type-safe API responses with auto-documentation
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


# ============================================================================
# Base Response Models
# ============================================================================

class BaseResponse(BaseModel):
    """Standard response wrapper for all endpoints"""
    success: bool = Field(default=True, description="Whether the request succeeded")
    

class ErrorDetail(BaseModel):
    """Error information structure"""
    message: str = Field(..., description="Human-readable error message")
    type: str = Field(..., description="Error type/class name")
    details: Dict[str, Any] = Field(default_factory=dict, description="Additional error context")


class ErrorResponse(BaseResponse):
    """Standard error response"""
    success: bool = Field(default=False)
    error: ErrorDetail


class PaginationMetadata(BaseModel):
    """Pagination information"""
    page: int = Field(..., description="Current page number")
    per_page: int = Field(..., description="Items per page")
    total: int = Field(..., description="Total items available")
    total_pages: int = Field(..., description="Total number of pages")
    has_next: bool = Field(..., description="Whether there is a next page")
    has_prev: bool = Field(..., description="Whether there is a previous page")


# ============================================================================
# Player Models
# ============================================================================

class PlayerBasicInfo(BaseModel):
    """Basic player information"""
    player_id: int = Field(..., description="Primary player ID (MLB ID)")
    mlb_player_id: int = Field(..., description="MLB official player ID")
    first_name: str
    last_name: str
    full_name: Optional[str] = None
    position: str = Field(..., description="Primary position (e.g., 'OF', 'SP')")
    mlb_team: str = Field(..., description="Current MLB team abbreviation")
    mlb_team_full: Optional[str] = Field(None, description="Full MLB team name")


class PlayerStats(BaseModel):
    """Player statistics"""
    games: int = 0
    at_bats: Optional[int] = None
    runs: Optional[int] = None
    hits: Optional[int] = None
    doubles: Optional[int] = None
    triples: Optional[int] = None
    home_runs: Optional[int] = None
    rbi: Optional[int] = None
    stolen_bases: Optional[int] = None
    walks: Optional[int] = None
    strikeouts: Optional[int] = None
    batting_avg: Optional[float] = None
    on_base_pct: Optional[float] = None
    slugging_pct: Optional[float] = None
    ops: Optional[float] = None
    
    # Pitcher stats
    wins: Optional[int] = None
    losses: Optional[int] = None
    saves: Optional[int] = None
    innings_pitched: Optional[float] = None
    earned_runs: Optional[int] = None
    era: Optional[float] = None
    whip: Optional[float] = None
    strikeouts_pitcher: Optional[int] = None


class LeagueContext(BaseModel):
    """Player's status in a specific league"""
    league_id: int
    league_name: str
    status: str = Field(..., description="'owned', 'available', or 'other_team'")
    
    # Team assignment (if owned)
    team_id: Optional[int] = None
    team_name: Optional[str] = None
    owner_id: Optional[str] = None
    owner_name: Optional[str] = None
    is_user_team: bool = False
    
    # Roster details (if rostered)
    roster_status: Optional[str] = Field(None, description="'active', 'bench', 'DL', or 'minors'")
    roster_position: Optional[str] = None
    league_player_id: Optional[int] = None
    
    # Financial details
    contract_salary: Optional[float] = Field(None, description="Contract salary (if on a team)")
    contract_years: Optional[int] = None
    market_price: Optional[float] = Field(None, description="Open market value")
    salary_cap_hit: Optional[float] = None


class PlayerSearchResult(PlayerBasicInfo):
    """Player search result item"""
    pass


class PlayerSearchResponse(BaseResponse):
    """Response for player search endpoint"""
    players: List[PlayerSearchResult]
    count: int = Field(..., description="Number of results returned")
    query: Optional[str] = Field(None, description="Original search query")


class PlayerCompleteData(PlayerBasicInfo):
    """Complete player data with stats and league context"""
    season_stats: Optional[PlayerStats] = None
    rolling_14_day_stats: Optional[PlayerStats] = None
    career_stats: Optional[PlayerStats] = None
    
    # League context (if user is in a league)
    league_context: Optional[LeagueContext] = None
    
    # All leagues user is in (for multi-league view)
    league_contexts: Optional[List[LeagueContext]] = None


class PlayerCompleteResponse(BaseResponse):
    """Response for complete player data endpoint"""
    player: PlayerCompleteData
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)


# ============================================================================
# League Models
# ============================================================================

class LeagueBasicInfo(BaseModel):
    """Basic league information"""
    league_id: int
    name: str
    commissioner_id: str
    season: int
    status: str = Field(..., description="'active', 'draft', 'completed'")
    created_at: Optional[datetime] = None


class TeamBasicInfo(BaseModel):
    """Basic team information"""
    team_id: int
    team_name: str
    owner_id: str
    owner_name: str
    wins: int = 0
    losses: int = 0
    ties: int = 0


class LeagueDetailResponse(BaseResponse):
    """Response for league details"""
    league: LeagueBasicInfo
    teams: List[TeamBasicInfo]
    user_team: Optional[TeamBasicInfo] = None


class LeagueListResponse(BaseResponse):
    """Response for user's leagues list"""
    leagues: List[LeagueBasicInfo]
    count: int
    metadata: Optional[PaginationMetadata] = None


# ============================================================================
# Roster Models
# ============================================================================

class RosterPlayer(PlayerBasicInfo):
    """Player on a team roster"""
    league_player_id: int
    roster_status: str = Field(..., description="'active', 'bench', 'DL', 'minors'")
    roster_position: str
    contract_salary: float
    contract_years: int
    acquisition_date: Optional[datetime] = None
    
    # Stats
    season_stats: Optional[PlayerStats] = None
    rolling_stats: Optional[PlayerStats] = None


class RosterResponse(BaseResponse):
    """Response for team roster"""
    players: List[RosterPlayer]
    count: int
    total_salary: float
    salary_cap: float
    remaining_cap: float


class FreeAgentPlayer(PlayerBasicInfo):
    """Free agent player with pricing"""
    market_price: float
    season_stats: Optional[PlayerStats] = None
    rolling_stats: Optional[PlayerStats] = None


class FreeAgentsResponse(BaseResponse):
    """Response for free agents list"""
    players: List[FreeAgentPlayer]
    count: int
    metadata: Optional[PaginationMetadata] = None


# ============================================================================
# Transaction Models
# ============================================================================

class TransactionRequest(BaseModel):
    """Request to add a player"""
    league_player_id: int
    salary: float
    contract_years: int


class TransactionResponse(BaseResponse):
    """Response for add/drop transactions"""
    transaction_id: Optional[int] = None
    message: str
    player: Optional[PlayerBasicInfo] = None
    new_salary_cap: Optional[float] = None


# ============================================================================
# Health Check Models
# ============================================================================

class HealthCheckResponse(BaseModel):
    """Health check response"""
    status: str = Field(..., description="'healthy' or 'unhealthy'")
    service: str
    version: str
    timestamp: Optional[datetime] = None
    routers: Optional[Dict[str, str]] = None


# ============================================================================
# Multi-League Player Models (NEW - For Phase 2)
# ============================================================================

class PlayerMultiLeagueResponse(BaseResponse):
    """Response for player across all user's leagues"""
    player: PlayerBasicInfo
    mlb_data: Dict[str, Any] = Field(..., description="MLB statistics and info")
    league_contexts: List[LeagueContext]
    user_league_summary: Dict[str, Any] = Field(
        ...,
        description="Summary of player's status across leagues"
    )


class BulkPlayerStatusRequest(BaseModel):
    """Request for bulk player status check"""
    player_ids: List[int] = Field(..., description="List of player IDs to check")
    league_ids: Optional[List[int]] = Field(
        None, 
        description="Specific leagues to check (omit for all user's leagues)"
    )


class BulkPlayerStatusResponse(BaseResponse):
    """Response for bulk player status"""
    players: List[Dict[str, Any]] = Field(
        ...,
        description="List of players with their league contexts"
    )
    count: int
    leagues_checked: List[int]


# ============================================================================
# Helper Functions
# ============================================================================

def create_success_response(data: Any, **kwargs) -> Dict[str, Any]:
    """Helper to create a standard success response"""
    return {
        "success": True,
        "data": data,
        **kwargs
    }


def create_error_response(message: str, error_type: str = "Error", **details) -> Dict[str, Any]:
    """Helper to create a standard error response"""
    return {
        "success": False,
        "error": {
            "message": message,
            "type": error_type,
            "details": details
        }
    }
