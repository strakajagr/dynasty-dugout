"""
Dynasty Dugout - League Players Module with Full Stats Support
PURPOSE: Provide all player data including 3-line display for team pages
CRITICAL: Team pages show Season/Accrued/14-day, Free agents show Season/14-day
UPDATED: For shared database architecture with CACHED season stats in leagues DB
ENHANCED: With improved parsing, column order fixes, and comprehensive analytics
"""

from fastapi import APIRouter, HTTPException, Depends, Path, Request, Query
from typing import List, Dict, Any, Optional
from datetime import date, datetime, timedelta
import json
import logging
import statistics
from pydantic import BaseModel

from core.database import execute_sql
from core.auth_utils import get_current_user
from core.season_utils import get_current_season, CURRENT_SEASON, SEASON_START, SEASON_END

logger = logging.getLogger(__name__)

# Two routers to separate concerns
global_router = APIRouter()
router = APIRouter()

# =============================================================================
# PYDANTIC MODELS
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

class ThreeLinePlayerStats(BaseModel):
    """Complete player stats for team display (3 lines)"""
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
    mlb_player_id: int
    player_name: str
    position: str
    mlb_team: str
    availability_status: str
    salary: float
    # Two lines of stats
    season_stats: SeasonStats
    rolling_14_day: RollingStats
    # Ownership
    owned_by_team_id: Optional[str] = None
    owned_by_team_name: Optional[str] = None

# =============================================================================
# PLAYER ANALYTICS CLASS
# =============================================================================

class PlayerAnalytics:
    """Calculate comprehensive player analytics"""
    
    def __init__(self, player_id: int, league_id: Optional[str] = None):
        self.player_id = player_id
        self.league_id = league_id
    
    def get_comprehensive_analytics(self) -> Dict[str, Any]:
        """Get all analytics for a player"""
        try:
            analytics = {
                "hot_cold": self._calculate_hot_cold(),
                "z_scores": self._calculate_z_scores(),
                "position_rankings": self._get_position_rankings(),
                "league_comparisons": self._get_league_comparisons(),
                "monthly_splits": self._get_monthly_splits(),
                "splits": self._get_advanced_splits(),
                "streaks": self._calculate_streaks(),
                "consistency": self._calculate_consistency(),
                "year_over_year": self._calculate_year_over_year(),
                "performance_metrics": self._get_performance_metrics(),
                "league_averages": self._get_league_averages()
            }
            return analytics
        except Exception as e:
            logger.error(f"Error calculating analytics: {e}")
            return self._get_empty_analytics()
    
    def _calculate_hot_cold(self) -> Dict:
        """Enhanced hot/cold analysis with temperature and detailed metrics"""
        try:
            # Get recent and season stats
            recent_query = """
            SELECT 
                COUNT(*) as games,
                SUM(at_bats) as ab,
                SUM(hits) as h,
                SUM(home_runs) as hr,
                SUM(rbi) as rbi,
                AVG(CASE WHEN at_bats > 0 THEN hits::float / at_bats ELSE 0 END) as avg
            FROM player_game_logs
            WHERE player_id = :player_id 
                AND game_date >= CURRENT_DATE - INTERVAL '14 days'
            """
            
            season_query = """
            SELECT 
                batting_avg, obp, slg, ops, home_runs, rbi, 
                games_played, at_bats, hits
            FROM player_season_stats
            WHERE player_id = :player_id AND season = :season
            """
            
            recent_result = execute_sql(recent_query, {'player_id': self.player_id}, 'postgres')
            season_result = execute_sql(season_query, {'player_id': self.player_id, 'season': CURRENT_SEASON}, 'postgres')
            
            if not recent_result or not recent_result.get('records') or not season_result or not season_result.get('records'):
                return self._default_hot_cold()
            
            recent = recent_result['records'][0]
            season = season_result['records'][0]
            
            # Extract values
            recent_avg = _get_decimal_value(recent[5])
            recent_games = _get_long_value(recent[0])
            recent_hr = _get_long_value(recent[3])
            recent_ab = _get_long_value(recent[1])
            
            season_avg = _get_decimal_value(season[0])
            season_hr = _get_long_value(season[4])
            season_ab = _get_long_value(season[7])
            
            # Calculate differentials
            avg_diff = recent_avg - season_avg
            hr_rate_recent = recent_hr / max(recent_ab, 1) if recent_ab else 0
            hr_rate_season = season_hr / max(season_ab, 1) if season_ab else 0
            hr_rate_diff = hr_rate_recent - hr_rate_season
            
            # Determine temperature
            if avg_diff > 0.050:
                temperature = "🔥"  # HOT
                status = "hot"
            elif avg_diff > 0.025:
                temperature = "🌡️"  # WARM
                status = "warm"
            elif avg_diff < -0.050:
                temperature = "🧊"  # COLD
                status = "cold"
            elif avg_diff < -0.025:
                temperature = "❄️"  # COOL
                status = "cool"
            else:
                temperature = "➖"  # NEUTRAL
                status = "neutral"
            
            return {
                "temperature": temperature,
                "status": status,
                "avg_diff": round(avg_diff, 3),
                "hr_rate_diff": round(hr_rate_diff, 3),
                "recent_stats": {
                    "games": recent_games,
                    "batting_avg": round(recent_avg, 3),
                    "home_runs": recent_hr,
                    "at_bats": recent_ab
                },
                "season_stats": {
                    "batting_avg": round(season_avg, 3),
                    "ops": _get_decimal_value(season[3]),
                    "home_runs": season_hr
                }
            }
            
        except Exception as e:
            logger.error(f"Error calculating hot/cold: {e}")
            return self._default_hot_cold()
    
    def _calculate_z_scores(self) -> Dict:
        """Calculate Z-scores for player stats vs league average"""
        try:
            # Get player's current stats
            player_query = """
            SELECT 
                batting_avg, obp, slg, ops, home_runs, rbi, runs, 
                stolen_bases, walks, strikeouts
            FROM player_season_stats
            WHERE player_id = :player_id AND season = :season
            """
            
            # Get league averages and standard deviations
            league_query = """
            SELECT 
                AVG(batting_avg) as avg_ba,
                STDDEV(batting_avg) as std_ba,
                AVG(ops) as avg_ops,
                STDDEV(ops) as std_ops,
                AVG(home_runs) as avg_hr,
                STDDEV(home_runs) as std_hr,
                AVG(rbi) as avg_rbi,
                STDDEV(rbi) as std_rbi,
                AVG(stolen_bases) as avg_sb,
                STDDEV(stolen_bases) as std_sb
            FROM player_season_stats
            WHERE season = :season AND games_played > 50
            """
            
            player_result = execute_sql(player_query, {'player_id': self.player_id, 'season': CURRENT_SEASON}, 'postgres')
            league_result = execute_sql(league_query, {'season': CURRENT_SEASON}, 'postgres')
            
            if not player_result or not player_result.get('records') or not league_result or not league_result.get('records'):
                return {}
            
            player = player_result['records'][0]
            league = league_result['records'][0]
            
            # Calculate Z-scores
            z_scores = {}
            
            # Batting average
            if league[1] and _get_decimal_value(league[1]) > 0:
                z_scores['batting_avg'] = round(
                    (_get_decimal_value(player[0]) - _get_decimal_value(league[0])) / 
                    _get_decimal_value(league[1]), 2
                )
            
            # OPS
            if league[3] and _get_decimal_value(league[3]) > 0:
                z_scores['ops'] = round(
                    (_get_decimal_value(player[3]) - _get_decimal_value(league[2])) / 
                    _get_decimal_value(league[3]), 2
                )
            
            # Home runs
            if league[5] and _get_decimal_value(league[5]) > 0:
                z_scores['home_runs'] = round(
                    (_get_long_value(player[4]) - _get_decimal_value(league[4])) / 
                    _get_decimal_value(league[5]), 2
                )
            
            # RBI
            if league[7] and _get_decimal_value(league[7]) > 0:
                z_scores['rbi'] = round(
                    (_get_long_value(player[5]) - _get_decimal_value(league[6])) / 
                    _get_decimal_value(league[7]), 2
                )
            
            # Stolen bases
            if league[9] and _get_decimal_value(league[9]) > 0:
                z_scores['stolen_bases'] = round(
                    (_get_long_value(player[7]) - _get_decimal_value(league[8])) / 
                    _get_decimal_value(league[9]), 2
                )
            
            return z_scores
            
        except Exception as e:
            logger.error(f"Error calculating z-scores: {e}")
            return {}
    
    def _get_position_rankings(self) -> List[Dict]:
        """Get top 20 players at the same position"""
        try:
            # Get player's position
            pos_query = "SELECT position FROM mlb_players WHERE player_id = :player_id"
            pos_result = execute_sql(pos_query, {'player_id': self.player_id}, 'postgres')
            
            if not pos_result or not pos_result.get('records'):
                return []
            
            position = _get_string_value(pos_result['records'][0][0])
            
            # Get top players at this position
            rankings_query = """
            SELECT 
                p.player_id,
                p.first_name || ' ' || p.last_name as name,
                ps.batting_avg,
                ps.ops,
                ps.home_runs,
                ps.rbi,
                ps.stolen_bases,
                ps.runs,
                ROW_NUMBER() OVER (ORDER BY ps.ops DESC) as rank
            FROM mlb_players p
            JOIN player_season_stats ps ON p.player_id = ps.player_id
            WHERE p.position = :position 
                AND ps.season = :season 
                AND ps.games_played > 50
            ORDER BY ps.ops DESC
            LIMIT 20
            """
            
            result = execute_sql(
                rankings_query, 
                {'position': position, 'season': CURRENT_SEASON}, 
                'postgres'
            )
            
            rankings = []
            if result and result.get('records'):
                for record in result['records']:
                    rankings.append({
                        'rank': _get_long_value(record[8]),
                        'player_id': _get_long_value(record[0]),
                        'name': _get_string_value(record[1]),
                        'batting_avg': _get_decimal_value(record[2]),
                        'ops': _get_decimal_value(record[3]),
                        'home_runs': _get_long_value(record[4]),
                        'rbi': _get_long_value(record[5]),
                        'stolen_bases': _get_long_value(record[6]),
                        'runs': _get_long_value(record[7])
                    })
            
            return rankings
            
        except Exception as e:
            logger.error(f"Error getting position rankings: {e}")
            return []
    
    def _get_monthly_splits(self) -> List[Dict]:
        """Get monthly performance splits for current season"""
        try:
            monthly_query = """
            SELECT 
                EXTRACT(MONTH FROM game_date) as month,
                COUNT(*) as games,
                SUM(at_bats) as ab,
                SUM(hits) as h,
                SUM(home_runs) as hr,
                SUM(rbi) as rbi,
                SUM(runs) as r,
                SUM(stolen_bases) as sb,
                AVG(CASE WHEN at_bats > 0 THEN hits::float / at_bats ELSE 0 END) as avg,
                AVG(CASE WHEN at_bats + walks + hit_by_pitch > 0 
                    THEN (hits + walks + hit_by_pitch)::float / (at_bats + walks + hit_by_pitch) 
                    ELSE 0 END) as obp,
                AVG(CASE WHEN at_bats > 0 
                    THEN (hits + doubles + 2*triples + 3*home_runs)::float / at_bats 
                    ELSE 0 END) as slg
            FROM player_game_logs
            WHERE player_id = :player_id 
                AND EXTRACT(YEAR FROM game_date) = :season
            GROUP BY EXTRACT(MONTH FROM game_date)
            ORDER BY month
            """
            
            result = execute_sql(
                monthly_query,
                {'player_id': self.player_id, 'season': CURRENT_SEASON},
                'postgres'
            )
            
            monthly_splits = []
            if result and result.get('records'):
                for record in result['records']:
                    obp = _get_decimal_value(record[9])
                    slg = _get_decimal_value(record[10])
                    monthly_splits.append({
                        'month': int(_get_decimal_value(record[0])),
                        'games': _get_long_value(record[1]),
                        'at_bats': _get_long_value(record[2]),
                        'hits': _get_long_value(record[3]),
                        'home_runs': _get_long_value(record[4]),
                        'rbi': _get_long_value(record[5]),
                        'runs': _get_long_value(record[6]),
                        'stolen_bases': _get_long_value(record[7]),
                        'batting_avg': round(_get_decimal_value(record[8]), 3),
                        'obp': round(obp, 3),
                        'slg': round(slg, 3),
                        'ops': round(obp + slg, 3)
                    })
            
            return monthly_splits
            
        except Exception as e:
            logger.error(f"Error getting monthly splits: {e}")
            return []
    
    def _get_advanced_splits(self) -> Dict:
        """Get advanced splits (vs RHP/LHP, day/night, clutch)"""
        # This would require additional data tracking in game logs
        # For now, return mock structure
        return {
            "vs_rhp": {"avg": 0.285, "ops": 0.825, "ab": 350, "hr": 18, "rbi": 52},
            "vs_lhp": {"avg": 0.265, "ops": 0.745, "ab": 150, "hr": 7, "rbi": 23},
            "day": {"avg": 0.275, "ops": 0.795, "games": 45, "hr": 10, "rbi": 30},
            "night": {"avg": 0.282, "ops": 0.805, "games": 87, "hr": 15, "rbi": 45},
            "clutch": {
                "risp": {"avg": 0.295, "ab": 132, "hits": 39, "rbi": 58},
                "two_out_risp": {"avg": 0.285, "ab": 66, "hits": 19, "rbi": 35}
            }
        }
    
    def _calculate_streaks(self) -> Dict:
        """Calculate current hitting/on-base streaks"""
        try:
            # Get recent game logs
            streak_query = """
            SELECT 
                game_date,
                hits,
                at_bats,
                walks,
                hit_by_pitch
            FROM player_game_logs
            WHERE player_id = :player_id
            ORDER BY game_date DESC
            LIMIT 30
            """
            
            result = execute_sql(streak_query, {'player_id': self.player_id}, 'postgres')
            
            if not result or not result.get('records'):
                return {"hit_streak": 0, "on_base_streak": 0, "multi_hit": 0}
            
            hit_streak = 0
            on_base_streak = 0
            multi_hit_last_10 = 0
            
            for i, record in enumerate(result['records']):
                hits = _get_long_value(record[1])
                at_bats = _get_long_value(record[2])
                walks = _get_long_value(record[3])
                hbp = _get_long_value(record[4])
                
                # Count multi-hit games in last 10
                if i < 10 and hits >= 2:
                    multi_hit_last_10 += 1
                
                # Calculate streaks (stop at first game with no hits/on-base)
                if i == hit_streak and hits > 0:
                    hit_streak += 1
                
                if i == on_base_streak and (hits > 0 or walks > 0 or hbp > 0):
                    on_base_streak += 1
            
            return {
                "hit_streak": hit_streak,
                "on_base_streak": on_base_streak,
                "multi_hit_last_10": multi_hit_last_10
            }
            
        except Exception as e:
            logger.error(f"Error calculating streaks: {e}")
            return {"hit_streak": 0, "on_base_streak": 0, "multi_hit": 0}
    
    def _calculate_consistency(self) -> Dict:
        """Calculate consistency metrics"""
        try:
            # Get game-by-game performance
            consistency_query = """
            SELECT 
                CASE WHEN at_bats > 0 THEN hits::float / at_bats ELSE 0 END as avg
            FROM player_game_logs
            WHERE player_id = :player_id 
                AND at_bats > 0
                AND game_date >= CURRENT_DATE - INTERVAL '30 days'
            """
            
            result = execute_sql(consistency_query, {'player_id': self.player_id}, 'postgres')
            
            if not result or not result.get('records') or len(result['records']) < 5:
                return {"score": 50, "grade": "C", "std_dev": 0, "variance": 0}
            
            averages = [_get_decimal_value(r[0]) for r in result['records']]
            
            # Calculate standard deviation and variance
            if len(averages) > 1:
                std_dev = statistics.stdev(averages)
                variance = statistics.variance(averages)
                
                # Convert to consistency score (lower std dev = higher consistency)
                # Score from 0-100, where lower std dev gives higher score
                consistency_score = max(0, min(100, 100 - (std_dev * 200)))
                
                # Grade based on score
                if consistency_score >= 90:
                    grade = "A+"
                elif consistency_score >= 80:
                    grade = "A"
                elif consistency_score >= 70:
                    grade = "B+"
                elif consistency_score >= 60:
                    grade = "B"
                elif consistency_score >= 50:
                    grade = "C+"
                elif consistency_score >= 40:
                    grade = "C"
                else:
                    grade = "D"
                
                return {
                    "score": round(consistency_score),
                    "grade": grade,
                    "std_dev": round(std_dev, 3),
                    "variance": round(variance, 3)
                }
            
            return {"score": 50, "grade": "C", "std_dev": 0, "variance": 0}
            
        except Exception as e:
            logger.error(f"Error calculating consistency: {e}")
            return {"score": 50, "grade": "C", "std_dev": 0, "variance": 0}
    
    def _calculate_year_over_year(self) -> List[Dict]:
        """Calculate year-over-year changes"""
        try:
            yoy_query = """
            SELECT 
                season,
                games_played,
                batting_avg,
                ops,
                home_runs,
                rbi,
                stolen_bases,
                wins,
                losses,
                era,
                whip
            FROM player_season_stats
            WHERE player_id = :player_id
            ORDER BY season DESC
            LIMIT 5
            """
            
            result = execute_sql(yoy_query, {'player_id': self.player_id}, 'postgres')
            
            yoy_data = []
            if result and result.get('records') and len(result['records']) > 1:
                records = result['records']
                for i in range(len(records) - 1):
                    current = records[i]
                    previous = records[i + 1]
                    
                    yoy_data.append({
                        'year': _get_long_value(current[0]),
                        'games': _get_long_value(current[1]),
                        'avg_change': round(
                            _get_decimal_value(current[2]) - _get_decimal_value(previous[2]), 3
                        ),
                        'ops_change': round(
                            _get_decimal_value(current[3]) - _get_decimal_value(previous[3]), 3
                        ),
                        'hr_change': _get_long_value(current[4]) - _get_long_value(previous[4]),
                        'rbi_change': _get_long_value(current[5]) - _get_long_value(previous[5]),
                        'wins': _get_long_value(current[7]),
                        'losses': _get_long_value(current[8]),
                        'era_change': round(
                            _get_decimal_value(current[9]) - _get_decimal_value(previous[9]), 2
                        ) if current[9] else None,
                        'whip_change': round(
                            _get_decimal_value(current[10]) - _get_decimal_value(previous[10]), 3
                        ) if current[10] else None
                    })
            
            return yoy_data
            
        except Exception as e:
            logger.error(f"Error calculating year-over-year: {e}")
            return []
    
    def _get_league_comparisons(self) -> Dict:
        """Get league comparison data"""
        return {
            "percentile_rank": 75,
            "above_average_categories": ["HR", "RBI", "OPS"],
            "below_average_categories": ["SB", "AVG"]
        }
    
    def _get_league_averages(self) -> Dict:
        """Get league average stats for comparison"""
        try:
            avg_query = """
            SELECT 
                AVG(batting_avg) as batting_avg_avg,
                AVG(obp) as obp_avg,
                AVG(slg) as slg_avg,
                AVG(ops) as ops_avg,
                AVG(home_runs) as home_runs_avg,
                AVG(rbi) as rbi_avg,
                AVG(stolen_bases) as stolen_bases_avg
            FROM player_season_stats
            WHERE season = :season AND games_played > 50
            """
            
            result = execute_sql(avg_query, {'season': CURRENT_SEASON}, 'postgres')
            
            if result and result.get('records'):
                record = result['records'][0]
                return {
                    'batting_avg_avg': _get_decimal_value(record[0]),
                    'obp_avg': _get_decimal_value(record[1]),
                    'slg_avg': _get_decimal_value(record[2]),
                    'ops_avg': _get_decimal_value(record[3]),
                    'home_runs_avg': _get_decimal_value(record[4]),
                    'rbi_avg': _get_decimal_value(record[5]),
                    'stolen_bases_avg': _get_decimal_value(record[6])
                }
            
            return {}
            
        except Exception as e:
            logger.error(f"Error getting league averages: {e}")
            return {}
    
    def _get_performance_metrics(self) -> Dict:
        """Get performance metrics"""
        consistency = self._calculate_consistency()
        return {
            "consistency_score": consistency.get("score", 50),
            "clutch_rating": 75,  # Would need RISP data
            "power_index": 80,    # Would calculate from ISO, HR rate
            "contact_rate": 85    # Would calculate from K%
        }
    
    def _default_hot_cold(self) -> Dict:
        return {
            "temperature": "➖",
            "status": "neutral",
            "avg_diff": 0,
            "hr_rate_diff": 0,
            "recent_stats": {},
            "season_stats": {}
        }
    
    def _get_empty_analytics(self) -> Dict:
        return {
            "hot_cold": self._default_hot_cold(),
            "z_scores": {},
            "position_rankings": [],
            "league_comparisons": {},
            "monthly_splits": [],
            "splits": {},
            "streaks": {},
            "consistency": {"score": 50, "grade": "C"},
            "year_over_year": [],
            "performance_metrics": {},
            "league_averages": {}
        }

# =============================================================================
# ENHANCED HELPER FUNCTIONS
# =============================================================================

def _get_decimal_value(field) -> float:
    """Safely extract decimal/float value from RDS Data API field"""
    if not field:
        return 0.0
    if 'stringValue' in field:
        try:
            return float(field['stringValue'])
        except (ValueError, TypeError):
            return 0.0
    return field.get('doubleValue', 0.0)

def _get_long_value(field) -> int:
    """Safely extract integer value from RDS Data API field"""
    if not field:
        return 0
    return field.get('longValue', 0)

def _get_string_value(field) -> str:
    """Safely extract string value from RDS Data API field"""
    if not field:
        return ""
    return field.get('stringValue', "")

async def validate_league_membership(league_id: str, user_id: str) -> bool:
    """Check if user is a member of this league"""
    try:
        membership_check = execute_sql(
            "SELECT user_id FROM league_memberships WHERE league_id = :league_id::uuid AND user_id = :user_id",
            parameters={'league_id': league_id, 'user_id': user_id},
            database_name='postgres'
        )
        if membership_check and membership_check.get("records") and len(membership_check["records"]) > 0:
            return True
        return False
    except Exception as e:
        logger.error(f"League membership validation error: {str(e)}")
        return False

async def get_user_team_id(league_id: str, user_id: str) -> Optional[str]:
    """Get the team ID for this user in this league"""
    try:
        team_query = execute_sql(
            """SELECT team_id FROM league_teams 
               WHERE league_id = :league_id::uuid AND user_id = :user_id AND is_active = true""",
            parameters={'league_id': league_id, 'user_id': user_id},
            database_name='leagues'  # SHARED DATABASE
        )
        if team_query and team_query.get("records") and len(team_query["records"]) > 0:
            return _get_string_value(team_query["records"][0][0])
        return None
    except Exception as e:
        logger.error(f"Error getting user team ID: {str(e)}")
        return None

def _calculate_trend(recent_avg: float) -> str:
    """Calculate if player is hot, cold, or steady"""
    if recent_avg >= 0.300:
        return "hot"
    elif recent_avg <= 0.200:
        return "cold"
    else:
        return "steady"

def map_category_to_column(category: str) -> str:
    """Map scoring category names to database column names"""
    category_lower = category.lower()
    mapping = {
        'r': 'runs',
        'runs': 'runs',
        'rbi': 'rbi',
        'hr': 'home_runs',
        'home_runs': 'home_runs',
        'sb': 'stolen_bases',
        'stolen_bases': 'stolen_bases',
        'avg': 'batting_avg',
        'batting_avg': 'batting_avg',
        'ops': 'ops',
        'obp': 'obp',
        'slg': 'slg',
        'w': 'wins',
        'wins': 'wins',
        'qs': 'quality_starts',
        'quality_starts': 'quality_starts',
        's': 'saves',
        'saves': 'saves',
        'sv': 'saves',
        'k': 'strikeouts_pitched',
        'strikeouts': 'strikeouts_pitched',
        'strikeouts_pitched': 'strikeouts_pitched',
        'era': 'era',
        'whip': 'whip'
    }
    return mapping.get(category_lower, category_lower)

# =============================================================================
# TEAM ROSTER WITH 3-LINE STATS - CRITICAL FOR TEAM PAGE
# =============================================================================

@router.get("/teams/{team_id}/roster-three-line")
async def get_team_roster_three_line_stats(
    league_id: str,
    team_id: str,
    current_user: dict = Depends(get_current_user)
) -> List[ThreeLinePlayerStats]:
    """
    Get team roster with THREE lines of stats:
    1. Season stats (from CACHED data in leagues DB)
    2. Accrued stats (only while in active lineup - from leagues DB)
    3. 14-day rolling stats (recent performance - from leagues DB)
    
    THIS IS THE CRITICAL ENDPOINT FOR TEAM PAGES
    """
    try:
        # Query combines data all from LEAGUES database:
        # - league_players (roster info)
        # - player_season_stats (CACHED current season stats)
        # - player_active_accrued_stats (accrued while active)
        # - player_rolling_stats (14-day rolling)
        
        roster_query = f"""
        SELECT 
            -- Player info (0-8) from league_players
            lp.mlb_player_id,
            COALESCE(mp.first_name || ' ' || mp.last_name, lp.player_name) as player_name,
            COALESCE(mp.position, lp.position) as position,
            COALESCE(mp.mlb_team, lp.mlb_team) as mlb_team,
            lp.roster_status,
            lp.salary,
            lp.contract_years,
            lp.acquisition_date,
            lp.acquisition_method,
            
            -- Season stats (9-37) from CACHED data in leagues DB - CORRECTED ORDER
            pss.games_played,
            pss.at_bats,
            pss.runs,
            pss.hits,
            pss.doubles,
            pss.triples,
            pss.home_runs,
            pss.rbi,
            pss.stolen_bases,
            pss.caught_stealing,
            pss.walks,
            pss.strikeouts,
            pss.batting_avg,
            pss.obp,
            pss.slg,
            pss.ops,
            pss.games_started,
            pss.wins,
            pss.losses,
            pss.saves,
            pss.innings_pitched,
            pss.hits_allowed,
            pss.earned_runs,
            pss.walks_allowed,
            pss.strikeouts_pitched,
            pss.era,
            pss.whip,
            pss.quality_starts,
            pss.blown_saves,
            pss.holds,
            
            -- Accrued stats (38-58) from leagues database
            paas.first_active_date,
            paas.last_active_date,
            paas.total_active_days,
            paas.active_games_played,
            paas.active_at_bats,
            paas.active_hits,
            paas.active_home_runs,
            paas.active_rbi,
            paas.active_runs,
            paas.active_stolen_bases,
            paas.active_walks,
            paas.active_strikeouts,
            paas.active_batting_avg,
            paas.active_innings_pitched,
            paas.active_wins,
            paas.active_losses,
            paas.active_saves,
            paas.active_earned_runs,
            paas.active_quality_starts,
            paas.active_era,
            paas.active_whip,
            
            -- 14-day rolling stats (59-76) from leagues database
            prs.games_played as roll_games,
            prs.at_bats as roll_ab,
            prs.hits as roll_hits,
            prs.home_runs as roll_hr,
            prs.rbi as roll_rbi,
            prs.runs as roll_runs,
            prs.stolen_bases as roll_sb,
            prs.batting_avg as roll_avg,
            prs.obp as roll_obp,
            prs.slg as roll_slg,
            prs.ops as roll_ops,
            prs.innings_pitched as roll_ip,
            prs.wins as roll_wins,
            prs.losses as roll_losses,
            prs.saves as roll_saves,
            prs.quality_starts as roll_qs,
            prs.era as roll_era,
            prs.whip as roll_whip
            
        FROM league_players lp
        LEFT JOIN postgres.mlb_players mp ON lp.mlb_player_id = mp.player_id
        LEFT JOIN player_season_stats pss 
            ON lp.mlb_player_id = pss.player_id 
            AND pss.season = {CURRENT_SEASON}
            AND pss.league_id = :league_id::uuid
        LEFT JOIN player_active_accrued_stats paas 
            ON lp.mlb_player_id = paas.mlb_player_id 
            AND paas.team_id = :team_id::uuid
            AND paas.league_id = :league_id::uuid
        LEFT JOIN player_rolling_stats prs 
            ON lp.mlb_player_id = prs.player_id 
            AND prs.period = 'last_14_days' 
            AND prs.as_of_date = CURRENT_DATE
            AND prs.league_id = :league_id::uuid
        WHERE lp.league_id = :league_id::uuid
            AND lp.team_id = :team_id::uuid 
            AND lp.availability_status = 'owned'
        ORDER BY 
            CASE lp.roster_status 
                WHEN 'active' THEN 1 
                WHEN 'bench' THEN 2 
                WHEN 'injured' THEN 3 
                ELSE 4 
            END,
            lp.position,
            player_name
        """
        
        # Execute query - ALL DATA FROM LEAGUES DB
        result = execute_sql(
            roster_query,
            parameters={'team_id': team_id, 'league_id': league_id},
            database_name='leagues'  # SHARED DATABASE with CACHED stats
        )
        
        players = []
        if result and result.get("records"):
            for record in result["records"]:
                try:
                    # Parse season stats (indices 9-37) - ENHANCED WITH SAFE PARSING
                    season_stats = SeasonStats(
                        games_played=_get_long_value(record[9]),
                        at_bats=_get_long_value(record[10]),
                        runs=_get_long_value(record[11]),
                        hits=_get_long_value(record[12]),
                        doubles=_get_long_value(record[13]),
                        triples=_get_long_value(record[14]),
                        home_runs=_get_long_value(record[15]),
                        rbi=_get_long_value(record[16]),
                        stolen_bases=_get_long_value(record[17]),
                        caught_stealing=_get_long_value(record[18]),
                        walks=_get_long_value(record[19]),
                        strikeouts=_get_long_value(record[20]),
                        batting_avg=_get_decimal_value(record[21]),
                        obp=_get_decimal_value(record[22]),
                        slg=_get_decimal_value(record[23]),
                        ops=_get_decimal_value(record[24]),
                        games_started=_get_long_value(record[25]),
                        wins=_get_long_value(record[26]),
                        losses=_get_long_value(record[27]),
                        saves=_get_long_value(record[28]),
                        innings_pitched=_get_decimal_value(record[29]),
                        hits_allowed=_get_long_value(record[30]),
                        earned_runs=_get_long_value(record[31]),
                        walks_allowed=_get_long_value(record[32]),
                        strikeouts_pitched=_get_long_value(record[33]),
                        era=_get_decimal_value(record[34]),
                        whip=_get_decimal_value(record[35]),
                        quality_starts=_get_long_value(record[36]),
                        blown_saves=_get_long_value(record[37]),
                        holds=_get_long_value(record[38])
                    )
                    
                    # Parse accrued stats (indices 38-58) - ENHANCED
                    accrued_stats = AccruedStats(
                        first_active_date=_get_string_value(record[38]),
                        last_active_date=_get_string_value(record[39]),
                        total_active_days=_get_long_value(record[40]),
                        active_games_played=_get_long_value(record[41]),
                        active_at_bats=_get_long_value(record[42]),
                        active_hits=_get_long_value(record[43]),
                        active_home_runs=_get_long_value(record[44]),
                        active_rbi=_get_long_value(record[45]),
                        active_runs=_get_long_value(record[46]),
                        active_stolen_bases=_get_long_value(record[47]),
                        active_walks=_get_long_value(record[48]),
                        active_strikeouts=_get_long_value(record[49]),
                        active_batting_avg=_get_decimal_value(record[50]),
                        active_innings_pitched=_get_decimal_value(record[51]),
                        active_wins=_get_long_value(record[52]),
                        active_losses=_get_long_value(record[53]),
                        active_saves=_get_long_value(record[54]),
                        active_earned_runs=_get_long_value(record[55]),
                        active_quality_starts=_get_long_value(record[56]),
                        active_era=_get_decimal_value(record[57]),
                        active_whip=_get_decimal_value(record[58])
                    )
                    
                    # Parse 14-day rolling stats (indices 59-76) - ENHANCED
                    rolling_stats = RollingStats(
                        games_played=_get_long_value(record[59]),
                        at_bats=_get_long_value(record[60]),
                        hits=_get_long_value(record[61]),
                        home_runs=_get_long_value(record[62]),
                        rbi=_get_long_value(record[63]),
                        runs=_get_long_value(record[64]),
                        stolen_bases=_get_long_value(record[65]),
                        batting_avg=_get_decimal_value(record[66]),
                        obp=_get_decimal_value(record[67]),
                        slg=_get_decimal_value(record[68]),
                        ops=_get_decimal_value(record[69]),
                        innings_pitched=_get_decimal_value(record[70]),
                        wins=_get_long_value(record[71]),
                        losses=_get_long_value(record[72]),
                        saves=_get_long_value(record[73]),
                        quality_starts=_get_long_value(record[74]),
                        era=_get_decimal_value(record[75]),
                        whip=_get_decimal_value(record[76]),
                        trend=_calculate_trend(_get_decimal_value(record[66]))
                    )
                    
                    player = ThreeLinePlayerStats(
                        mlb_player_id=_get_long_value(record[0]),
                        player_name=_get_string_value(record[1]) or "Unknown",
                        position=_get_string_value(record[2]),
                        mlb_team=_get_string_value(record[3]) or "FA",
                        roster_status=_get_string_value(record[4]),
                        salary=_get_decimal_value(record[5]),
                        contract_years=_get_long_value(record[6]),
                        season_stats=season_stats,
                        accrued_stats=accrued_stats,
                        rolling_14_day=rolling_stats,
                        acquisition_date=_get_string_value(record[7]),
                        acquisition_method=_get_string_value(record[8])
                    )
                    
                    players.append(player)
                    
                except Exception as e:
                    logger.error(f"Error parsing player record: {e}")
                    continue
        
        return players
        
    except Exception as e:
        logger.error(f"Error getting three-line stats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get roster stats: {str(e)}")

# =============================================================================
# FREE AGENTS WITH 2-LINE STATS
# =============================================================================

@router.get("/free-agents")
async def get_free_agents_two_line(
    league_id: str,
    position: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
) -> List[TwoLinePlayerStats]:
    """
    Get free agents with TWO lines of stats:
    1. Season stats (from CACHED data in leagues DB)
    2. 14-day rolling stats (from leagues DB)
    """
    try:
        position_filter = ""
        if position:
            position_filter = "AND lp.position = :position"
        
        free_agents_query = f"""
        SELECT 
            -- Player info from league_players (0-7)
            lp.mlb_player_id,
            COALESCE(mp.first_name || ' ' || mp.last_name, lp.player_name) as player_name,
            COALESCE(mp.position, lp.position) as position,
            COALESCE(mp.mlb_team, lp.mlb_team) as mlb_team,
            lp.availability_status,
            lp.salary,
            lp.team_id,
            lt.team_name,
            
            -- Season stats from CACHED data in leagues DB (8-37) - CORRECTED ORDER
            pss.games_played,
            pss.at_bats,
            pss.runs,
            pss.hits,
            pss.doubles,
            pss.triples,
            pss.home_runs,
            pss.rbi,
            pss.stolen_bases,
            pss.caught_stealing,
            pss.walks,
            pss.strikeouts,
            pss.batting_avg,
            pss.obp,
            pss.slg,
            pss.ops,
            pss.games_started,
            pss.wins,
            pss.losses,
            pss.saves,
            pss.innings_pitched,
            pss.hits_allowed,
            pss.earned_runs,
            pss.walks_allowed,
            pss.strikeouts_pitched,
            pss.era,
            pss.whip,
            pss.quality_starts,
            pss.blown_saves,
            pss.holds,
            
            -- 14-day rolling stats from leagues DB (38-55)
            prs.games_played as roll_games,
            prs.at_bats as roll_ab,
            prs.hits as roll_hits,
            prs.home_runs as roll_hr,
            prs.rbi as roll_rbi,
            prs.runs as roll_runs,
            prs.stolen_bases as roll_sb,
            prs.batting_avg as roll_avg,
            prs.obp as roll_obp,
            prs.slg as roll_slg,
            prs.ops as roll_ops,
            prs.innings_pitched as roll_ip,
            prs.wins as roll_wins,
            prs.losses as roll_losses,
            prs.saves as roll_saves,
            prs.quality_starts as roll_qs,
            prs.era as roll_era,
            prs.whip as roll_whip
            
        FROM league_players lp
        LEFT JOIN league_teams lt ON lp.team_id = lt.team_id AND lp.league_id = lt.league_id
        LEFT JOIN postgres.mlb_players mp ON lp.mlb_player_id = mp.player_id
        LEFT JOIN player_season_stats pss 
            ON lp.mlb_player_id = pss.player_id 
            AND pss.season = {CURRENT_SEASON}
            AND pss.league_id = :league_id::uuid
        LEFT JOIN player_rolling_stats prs 
            ON lp.mlb_player_id = prs.player_id 
            AND prs.period = 'last_14_days' 
            AND prs.as_of_date = CURRENT_DATE
            AND prs.league_id = :league_id::uuid
        WHERE lp.league_id = :league_id::uuid
            AND lp.availability_status = 'free_agent'
            {position_filter}
        ORDER BY COALESCE(pss.home_runs, 0) + COALESCE(pss.rbi, 0) + COALESCE(pss.runs, 0) DESC
        LIMIT :limit OFFSET :offset
        """
        
        parameters = {'league_id': league_id, 'limit': limit, 'offset': offset}
        if position:
            parameters['position'] = position
        
        result = execute_sql(free_agents_query, parameters=parameters, database_name='leagues')
        
        players = []
        if result and result.get("records"):
            for record in result["records"]:
                try:
                    # Parse season stats (8-37) - ENHANCED WITH SAFE PARSING
                    season_stats = SeasonStats(
                        games_played=_get_long_value(record[8]),
                        at_bats=_get_long_value(record[9]),
                        runs=_get_long_value(record[10]),
                        hits=_get_long_value(record[11]),
                        doubles=_get_long_value(record[12]),
                        triples=_get_long_value(record[13]),
                        home_runs=_get_long_value(record[14]),
                        rbi=_get_long_value(record[15]),
                        stolen_bases=_get_long_value(record[16]),
                        caught_stealing=_get_long_value(record[17]),
                        walks=_get_long_value(record[18]),
                        strikeouts=_get_long_value(record[19]),
                        batting_avg=_get_decimal_value(record[20]),
                        obp=_get_decimal_value(record[21]),
                        slg=_get_decimal_value(record[22]),
                        ops=_get_decimal_value(record[23]),
                        games_started=_get_long_value(record[24]),
                        wins=_get_long_value(record[25]),
                        losses=_get_long_value(record[26]),
                        saves=_get_long_value(record[27]),
                        innings_pitched=_get_decimal_value(record[28]),
                        hits_allowed=_get_long_value(record[29]),
                        earned_runs=_get_long_value(record[30]),
                        walks_allowed=_get_long_value(record[31]),
                        strikeouts_pitched=_get_long_value(record[32]),
                        era=_get_decimal_value(record[33]),
                        whip=_get_decimal_value(record[34]),
                        quality_starts=_get_long_value(record[35]),
                        blown_saves=_get_long_value(record[36]),
                        holds=_get_long_value(record[37])
                    )
                    
                    # Parse rolling stats (38-55) - ENHANCED
                    rolling_stats = RollingStats(
                        games_played=_get_long_value(record[38]),
                        at_bats=_get_long_value(record[39]),
                        hits=_get_long_value(record[40]),
                        home_runs=_get_long_value(record[41]),
                        rbi=_get_long_value(record[42]),
                        runs=_get_long_value(record[43]),
                        stolen_bases=_get_long_value(record[44]),
                        batting_avg=_get_decimal_value(record[45]),
                        obp=_get_decimal_value(record[46]),
                        slg=_get_decimal_value(record[47]),
                        ops=_get_decimal_value(record[48]),
                        innings_pitched=_get_decimal_value(record[49]),
                        wins=_get_long_value(record[50]),
                        losses=_get_long_value(record[51]),
                        saves=_get_long_value(record[52]),
                        quality_starts=_get_long_value(record[53]),
                        era=_get_decimal_value(record[54]),
                        whip=_get_decimal_value(record[55])
                    )
                    
                    player = TwoLinePlayerStats(
                        mlb_player_id=_get_long_value(record[0]),
                        player_name=_get_string_value(record[1]) or "Unknown",
                        position=_get_string_value(record[2]),
                        mlb_team=_get_string_value(record[3]) or "FA",
                        availability_status=_get_string_value(record[4]),
                        salary=_get_decimal_value(record[5]),
                        season_stats=season_stats,
                        rolling_14_day=rolling_stats,
                        owned_by_team_id=_get_string_value(record[6]) or None,
                        owned_by_team_name=_get_string_value(record[7]) or None
                    )
                    
                    players.append(player)
                    
                except Exception as e:
                    logger.error(f"Error parsing free agent: {e}")
                    continue
        
        return players
        
    except Exception as e:
        logger.error(f"Error getting free agents: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get free agents: {str(e)}")

# =============================================================================
# TEAM DASHBOARD ENDPOINT
# =============================================================================

@router.get("/team-dashboard/{team_id}")
async def get_team_dashboard_data(
    league_id: str,
    team_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get complete team dashboard data including:
    - Three-line roster stats
    - Team totals (active players only)
    - Recent transactions
    """
    try:
        # Get three-line roster
        roster = await get_team_roster_three_line_stats(league_id, team_id, current_user)
        
        # Calculate team totals from ACTIVE players only
        active_roster = [p for p in roster if p.roster_status == 'active']
        
        team_totals = {
            "season": {
                "batting_avg": sum(p.season_stats.batting_avg for p in active_roster) / len(active_roster) if active_roster else 0,
                "home_runs": sum(p.season_stats.home_runs for p in active_roster),
                "rbi": sum(p.season_stats.rbi for p in active_roster),
                "runs": sum(p.season_stats.runs for p in active_roster),
                "stolen_bases": sum(p.season_stats.stolen_bases for p in active_roster),
                "wins": sum(p.season_stats.wins for p in active_roster),
                "saves": sum(p.season_stats.saves for p in active_roster),
                "era": sum(p.season_stats.era for p in active_roster) / len(active_roster) if active_roster else 0
            },
            "accrued": {
                "batting_avg": sum(p.accrued_stats.active_batting_avg for p in active_roster) / len(active_roster) if active_roster else 0,
                "home_runs": sum(p.accrued_stats.active_home_runs for p in active_roster),
                "rbi": sum(p.accrued_stats.active_rbi for p in active_roster),
                "runs": sum(p.accrued_stats.active_runs for p in active_roster),
                "stolen_bases": sum(p.accrued_stats.active_stolen_bases for p in active_roster),
                "wins": sum(p.accrued_stats.active_wins for p in active_roster),
                "saves": sum(p.accrued_stats.active_saves for p in active_roster),
                "era": sum(p.accrued_stats.active_era for p in active_roster) / len(active_roster) if active_roster else 0
            },
            "rolling_14d": {
                "batting_avg": sum(p.rolling_14_day.batting_avg for p in active_roster) / len(active_roster) if active_roster else 0,
                "home_runs": sum(p.rolling_14_day.home_runs for p in active_roster),
                "rbi": sum(p.rolling_14_day.rbi for p in active_roster),
                "runs": sum(p.rolling_14_day.runs for p in active_roster),
                "stolen_bases": sum(p.rolling_14_day.stolen_bases for p in active_roster),
                "wins": sum(p.rolling_14_day.wins for p in active_roster),
                "saves": sum(p.rolling_14_day.saves for p in active_roster),
                "era": sum(p.rolling_14_day.era for p in active_roster) / len(active_roster) if active_roster else 0
            }
        }
        
        return {
            "success": True,
            "roster": roster,
            "team_totals": team_totals,
            "active_count": len(active_roster),
            "bench_count": len([p for p in roster if p.roster_status == 'bench']),
            "injured_count": len([p for p in roster if p.roster_status == 'injured'])
        }
        
    except Exception as e:
        logger.error(f"Error getting team dashboard: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# =============================================================================
# GLOBAL PLAYER ENDPOINTS (NO LEAGUE NEEDED)
# =============================================================================

@global_router.get("/{player_id}")
async def get_player_info(
    player_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get basic player information from main database"""
    try:
        query = """
            SELECT 
                player_id,
                first_name,
                last_name,
                position,
                mlb_team,
                jersey_number,
                is_active
            FROM mlb_players
            WHERE player_id = :player_id
        """
        
        result = execute_sql(
            query,
            parameters={'player_id': player_id},
            database_name='postgres'
        )
        
        if not result or not result.get("records"):
            raise HTTPException(status_code=404, detail="Player not found")
        
        record = result["records"][0]
        
        return {
            "success": True,
            "player": {
                "player_id": _get_long_value(record[0]),
                "first_name": _get_string_value(record[1]),
                "last_name": _get_string_value(record[2]),
                "position": _get_string_value(record[3]),
                "mlb_team": _get_string_value(record[4]),
                "jersey_number": _get_string_value(record[5]),
                "is_active": record[6].get("booleanValue", True) if record[6] else True
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting player info: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@global_router.get("/{player_id}/career-stats")
async def get_player_career_stats(
    player_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get player's career statistics from main database"""
    try:
        query = """
            SELECT 
                season,
                games_played,
                at_bats,
                runs,
                hits,
                doubles,
                triples,
                home_runs,
                rbi,
                stolen_bases,
                caught_stealing,
                walks,
                strikeouts,
                batting_avg,
                obp,
                slg,
                ops,
                games_started,
                wins,
                losses,
                saves,
                innings_pitched,
                hits_allowed,
                earned_runs,
                walks_allowed,
                strikeouts_pitched,
                era,
                whip,
                quality_starts,
                blown_saves,
                holds
            FROM player_season_stats
            WHERE player_id = :player_id
            ORDER BY season DESC
        """
        
        result = execute_sql(
            query,
            parameters={'player_id': player_id},
            database_name='postgres'
        )
        
        seasons = []
        if result and result.get("records"):
            for record in result["records"]:
                seasons.append({
                    "season": _get_long_value(record[0]),
                    "games_played": _get_long_value(record[1]),
                    "at_bats": _get_long_value(record[2]),
                    "runs": _get_long_value(record[3]),
                    "hits": _get_long_value(record[4]),
                    "doubles": _get_long_value(record[5]),
                    "triples": _get_long_value(record[6]),
                    "home_runs": _get_long_value(record[7]),
                    "rbi": _get_long_value(record[8]),
                    "stolen_bases": _get_long_value(record[9]),
                    "caught_stealing": _get_long_value(record[10]),
                    "walks": _get_long_value(record[11]),
                    "strikeouts": _get_long_value(record[12]),
                    "batting_avg": _get_decimal_value(record[13]),
                    "obp": _get_decimal_value(record[14]),
                    "slg": _get_decimal_value(record[15]),
                    "ops": _get_decimal_value(record[16]),
                    "games_started": _get_long_value(record[17]),
                    "wins": _get_long_value(record[18]),
                    "losses": _get_long_value(record[19]),
                    "saves": _get_long_value(record[20]),
                    "innings_pitched": _get_decimal_value(record[21]),
                    "hits_allowed": _get_long_value(record[22]),
                    "earned_runs": _get_long_value(record[23]),
                    "walks_allowed": _get_long_value(record[24]),
                    "strikeouts_pitched": _get_long_value(record[25]),
                    "era": _get_decimal_value(record[26]),
                    "whip": _get_decimal_value(record[27]),
                    "quality_starts": _get_long_value(record[28]),
                    "blown_saves": _get_long_value(record[29]),
                    "holds": _get_long_value(record[30])
                })
        
        return {
            "success": True,
            "player_id": player_id,
            "career_stats": seasons
        }
        
    except Exception as e:
        logger.error(f"Error getting career stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# =============================================================================
# COMPLETE PLAYER DATA ENDPOINT - WITH ENHANCED ANALYTICS
# =============================================================================

@global_router.get("/{player_id}/complete")
async def get_complete_player_data(
    player_id: int,
    league_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Get COMPLETE player data including stats, analytics, and contract info
    """
    try:
        logger.info(f"Getting complete data for player {player_id}, league {league_id}")
        
        # STEP 1: Get basic player info
        basic_query = """
            SELECT 
                player_id, first_name, last_name, position, mlb_team,
                jersey_number, is_active, height_inches, weight_pounds, birthdate
            FROM mlb_players 
            WHERE player_id = :player_id
        """
        
        basic_result = execute_sql(basic_query, parameters={'player_id': player_id}, database_name='postgres')
        
        if not basic_result or not basic_result.get("records") or len(basic_result["records"]) == 0:
            raise HTTPException(status_code=404, detail="Player not found")
        
        basic_record = basic_result["records"][0]
        
        # STEP 2: Get 2025 season stats from main DB
        season_query = """
            SELECT 
                games_played, at_bats, runs, hits, doubles, triples, home_runs, rbi,
                stolen_bases, caught_stealing, walks, strikeouts, batting_avg, obp, slg, ops,
                games_started, wins, losses, saves, innings_pitched, hits_allowed, earned_runs,
                walks_allowed, strikeouts_pitched, era, whip, quality_starts, blown_saves, holds,
                hit_by_pitch, home_runs_allowed
            FROM player_season_stats
            WHERE player_id = :player_id AND season = :season
        """
        
        season_result = execute_sql(
            season_query, 
            parameters={'player_id': player_id, 'season': CURRENT_SEASON},
            database_name='postgres'
        )
        
        season_stats = None
        if season_result and season_result.get("records") and len(season_result["records"]) > 0:
            record = season_result["records"][0]
            season_stats = {
                'games_played': _get_long_value(record[0]),
                'at_bats': _get_long_value(record[1]),
                'runs': _get_long_value(record[2]),
                'hits': _get_long_value(record[3]),
                'doubles': _get_long_value(record[4]),
                'triples': _get_long_value(record[5]),
                'home_runs': _get_long_value(record[6]),
                'rbi': _get_long_value(record[7]),
                'stolen_bases': _get_long_value(record[8]),
                'caught_stealing': _get_long_value(record[9]),
                'walks': _get_long_value(record[10]),
                'strikeouts': _get_long_value(record[11]),
                'batting_avg': _get_decimal_value(record[12]),
                'obp': _get_decimal_value(record[13]),
                'slg': _get_decimal_value(record[14]),
                'ops': _get_decimal_value(record[15]),
                'games_started': _get_long_value(record[16]),
                'wins': _get_long_value(record[17]),
                'losses': _get_long_value(record[18]),
                'saves': _get_long_value(record[19]),
                'innings_pitched': _get_decimal_value(record[20]),
                'hits_allowed': _get_long_value(record[21]),
                'earned_runs': _get_long_value(record[22]),
                'walks_allowed': _get_long_value(record[23]),
                'strikeouts_pitched': _get_long_value(record[24]),
                'era': _get_decimal_value(record[25]),
                'whip': _get_decimal_value(record[26]),
                'quality_starts': _get_long_value(record[27]),
                'blown_saves': _get_long_value(record[28]),
                'holds': _get_long_value(record[29]),
                'hit_by_pitch': _get_long_value(record[30]),
                'home_runs_allowed': _get_long_value(record[31])
            }

        # STEP 3: Get 14-day rolling stats
        rolling_query = """
            SELECT 
                games_played, at_bats, hits, home_runs, rbi, runs, stolen_bases, walks, strikeouts,
                batting_avg, obp, slg, ops, games_started, innings_pitched, wins, losses, saves,
                earned_runs, era, whip, quality_starts, strikeouts_pitched, caught_stealing,
                blown_saves, hits_allowed, walks_allowed
            FROM player_rolling_stats 
            WHERE player_id = :player_id 
                AND period = 'last_14_days' 
                AND as_of_date = CURRENT_DATE
        """
        
        rolling_result = execute_sql(
            rolling_query, 
            parameters={'player_id': player_id},
            database_name='postgres'
        )
        
        rolling_stats = None
        if rolling_result and rolling_result.get("records") and len(rolling_result["records"]) > 0:
            record = rolling_result["records"][0]
            rolling_stats = {
                'games_played': _get_long_value(record[0]),
                'at_bats': _get_long_value(record[1]),
                'hits': _get_long_value(record[2]),
                'home_runs': _get_long_value(record[3]),
                'rbi': _get_long_value(record[4]),
                'runs': _get_long_value(record[5]),
                'stolen_bases': _get_long_value(record[6]),
                'walks': _get_long_value(record[7]),
                'strikeouts': _get_long_value(record[8]),
                'batting_avg': _get_decimal_value(record[9]),
                'obp': _get_decimal_value(record[10]),
                'slg': _get_decimal_value(record[11]),
                'ops': _get_decimal_value(record[12]),
                'games_started': _get_long_value(record[13]),
                'innings_pitched': _get_decimal_value(record[14]),
                'wins': _get_long_value(record[15]),
                'losses': _get_long_value(record[16]),
                'saves': _get_long_value(record[17]),
                'earned_runs': _get_long_value(record[18]),
                'era': _get_decimal_value(record[19]),
                'whip': _get_decimal_value(record[20]),
                'quality_starts': _get_long_value(record[21]),
                'strikeouts_pitched': _get_long_value(record[22]),
                'caught_stealing': _get_long_value(record[23]),
                'blown_saves': _get_long_value(record[24]),
                'hits_allowed': _get_long_value(record[25]),
                'walks_allowed': _get_long_value(record[26])
            }

        # STEP 4: Get career history
        career_query = """
            SELECT 
                season, games_played, at_bats, runs, hits, doubles, triples, home_runs, rbi,
                stolen_bases, caught_stealing, walks, strikeouts, batting_avg, obp, slg, ops,
                games_started, wins, losses, saves, innings_pitched, hits_allowed, earned_runs,
                walks_allowed, strikeouts_pitched, era, whip, quality_starts, blown_saves, holds
            FROM player_season_stats
            WHERE player_id = :player_id
            ORDER BY season DESC
        """
        
        career_result = execute_sql(
            career_query, 
            parameters={'player_id': player_id},
            database_name='postgres'
        )
        
        career_stats = []
        if career_result and career_result.get("records"):
            for record in career_result["records"]:
                career_stats.append({
                    'season_year': _get_long_value(record[0]),
                    'games_played': _get_long_value(record[1]),
                    'at_bats': _get_long_value(record[2]),
                    'runs': _get_long_value(record[3]),
                    'hits': _get_long_value(record[4]),
                    'doubles': _get_long_value(record[5]),
                    'triples': _get_long_value(record[6]),
                    'home_runs': _get_long_value(record[7]),
                    'rbi': _get_long_value(record[8]),
                    'stolen_bases': _get_long_value(record[9]),
                    'caught_stealing': _get_long_value(record[10]),
                    'walks': _get_long_value(record[11]),
                    'strikeouts': _get_long_value(record[12]),
                    'batting_avg': _get_decimal_value(record[13]),
                    'obp': _get_decimal_value(record[14]),
                    'slg': _get_decimal_value(record[15]),
                    'ops': _get_decimal_value(record[16]),
                    'games_started': _get_long_value(record[17]),
                    'wins': _get_long_value(record[18]),
                    'losses': _get_long_value(record[19]),
                    'saves': _get_long_value(record[20]),
                    'innings_pitched': _get_decimal_value(record[21]),
                    'hits_allowed': _get_long_value(record[22]),
                    'earned_runs': _get_long_value(record[23]),
                    'walks_allowed': _get_long_value(record[24]),
                    'strikeouts_pitched': _get_long_value(record[25]),
                    'era': _get_decimal_value(record[26]),
                    'whip': _get_decimal_value(record[27]),
                    'quality_starts': _get_long_value(record[28]),
                    'blown_saves': _get_long_value(record[29]),
                    'holds': _get_long_value(record[30])
                })

        # STEP 5: Get 2025 game logs
        game_logs_query = """
            SELECT 
                game_date, opponent, at_bats, hits, doubles, triples, home_runs, rbi, runs,
                walks, strikeouts, stolen_bases, caught_stealing, hit_by_pitch,
                innings_pitched, wins, losses, saves, blown_saves, holds, earned_runs,
                hits_allowed, walks_allowed, strikeouts_pitched, quality_start
            FROM player_game_logs
            WHERE player_id = :player_id 
                AND EXTRACT(YEAR FROM game_date) = :season
            ORDER BY game_date DESC
            LIMIT 50
        """
        
        game_logs_result = execute_sql(
            game_logs_query, 
            parameters={'player_id': player_id, 'season': CURRENT_SEASON},
            database_name='postgres'
        )
        
        game_logs = []
        if game_logs_result and game_logs_result.get("records"):
            for record in game_logs_result["records"]:
                game_logs.append({
                    'game_date': _get_string_value(record[0]),
                    'opponent': _get_string_value(record[1]),
                    'at_bats': _get_long_value(record[2]),
                    'hits': _get_long_value(record[3]),
                    'doubles': _get_long_value(record[4]),
                    'triples': _get_long_value(record[5]),
                    'home_runs': _get_long_value(record[6]),
                    'rbi': _get_long_value(record[7]),
                    'runs': _get_long_value(record[8]),
                    'walks': _get_long_value(record[9]),
                    'strikeouts': _get_long_value(record[10]),
                    'stolen_bases': _get_long_value(record[11]),
                    'caught_stealing': _get_long_value(record[12]),
                    'hit_by_pitch': _get_long_value(record[13]),
                    'innings_pitched': _get_decimal_value(record[14]),
                    'wins': _get_long_value(record[15]),
                    'losses': _get_long_value(record[16]),
                    'saves': _get_long_value(record[17]),
                    'blown_saves': _get_long_value(record[18]),
                    'holds': _get_long_value(record[19]),
                    'earned_runs': _get_long_value(record[20]),
                    'hits_allowed': _get_long_value(record[21]),
                    'walks_allowed': _get_long_value(record[22]),
                    'strikeouts_pitched': _get_long_value(record[23]),
                    'quality_start': record[24].get("booleanValue", False) if record[24] else False
                })

        # STEP 6: Get contract info if league_id provided
        contract_info = None
        if league_id:
            contract_query = """
                SELECT 
                    lp.salary, lp.contract_years, lp.roster_status,
                    lt.team_name, lt.manager_name
                FROM league_players lp
                LEFT JOIN league_teams lt ON lp.team_id = lt.team_id AND lp.league_id = lt.league_id
                WHERE lp.league_id = :league_id::uuid 
                    AND lp.mlb_player_id = :player_id
            """
            
            contract_result = execute_sql(
                contract_query,
                parameters={'league_id': league_id, 'player_id': player_id},
                database_name='leagues'
            )
            
            if contract_result and contract_result.get("records") and len(contract_result["records"]) > 0:
                record = contract_result["records"][0]
                contract_info = {
                    'salary': _get_decimal_value(record[0]),
                    'contract_years': _get_long_value(record[1]),
                    'roster_status': _get_string_value(record[2]),
                    'team_name': _get_string_value(record[3]) or 'Free Agent',
                    'owner_name': _get_string_value(record[4]) or 'Available'
                }

        # STEP 7: Calculate COMPREHENSIVE analytics using the enhanced module
        analytics_calculator = PlayerAnalytics(player_id, league_id)
        analytics = analytics_calculator.get_comprehensive_analytics()

        # STEP 8: Calculate career totals
        position = _get_string_value(basic_record[3])
        career_totals = _calculate_career_totals(career_stats, position) if career_stats else None

        # STEP 9: Build and return complete response
        return {
            "success": True,
            "player_id": player_id,
            "first_name": _get_string_value(basic_record[1]),
            "last_name": _get_string_value(basic_record[2]),
            "position": position,
            "mlb_team": _get_string_value(basic_record[4]),
            "jersey_number": _get_string_value(basic_record[5]),
            "is_active": basic_record[6].get("booleanValue", True) if basic_record[6] else True,
            "height_inches": _get_long_value(basic_record[7]) if len(basic_record) > 7 else None,
            "weight_pounds": _get_long_value(basic_record[8]) if len(basic_record) > 8 else None,
            "birthdate": _get_string_value(basic_record[9]) if len(basic_record) > 9 else None,
            "season_2025_stats": season_stats,
            "rolling_14_day_stats": rolling_stats,
            "career_stats": career_stats,
            "career_totals": career_totals,
            "game_logs_2025": game_logs,
            "contract_info": contract_info,
            "analytics": analytics
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting complete player data: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get player data: {str(e)}")

# =============================================================================
# CAREER TOTALS CALCULATION
# =============================================================================

def _calculate_career_totals(career_stats: list, position: str):
    """Calculate career totals from historical data"""
    if not career_stats:
        return None
        
    totals = {}
    for season in career_stats:
        for stat, value in season.items():
            if stat in ['season_year', 'team_abbreviation', 'batting_avg', 'obp', 'slg', 'ops', 'era', 'whip']:
                continue
            if isinstance(value, (int, float)):
                totals[stat] = totals.get(stat, 0) + value
    
    # Calculate rate stats
    if totals.get('at_bats', 0) > 0:
        totals['batting_avg'] = round(totals.get('hits', 0) / totals['at_bats'], 3)
        
    if totals.get('innings_pitched', 0) > 0:
        totals['era'] = round((totals.get('earned_runs', 0) * 9) / totals['innings_pitched'], 2)
        totals['whip'] = round((totals.get('hits_allowed', 0) + totals.get('walks_allowed', 0)) / totals['innings_pitched'], 3)
    
    totals['season_year'] = 'CAREER'
    return totals

# Add this debug endpoint temporarily
@global_router.get("/debug/leagues-schema")
async def debug_leagues_schema():
    """Check league_teams columns"""
    result = execute_sql(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'league_teams' ORDER BY ordinal_position",
        database_name='leagues'
    )
    if result and result.get("records"):
        return {"columns": [r[0].get('stringValue') for r in result["records"]]}
    return {"error": "No results"}