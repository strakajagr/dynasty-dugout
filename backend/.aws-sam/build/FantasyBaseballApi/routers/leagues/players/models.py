"""
Dynasty Dugout - Player Data Models
PURPOSE: Pydantic models for all player statistics and data structures
"""

from pydantic import BaseModel
from typing import Optional

# =============================================================================
# STATS MODELS
# =============================================================================

class SeasonStats(BaseModel):
    """Full season statistics"""
    games_played: int = 0
    at_bats: int = 0
    hits: int = 0
    doubles: int = 0
    triples: int = 0
    home_runs: int = 0
    rbi: int = 0
    runs: int = 0
    walks: int = 0
    strikeouts: int = 0
    stolen_bases: int = 0
    caught_stealing: int = 0
    batting_avg: float = 0.000
    obp: float = 0.000
    slg: float = 0.000
    ops: float = 0.000
    # Pitching
    innings_pitched: float = 0.0
    wins: int = 0
    losses: int = 0
    saves: int = 0
    blown_saves: int = 0
    holds: int = 0
    quality_starts: int = 0
    earned_runs: int = 0
    hits_allowed: int = 0
    walks_allowed: int = 0
    strikeouts_pitched: int = 0
    era: float = 0.00
    whip: float = 0.000
    games_started: int = 0
    hit_by_pitch: int = 0
    home_runs_allowed: int = 0

class AccruedStats(BaseModel):
    """Stats accumulated while in active lineup only"""
    first_active_date: Optional[str] = None
    last_active_date: Optional[str] = None
    total_active_days: int = 0
    active_games_played: int = 0
    active_at_bats: int = 0
    active_hits: int = 0
    active_home_runs: int = 0
    active_rbi: int = 0
    active_runs: int = 0
    active_stolen_bases: int = 0
    active_walks: int = 0
    active_strikeouts: int = 0
    active_batting_avg: float = 0.000
    # Pitching
    active_innings_pitched: float = 0.0
    active_wins: int = 0
    active_losses: int = 0
    active_saves: int = 0
    active_earned_runs: int = 0
    active_quality_starts: int = 0
    active_era: float = 0.00
    active_whip: float = 0.000

class RollingStats(BaseModel):
    """14-day rolling statistics for trend analysis"""
    games_played: int = 0
    at_bats: int = 0
    hits: int = 0
    home_runs: int = 0
    rbi: int = 0
    runs: int = 0
    stolen_bases: int = 0
    batting_avg: float = 0.000
    obp: float = 0.000
    slg: float = 0.000
    ops: float = 0.000
    # Pitching
    innings_pitched: float = 0.0
    wins: int = 0
    losses: int = 0
    saves: int = 0
    quality_starts: int = 0
    era: float = 0.00
    whip: float = 0.000
    trend: Optional[str] = None  # "hot", "cold", "steady"
    # Additional fields for complete data
    walks: int = 0
    strikeouts: int = 0
    games_started: int = 0
    earned_runs: int = 0
    strikeouts_pitched: int = 0
    caught_stealing: int = 0
    blown_saves: int = 0
    hits_allowed: int = 0
    walks_allowed: int = 0

# =============================================================================
# DISPLAY MODELS
# =============================================================================

class ThreeLinePlayerStats(BaseModel):
    """Complete player stats for team display (3 lines)"""
    league_player_id: str
    mlb_player_id: int
    player_name: str
    position: str
    mlb_team: str
    roster_status: str
    salary: float
    contract_years: int
    # Three lines of stats
    season_stats: SeasonStats
    accrued_stats: AccruedStats  # Only while active
    rolling_14_day: RollingStats
    # Meta
    acquisition_date: str
    acquisition_method: str

class TwoLinePlayerStats(BaseModel):
    """Player stats for free agent display (2 lines)"""
    league_player_id: str
    mlb_player_id: int
    player_name: str
    position: str
    mlb_team: str
    availability_status: str
    salary: float
    contract_years: Optional[int] = None  # For owned players
    # Two lines of stats
    season_stats: SeasonStats
    rolling_14_day: RollingStats
    # Ownership
    owned_by_team_id: Optional[str] = None
    owned_by_team_name: Optional[str] = None

# =============================================================================
# ANALYTICS MODELS
# =============================================================================

class HotColdAnalysis(BaseModel):
    """Hot/cold performance analysis"""
    temperature: str  # emoji indicator
    status: str  # "hot", "warm", "cold", "cool", "neutral"
    avg_diff: float
    hr_rate_diff: float
    recent_stats: dict
    season_stats: dict

class ConsistencyMetrics(BaseModel):
    """Player consistency analysis"""
    score: int  # 0-100
    grade: str  # A+, A, B+, etc.
    std_dev: float
    variance: float

class StreakInfo(BaseModel):
    """Current streaks"""
    hit_streak: int
    on_base_streak: int
    multi_hit_last_10: int

class YearOverYearChange(BaseModel):
    """Year-over-year statistical changes"""
    year: int
    games: int
    avg_change: float
    ops_change: float
    hr_change: int
    rbi_change: int
    wins: Optional[int] = None
    losses: Optional[int] = None
    era_change: Optional[float] = None
    whip_change: Optional[float] = None

class MonthlySplit(BaseModel):
    """Monthly performance split"""
    month: int
    games: int
    at_bats: int
    hits: int
    home_runs: int
    rbi: int
    runs: int
    stolen_bases: int
    batting_avg: float
    obp: float
    slg: float
    ops: float

class PositionRanking(BaseModel):
    """Position-specific ranking"""
    rank: int
    player_id: int
    name: str
    batting_avg: float
    ops: float
    home_runs: int
    rbi: int
    stolen_bases: int
    runs: int

# =============================================================================
# CONTRACT & TEAM MODELS
# =============================================================================

class ContractInfo(BaseModel):
    """Player contract information in a league"""
    salary: float
    contract_years: int
    roster_status: str
    team_name: str
    owner_name: str

# =============================================================================
# CAREER & GAME LOG MODELS
# =============================================================================

class CareerSeasonStats(BaseModel):
    """Single season career stats"""
    season: int  # Changed from season_year to just season
    games_played: int
    at_bats: int
    runs: int
    hits: int
    doubles: int
    triples: int
    home_runs: int
    rbi: int
    stolen_bases: int
    caught_stealing: int
    walks: int
    strikeouts: int
    batting_avg: float
    obp: float
    slg: float
    ops: float
    games_started: int
    wins: int
    losses: int
    saves: int
    innings_pitched: float
    hits_allowed: int
    earned_runs: int
    walks_allowed: int
    strikeouts_pitched: int
    era: float
    whip: float
    quality_starts: int
    blown_saves: int
    holds: int

class GameLog(BaseModel):
    """Single game log entry"""
    game_date: str
    opponent: str
    at_bats: int
    hits: int
    doubles: int
    triples: int
    home_runs: int
    rbi: int
    runs: int
    walks: int
    strikeouts: int
    stolen_bases: int
    caught_stealing: int
    hit_by_pitch: int
    innings_pitched: float
    wins: int
    losses: int
    saves: int
    blown_saves: int
    holds: int
    earned_runs: int
    hits_allowed: int
    walks_allowed: int
    strikeouts_pitched: int
    quality_start: bool

# =============================================================================
# COMPLETE PLAYER DATA MODEL
# =============================================================================

class CompletePlayerData(BaseModel):
    """Complete player information with all stats and analytics"""
    # Basic info
    player_id: int
    first_name: str
    last_name: str
    position: str
    mlb_team: str
    jersey_number: Optional[str] = None
    is_active: bool
    height_inches: Optional[int] = None
    weight_pounds: Optional[int] = None
    birthdate: Optional[str] = None
    
    # Current season stats - FIXED: removed year from field names
    season_stats: Optional[dict] = None  # Was: season_2025_stats
    rolling_14_day: Optional[dict] = None  # Was: rolling_14_day_stats
    
    # Historical
    career_stats: Optional[list] = None
    career_totals: Optional[dict] = None
    game_logs: Optional[list] = None  # Was: game_logs_2025
    
    # Contract (if in a league)
    contract_info: Optional[dict] = None
    
    # Analytics
    analytics: Optional[dict] = None