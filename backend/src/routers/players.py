"""
Dynasty Dugout - Players Router
League-agnostic player endpoints for dashboard search and player profiles
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List, Dict, Any
import logging
from core.database import execute_sql
from core.season_utils import CURRENT_SEASON

logger = logging.getLogger(__name__)
router = APIRouter()

def get_value_from_field(field, value_type='long'):
    """Helper function to extract values from AWS RDS Data API response fields"""
    if not field:
        return 0 if value_type != 'string' else ""
    
    if value_type == 'long':
        return field.get("longValue", 0) or field.get("intValue", 0)
    elif value_type == 'decimal':
        val = field.get("stringValue")
        if val:
            try:
                return float(val)
            except:
                pass
        return field.get("doubleValue", 0.0) or field.get("floatValue", 0.0)
    elif value_type == 'string':
        return field.get("stringValue", "")
    return 0

# =============================================================================
# PLAYER SEARCH (Dashboard search bar)
# =============================================================================

@router.get("/search")
async def search_players(
    q: str = Query(..., min_length=2, description="Search query"),
    limit: int = Query(20, ge=1, le=100)
):
    """
    Search for players by name, team, or position
    Used by the main dashboard search bar
    """
    try:
        search_query = f"%{q}%"
        
        sql = """
        SELECT 
            p.player_id,
            p.first_name,
            p.last_name,
            p.position,
            p.mlb_team,
            p.jersey_number,
            ps.batting_avg,
            ps.home_runs,
            ps.rbi,
            ps.ops,
            ps.games_played
        FROM mlb_players p
        LEFT JOIN player_season_stats ps ON p.player_id = ps.player_id 
            AND ps.season = :season
        WHERE 
            (LOWER(p.first_name || ' ' || p.last_name) LIKE LOWER(:search)
            OR LOWER(p.mlb_team) LIKE LOWER(:search)
            OR LOWER(p.position) LIKE LOWER(:search))
            AND p.is_active = true
        ORDER BY 
            CASE 
                WHEN LOWER(p.first_name || ' ' || p.last_name) = LOWER(:exact) THEN 0
                WHEN LOWER(p.first_name || ' ' || p.last_name) LIKE LOWER(:starts_with) THEN 1
                ELSE 2
            END,
            ps.ops DESC NULLS LAST
        LIMIT :limit
        """
        
        response = execute_sql(
            sql,
            parameters={
                'search': search_query,
                'exact': q,
                'starts_with': f"{q}%",
                'season': CURRENT_SEASON,
                'limit': limit
            },
            database_name='postgres'
        )
        
        players = []
        if response and response.get('records'):
            for record in response['records']:
                players.append({
                    'player_id': get_value_from_field(record[0], 'long'),
                    'name': f"{get_value_from_field(record[1], 'string')} {get_value_from_field(record[2], 'string')}",
                    'position': get_value_from_field(record[3], 'string'),
                    'team': get_value_from_field(record[4], 'string'),
                    'jersey_number': get_value_from_field(record[5], 'long'),
                    'stats': {
                        'batting_avg': get_value_from_field(record[6], 'decimal'),
                        'home_runs': get_value_from_field(record[7], 'long'),
                        'rbi': get_value_from_field(record[8], 'long'),
                        'ops': get_value_from_field(record[9], 'decimal'),
                        'games_played': get_value_from_field(record[10], 'long')
                    }
                })
        
        return {
            "success": True,
            "count": len(players),
            "players": players
        }
        
    except Exception as e:
        logger.error(f"Error searching players: {e}")
        raise HTTPException(status_code=500, detail="Failed to search players")

# =============================================================================
# PLAYER PROFILE
# =============================================================================

@router.get("/{player_id}")
async def get_player_profile(player_id: int):
    """Get complete player profile with current season stats"""
    try:
        # Get player basic info and current stats
        sql = """
        SELECT 
            p.player_id,
            p.first_name,
            p.last_name,
            p.position,
            p.mlb_team,
            p.jersey_number,
            p.bats,
            p.throws,
            p.height,
            p.weight,
            p.birth_date,
            ps.games_played,
            ps.at_bats,
            ps.hits,
            ps.runs,
            ps.rbi,
            ps.home_runs,
            ps.stolen_bases,
            ps.walks,
            ps.strikeouts,
            ps.batting_avg,
            ps.obp,
            ps.slg,
            ps.ops,
            ps.doubles,
            ps.triples,
            ps.hit_by_pitch,
            -- Pitching stats
            ps.innings_pitched,
            ps.wins,
            ps.losses,
            ps.saves,
            ps.era,
            ps.whip,
            ps.strikeouts_pitched
        FROM mlb_players p
        LEFT JOIN player_season_stats ps ON p.player_id = ps.player_id 
            AND ps.season = :season
        WHERE p.player_id = :player_id
        """
        
        response = execute_sql(
            sql,
            parameters={'player_id': player_id, 'season': CURRENT_SEASON},
            database_name='postgres'
        )
        
        if not response or not response.get('records'):
            raise HTTPException(status_code=404, detail="Player not found")
        
        record = response['records'][0]
        
        player_profile = {
            'player_id': get_value_from_field(record[0], 'long'),
            'name': f"{get_value_from_field(record[1], 'string')} {get_value_from_field(record[2], 'string')}",
            'position': get_value_from_field(record[3], 'string'),
            'team': get_value_from_field(record[4], 'string'),
            'jersey_number': get_value_from_field(record[5], 'long'),
            'bats': get_value_from_field(record[6], 'string'),
            'throws': get_value_from_field(record[7], 'string'),
            'height': get_value_from_field(record[8], 'string'),
            'weight': get_value_from_field(record[9], 'long'),
            'birth_date': get_value_from_field(record[10], 'string'),
            'current_season': {
                'batting': {
                    'games_played': get_value_from_field(record[11], 'long'),
                    'at_bats': get_value_from_field(record[12], 'long'),
                    'hits': get_value_from_field(record[13], 'long'),
                    'runs': get_value_from_field(record[14], 'long'),
                    'rbi': get_value_from_field(record[15], 'long'),
                    'home_runs': get_value_from_field(record[16], 'long'),
                    'stolen_bases': get_value_from_field(record[17], 'long'),
                    'walks': get_value_from_field(record[18], 'long'),
                    'strikeouts': get_value_from_field(record[19], 'long'),
                    'batting_avg': get_value_from_field(record[20], 'decimal'),
                    'obp': get_value_from_field(record[21], 'decimal'),
                    'slg': get_value_from_field(record[22], 'decimal'),
                    'ops': get_value_from_field(record[23], 'decimal'),
                    'doubles': get_value_from_field(record[24], 'long'),
                    'triples': get_value_from_field(record[25], 'long'),
                    'hit_by_pitch': get_value_from_field(record[26], 'long')
                }
            }
        }
        
        # Add pitching stats if applicable
        if record[27]:  # innings_pitched exists
            player_profile['current_season']['pitching'] = {
                'innings_pitched': get_value_from_field(record[27], 'decimal'),
                'wins': get_value_from_field(record[28], 'long'),
                'losses': get_value_from_field(record[29], 'long'),
                'saves': get_value_from_field(record[30], 'long'),
                'era': get_value_from_field(record[31], 'decimal'),
                'whip': get_value_from_field(record[32], 'decimal'),
                'strikeouts': get_value_from_field(record[33], 'long')
            }
        
        return player_profile
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching player profile: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch player profile")

# =============================================================================
# CAREER STATS
# =============================================================================

@router.get("/{player_id}/career-stats")
async def get_player_career_stats(player_id: int):
    """Get complete career year-by-year statistics"""
    try:
        sql = """
        SELECT 
            season, games_played, at_bats, hits, runs, rbi, home_runs, 
            doubles, triples, stolen_bases, walks, strikeouts, 
            batting_avg, obp, slg, ops,
            innings_pitched, wins, losses, saves, era, whip, strikeouts_pitched
        FROM player_season_stats 
        WHERE player_id = :player_id
        ORDER BY season DESC
        """
        
        response = execute_sql(
            sql,
            parameters={'player_id': player_id},
            database_name='postgres'
        )
        
        career_stats = []
        if response and response.get('records'):
            for record in response['records']:
                stat_year = {
                    'season': get_value_from_field(record[0], 'long'),
                    'games_played': get_value_from_field(record[1], 'long'),
                    'at_bats': get_value_from_field(record[2], 'long'),
                    'hits': get_value_from_field(record[3], 'long'),
                    'runs': get_value_from_field(record[4], 'long'),
                    'rbi': get_value_from_field(record[5], 'long'),
                    'home_runs': get_value_from_field(record[6], 'long'),
                    'doubles': get_value_from_field(record[7], 'long'),
                    'triples': get_value_from_field(record[8], 'long'),
                    'stolen_bases': get_value_from_field(record[9], 'long'),
                    'walks': get_value_from_field(record[10], 'long'),
                    'strikeouts': get_value_from_field(record[11], 'long'),
                    'batting_avg': get_value_from_field(record[12], 'decimal'),
                    'obp': get_value_from_field(record[13], 'decimal'),
                    'slg': get_value_from_field(record[14], 'decimal'),
                    'ops': get_value_from_field(record[15], 'decimal')
                }
                
                # Add pitching stats if present
                if record[16]:  # innings_pitched
                    stat_year['pitching'] = {
                        'innings_pitched': get_value_from_field(record[16], 'decimal'),
                        'wins': get_value_from_field(record[17], 'long'),
                        'losses': get_value_from_field(record[18], 'long'),
                        'saves': get_value_from_field(record[19], 'long'),
                        'era': get_value_from_field(record[20], 'decimal'),
                        'whip': get_value_from_field(record[21], 'decimal'),
                        'strikeouts': get_value_from_field(record[22], 'long')
                    }
                
                career_stats.append(stat_year)
        
        return {
            "player_id": player_id,
            "career_stats": career_stats,
            "total_seasons": len(career_stats)
        }
        
    except Exception as e:
        logger.error(f"Error fetching career stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch career stats")

# =============================================================================
# GAME LOGS
# =============================================================================

@router.get("/{player_id}/game-logs")
async def get_player_game_logs(
    player_id: int,
    limit: int = Query(20, ge=1, le=100),
    days: Optional[int] = Query(None, description="Filter to last N days")
):
    """Get individual game logs"""
    try:
        date_filter = ""
        params = {'player_id': player_id, 'limit': limit}
        
        if days:
            date_filter = "AND game_date >= CURRENT_DATE - INTERVAL :days DAY"
            params['days'] = days
        
        sql = f"""
        SELECT 
            game_date, opponent, home_away,
            at_bats, hits, runs, rbi, home_runs, doubles, triples,
            stolen_bases, walks, strikeouts, hit_by_pitch,
            innings_pitched, wins, losses, saves, earned_runs, 
            hits_allowed, walks_allowed, strikeouts_pitched
        FROM player_game_logs 
        WHERE player_id = :player_id 
        {date_filter}
        ORDER BY game_date DESC
        LIMIT :limit
        """
        
        response = execute_sql(sql, parameters=params, database_name='postgres')
        
        game_logs = []
        if response and response.get('records'):
            for record in response['records']:
                game = {
                    'game_date': get_value_from_field(record[0], 'string'),
                    'opponent': get_value_from_field(record[1], 'string'),
                    'home_away': get_value_from_field(record[2], 'string'),
                    'batting': {
                        'at_bats': get_value_from_field(record[3], 'long'),
                        'hits': get_value_from_field(record[4], 'long'),
                        'runs': get_value_from_field(record[5], 'long'),
                        'rbi': get_value_from_field(record[6], 'long'),
                        'home_runs': get_value_from_field(record[7], 'long'),
                        'doubles': get_value_from_field(record[8], 'long'),
                        'triples': get_value_from_field(record[9], 'long'),
                        'stolen_bases': get_value_from_field(record[10], 'long'),
                        'walks': get_value_from_field(record[11], 'long'),
                        'strikeouts': get_value_from_field(record[12], 'long'),
                        'hit_by_pitch': get_value_from_field(record[13], 'long')
                    }
                }
                
                # Add calculated fields
                if game['batting']['at_bats'] > 0:
                    game['batting']['avg'] = round(
                        game['batting']['hits'] / game['batting']['at_bats'], 3
                    )
                
                # Add pitching if applicable
                if record[14]:  # innings_pitched
                    game['pitching'] = {
                        'innings_pitched': get_value_from_field(record[14], 'decimal'),
                        'wins': get_value_from_field(record[15], 'long'),
                        'losses': get_value_from_field(record[16], 'long'),
                        'saves': get_value_from_field(record[17], 'long'),
                        'earned_runs': get_value_from_field(record[18], 'long'),
                        'hits_allowed': get_value_from_field(record[19], 'long'),
                        'walks_allowed': get_value_from_field(record[20], 'long'),
                        'strikeouts': get_value_from_field(record[21], 'long')
                    }
                    
                    # Calculate ERA for the game
                    ip = game['pitching']['innings_pitched']
                    er = game['pitching']['earned_runs']
                    if ip > 0:
                        game['pitching']['era'] = round((er * 9) / ip, 2)
                
                game_logs.append(game)
        
        return {
            "player_id": player_id,
            "game_logs": game_logs,
            "total_games": len(game_logs)
        }
        
    except Exception as e:
        logger.error(f"Error fetching game logs: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch game logs")

# =============================================================================
# PLAYER ANALYTICS
# =============================================================================

@router.get("/{player_id}/analytics")
async def get_player_analytics(player_id: int):
    """Get comprehensive player analytics"""
    try:
        # Import the PlayerAnalytics class from leagues module
        from routers.leagues.players.analytics import PlayerAnalytics
        
        analytics = PlayerAnalytics(player_id)
        return analytics.get_comprehensive_analytics()
        
    except Exception as e:
        logger.error(f"Error calculating analytics: {e}")
        raise HTTPException(status_code=500, detail="Failed to calculate analytics")

# =============================================================================
# RECENT PERFORMANCE
# =============================================================================

@router.get("/{player_id}/recent-performance")
async def get_player_recent_performance(
    player_id: int,
    days: int = Query(7, ge=1, le=30, description="Number of days to look back")
):
    """Get aggregated recent performance stats"""
    try:
        sql = """
        SELECT 
            COUNT(*) as games,
            SUM(at_bats) as at_bats,
            SUM(hits) as hits,
            SUM(runs) as runs,
            SUM(rbi) as rbi,
            SUM(home_runs) as home_runs,
            SUM(stolen_bases) as stolen_bases,
            SUM(walks) as walks,
            SUM(strikeouts) as strikeouts,
            -- Pitching
            SUM(innings_pitched) as innings_pitched,
            SUM(wins) as wins,
            SUM(losses) as losses,
            SUM(saves) as saves,
            SUM(earned_runs) as earned_runs,
            SUM(strikeouts_pitched) as strikeouts_pitched
        FROM player_game_logs
        WHERE player_id = :player_id
            AND game_date >= CURRENT_DATE - INTERVAL :days DAY
        """
        
        response = execute_sql(
            sql,
            parameters={'player_id': player_id, 'days': days},
            database_name='postgres'
        )
        
        if not response or not response.get('records'):
            return {
                "player_id": player_id,
                "days": days,
                "games": 0,
                "batting": {},
                "pitching": {}
            }
        
        record = response['records'][0]
        
        games = get_value_from_field(record[0], 'long')
        at_bats = get_value_from_field(record[1], 'long')
        hits = get_value_from_field(record[2], 'long')
        
        performance = {
            "player_id": player_id,
            "days": days,
            "games": games,
            "batting": {
                "at_bats": at_bats,
                "hits": hits,
                "runs": get_value_from_field(record[3], 'long'),
                "rbi": get_value_from_field(record[4], 'long'),
                "home_runs": get_value_from_field(record[5], 'long'),
                "stolen_bases": get_value_from_field(record[6], 'long'),
                "walks": get_value_from_field(record[7], 'long'),
                "strikeouts": get_value_from_field(record[8], 'long')
            }
        }
        
        # Calculate batting average
        if at_bats > 0:
            performance['batting']['avg'] = round(hits / at_bats, 3)
        
        # Add pitching if applicable
        innings = get_value_from_field(record[9], 'decimal')
        if innings and innings > 0:
            earned_runs = get_value_from_field(record[13], 'long')
            performance['pitching'] = {
                "innings_pitched": innings,
                "wins": get_value_from_field(record[10], 'long'),
                "losses": get_value_from_field(record[11], 'long'),
                "saves": get_value_from_field(record[12], 'long'),
                "earned_runs": earned_runs,
                "strikeouts": get_value_from_field(record[14], 'long'),
                "era": round((earned_runs * 9) / innings, 2)
            }
        
        return performance
        
    except Exception as e:
        logger.error(f"Error fetching recent performance: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch recent performance")