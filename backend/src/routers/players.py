"""
Dynasty Dugout - Players Router
League-agnostic player endpoints - STANDARDIZED FIELD NAMES
UPDATED: Added team data to career stats
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
    RETURNS STANDARDIZED FIELD NAMES ONLY - INCLUDING PITCHER STATS
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
            ps.games_played,
            ps.wins,
            ps.era,
            ps.strikeouts_pitched,
            ps.saves
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
                    'first_name': get_value_from_field(record[1], 'string'),
                    'last_name': get_value_from_field(record[2], 'string'),
                    'position': get_value_from_field(record[3], 'string'),
                    'mlb_team': get_value_from_field(record[4], 'string'),
                    'jersey_number': get_value_from_field(record[5], 'long'),
                    'stats': {
                        'batting_avg': get_value_from_field(record[6], 'decimal'),
                        'home_runs': get_value_from_field(record[7], 'long'),
                        'rbi': get_value_from_field(record[8], 'long'),
                        'ops': get_value_from_field(record[9], 'decimal'),
                        'games_played': get_value_from_field(record[10], 'long'),
                        'wins': get_value_from_field(record[11], 'long'),
                        'era': get_value_from_field(record[12], 'decimal'),
                        'strikeouts': get_value_from_field(record[13], 'long'),
                        'saves': get_value_from_field(record[14], 'long')
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
# PLAYER BASIC (For quick modal display)
# =============================================================================

@router.get("/{player_id}/basic")
async def get_player_basic(player_id: int):
    """Get basic player info - STANDARDIZED FIELDS"""
    try:
        sql = """
        SELECT 
            p.player_id,
            p.first_name,
            p.last_name,
            p.position,
            p.mlb_team,
            p.jersey_number,
            p.height_inches,
            p.weight_pounds,
            p.birthdate,
            ps.games_played,
            ps.batting_avg,
            ps.home_runs,
            ps.rbi,
            ps.runs,
            ps.stolen_bases,
            ps.ops,
            ps.era,
            ps.whip,
            ps.wins,
            ps.saves,
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
        
        # ONLY RETURN STANDARDIZED FIELD NAMES
        player_basic = {
            'player_id': get_value_from_field(record[0], 'long'),
            'first_name': get_value_from_field(record[1], 'string'),
            'last_name': get_value_from_field(record[2], 'string'),
            'position': get_value_from_field(record[3], 'string'),
            'mlb_team': get_value_from_field(record[4], 'string'),
            'jersey_number': get_value_from_field(record[5], 'long'),
            'height_inches': get_value_from_field(record[6], 'long'),
            'weight_pounds': get_value_from_field(record[7], 'long'),
            'birthdate': get_value_from_field(record[8], 'string'),
            'season_stats': {
                'games_played': get_value_from_field(record[9], 'long'),
                'batting_avg': get_value_from_field(record[10], 'decimal'),
                'home_runs': get_value_from_field(record[11], 'long'),
                'rbi': get_value_from_field(record[12], 'long'),
                'runs': get_value_from_field(record[13], 'long'),
                'stolen_bases': get_value_from_field(record[14], 'long'),
                'ops': get_value_from_field(record[15], 'decimal'),
                'era': get_value_from_field(record[16], 'decimal'),
                'whip': get_value_from_field(record[17], 'decimal'),
                'wins': get_value_from_field(record[18], 'long'),
                'saves': get_value_from_field(record[19], 'long'),
                'strikeouts_pitched': get_value_from_field(record[20], 'long')
            }
        }
        
        return player_basic
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching player basic info: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch player info")

# =============================================================================
# PLAYER COMPLETE (Full details for modal)
# =============================================================================

@router.get("/{player_id}/complete")
async def get_player_complete(player_id: int):
    """Get complete player profile - STANDARDIZED FIELDS ONLY"""
    try:
        # Get basic info and current stats
        sql = """
        SELECT 
            p.player_id,
            p.first_name,
            p.last_name,
            p.position,
            p.mlb_team,
            p.jersey_number,
            p.height_inches,
            p.weight_pounds,
            p.birthdate,
            -- Current season batting stats
            ps.games_played,
            ps.at_bats,
            ps.hits,
            ps.runs,
            ps.rbi,
            ps.home_runs,
            ps.doubles,
            ps.triples,
            ps.stolen_bases,
            ps.walks,
            ps.strikeouts,
            ps.batting_avg,
            ps.obp,
            ps.slg,
            ps.ops,
            ps.hit_by_pitch,
            -- Pitching stats
            ps.innings_pitched,
            ps.wins,
            ps.losses,
            ps.saves,
            ps.era,
            ps.whip,
            ps.strikeouts_pitched,
            ps.quality_starts,
            ps.blown_saves,
            ps.holds
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
        
        # Build complete player object - NO DUPLICATE FIELDS
        player_complete = {
            'player_id': get_value_from_field(record[0], 'long'),
            'first_name': get_value_from_field(record[1], 'string'),
            'last_name': get_value_from_field(record[2], 'string'),
            'position': get_value_from_field(record[3], 'string'),
            'mlb_team': get_value_from_field(record[4], 'string'),
            'jersey_number': get_value_from_field(record[5], 'long'),
            'height_inches': get_value_from_field(record[6], 'long'),
            'weight_pounds': get_value_from_field(record[7], 'long'),
            'birthdate': get_value_from_field(record[8], 'string'),
            'season_stats': {
                'games_played': get_value_from_field(record[9], 'long'),
                'at_bats': get_value_from_field(record[10], 'long'),
                'hits': get_value_from_field(record[11], 'long'),
                'runs': get_value_from_field(record[12], 'long'),
                'rbi': get_value_from_field(record[13], 'long'),
                'home_runs': get_value_from_field(record[14], 'long'),
                'doubles': get_value_from_field(record[15], 'long'),
                'triples': get_value_from_field(record[16], 'long'),
                'stolen_bases': get_value_from_field(record[17], 'long'),
                'walks': get_value_from_field(record[18], 'long'),
                'strikeouts': get_value_from_field(record[19], 'long'),
                'batting_avg': get_value_from_field(record[20], 'decimal'),
                'obp': get_value_from_field(record[21], 'decimal'),
                'slg': get_value_from_field(record[22], 'decimal'),
                'ops': get_value_from_field(record[23], 'decimal'),
                'hit_by_pitch': get_value_from_field(record[24], 'long')
            }
        }
        
        # Add pitching stats if applicable
        if record[25]:  # innings_pitched exists
            player_complete['season_stats']['pitching'] = {
                'innings_pitched': get_value_from_field(record[25], 'decimal'),
                'wins': get_value_from_field(record[26], 'long'),
                'losses': get_value_from_field(record[27], 'long'),
                'saves': get_value_from_field(record[28], 'long'),
                'era': get_value_from_field(record[29], 'decimal'),
                'whip': get_value_from_field(record[30], 'decimal'),
                'strikeouts_pitched': get_value_from_field(record[31], 'long'),
                'quality_starts': get_value_from_field(record[32], 'long'),
                'blown_saves': get_value_from_field(record[33], 'long'),
                'holds': get_value_from_field(record[34], 'long')
            }
        
        # Get rolling 14-day stats - FIXED TO INCLUDE ALL FIELDS
        try:
            rolling_sql = """
            SELECT 
                COUNT(*) as games,
                SUM(at_bats) as at_bats,
                SUM(hits) as hits,
                SUM(runs) as runs,
                SUM(rbi) as rbi,
                SUM(home_runs) as home_runs,
                SUM(doubles) as doubles,
                SUM(triples) as triples,
                SUM(stolen_bases) as stolen_bases,
                SUM(walks) as walks,
                SUM(strikeouts) as strikeouts,
                SUM(innings_pitched) as innings_pitched,
                SUM(earned_runs) as earned_runs,
                SUM(strikeouts_pitched) as strikeouts_pitched,
                SUM(wins) as wins,
                SUM(saves) as saves,
                SUM(quality_starts) as quality_starts,
                SUM(hits_allowed) as hits_allowed,
                SUM(walks_allowed) as walks_allowed,
                SUM(losses) as losses,
                SUM(blown_saves) as blown_saves,
                SUM(holds) as holds
            FROM player_game_logs
            WHERE player_id = :player_id
                AND game_date >= CURRENT_DATE - INTERVAL '14' DAY
            """
            
            rolling_response = execute_sql(
                rolling_sql,
                parameters={'player_id': player_id},
                database_name='postgres'
            )
            
            if rolling_response and rolling_response.get('records') and rolling_response['records']:
                rolling_record = rolling_response['records'][0]
                
                games = get_value_from_field(rolling_record[0], 'long')
                at_bats = get_value_from_field(rolling_record[1], 'long')
                hits = get_value_from_field(rolling_record[2], 'long')
                doubles = get_value_from_field(rolling_record[6], 'long')
                triples = get_value_from_field(rolling_record[7], 'long')
                home_runs = get_value_from_field(rolling_record[5], 'long')
                walks = get_value_from_field(rolling_record[9], 'long')
                innings = get_value_from_field(rolling_record[11], 'decimal')
                earned_runs = get_value_from_field(rolling_record[12], 'long')
                hits_allowed = get_value_from_field(rolling_record[17], 'long')
                walks_allowed = get_value_from_field(rolling_record[18], 'long')
                
                if games > 0:
                    player_complete['rolling_14_day'] = {
                        'games': games,
                        'at_bats': at_bats,
                        'hits': hits,
                        'runs': get_value_from_field(rolling_record[3], 'long'),
                        'rbi': get_value_from_field(rolling_record[4], 'long'),
                        'home_runs': home_runs,
                        'doubles': doubles,
                        'triples': triples,
                        'stolen_bases': get_value_from_field(rolling_record[8], 'long'),
                        'walks': walks,
                        'strikeouts': get_value_from_field(rolling_record[10], 'long'),
                        'batting_avg': round(hits / at_bats, 3) if at_bats > 0 else 0,
                        'innings_pitched': innings,
                        'earned_runs': earned_runs,
                        'era': round((earned_runs * 9) / innings, 2) if innings > 0 else 0,
                        'strikeouts_pitched': get_value_from_field(rolling_record[13], 'long'),
                        'wins': get_value_from_field(rolling_record[14], 'long'),
                        'saves': get_value_from_field(rolling_record[15], 'long'),
                        'quality_starts': get_value_from_field(rolling_record[16], 'long'),
                        'hits_allowed': hits_allowed,
                        'walks_allowed': walks_allowed,
                        'whip': round((hits_allowed + walks_allowed) / innings, 3) if innings > 0 else 0,
                        'losses': get_value_from_field(rolling_record[19], 'long'),
                        'blown_saves': get_value_from_field(rolling_record[20], 'long'),
                        'holds': get_value_from_field(rolling_record[21], 'long')
                    }
                    
                    # Calculate OBP and SLG for rolling stats
                    if at_bats > 0:
                        # OBP = (H + BB) / (AB + BB)
                        player_complete['rolling_14_day']['obp'] = round(
                            (hits + walks) / (at_bats + walks), 3
                        ) if (at_bats + walks) > 0 else 0
                        
                        # SLG = (1B + 2*2B + 3*3B + 4*HR) / AB
                        singles = hits - doubles - triples - home_runs
                        total_bases = singles + (2 * doubles) + (3 * triples) + (4 * home_runs)
                        player_complete['rolling_14_day']['slg'] = round(total_bases / at_bats, 3)
                        
                        # OPS = OBP + SLG
                        player_complete['rolling_14_day']['ops'] = round(
                            player_complete['rolling_14_day']['obp'] + 
                            player_complete['rolling_14_day']['slg'], 3
                        )
                
        except Exception as e:
            logger.error(f"Error fetching rolling stats: {e}")
            player_complete['rolling_14_day'] = None
        
        return player_complete
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching complete player profile: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch player profile")

# =============================================================================
# PLAYER PROFILE (Standard endpoint)
# =============================================================================

@router.get("/{player_id}")
async def get_player_profile(player_id: int):
    """Get player profile - just calls complete"""
    return await get_player_complete(player_id)

# =============================================================================
# CAREER STATS - UPDATED WITH TEAM DATA
# =============================================================================

@router.get("/{player_id}/career-stats")
async def get_player_career_stats(player_id: int):
    """Get career year-by-year statistics WITH TEAM DATA"""
    try:
        sql = """
        SELECT 
            season, mlb_team, games_played, games_started, at_bats, hits, runs, rbi, home_runs, 
            doubles, triples, stolen_bases, walks, strikeouts, 
            batting_avg, obp, slg, ops,
            innings_pitched, wins, losses, saves, era, whip, strikeouts_pitched, quality_starts
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
                    'year': get_value_from_field(record[0], 'long'),  # Add 'year' alias for frontend
                    'team': get_value_from_field(record[1], 'string'),  # Add team data
                    'mlb_team': get_value_from_field(record[1], 'string'),
                    'games_played': get_value_from_field(record[2], 'long'),
                    'games': get_value_from_field(record[2], 'long'),  # Alias for compatibility
                    'games_started': get_value_from_field(record[3], 'long'),
                    'at_bats': get_value_from_field(record[4], 'long'),
                    'hits': get_value_from_field(record[5], 'long'),
                    'runs': get_value_from_field(record[6], 'long'),
                    'rbi': get_value_from_field(record[7], 'long'),
                    'home_runs': get_value_from_field(record[8], 'long'),
                    'doubles': get_value_from_field(record[9], 'long'),
                    'triples': get_value_from_field(record[10], 'long'),
                    'stolen_bases': get_value_from_field(record[11], 'long'),
                    'walks': get_value_from_field(record[12], 'long'),
                    'strikeouts': get_value_from_field(record[13], 'long'),
                    'batting_avg': get_value_from_field(record[14], 'decimal'),
                    'obp': get_value_from_field(record[15], 'decimal'),
                    'slg': get_value_from_field(record[16], 'decimal'),
                    'ops': get_value_from_field(record[17], 'decimal')
                }
                
                # Add pitching stats if present
                if record[18]:  # innings_pitched
                    stat_year['pitching'] = {
                        'innings_pitched': get_value_from_field(record[18], 'decimal'),
                        'wins': get_value_from_field(record[19], 'long'),
                        'losses': get_value_from_field(record[20], 'long'),
                        'saves': get_value_from_field(record[21], 'long'),
                        'era': get_value_from_field(record[22], 'decimal'),
                        'whip': get_value_from_field(record[23], 'decimal'),
                        'strikeouts': get_value_from_field(record[24], 'long'),
                        'quality_starts': get_value_from_field(record[25], 'long')
                    }
                    
                    # Also add pitcher stats at top level for easier access
                    stat_year['innings_pitched'] = get_value_from_field(record[18], 'decimal')
                    stat_year['wins'] = get_value_from_field(record[19], 'long')
                    stat_year['losses'] = get_value_from_field(record[20], 'long')
                    stat_year['saves'] = get_value_from_field(record[21], 'long')
                    stat_year['era'] = get_value_from_field(record[22], 'decimal')
                    stat_year['whip'] = get_value_from_field(record[23], 'decimal')
                    stat_year['strikeouts_pitched'] = get_value_from_field(record[24], 'long')
                    stat_year['quality_starts'] = get_value_from_field(record[25], 'long')
                
                career_stats.append(stat_year)
        
        # Calculate career totals
        if career_stats:
            totals = {
                'season': 'Career',
                'year': 'Career',
                'team': 'Career',
                'games_played': sum(s.get('games_played', 0) for s in career_stats),
                'games': sum(s.get('games_played', 0) for s in career_stats),
                'games_started': sum(s.get('games_started', 0) for s in career_stats),
                'at_bats': sum(s.get('at_bats', 0) for s in career_stats),
                'hits': sum(s.get('hits', 0) for s in career_stats),
                'runs': sum(s.get('runs', 0) for s in career_stats),
                'rbi': sum(s.get('rbi', 0) for s in career_stats),
                'home_runs': sum(s.get('home_runs', 0) for s in career_stats),
                'doubles': sum(s.get('doubles', 0) for s in career_stats),
                'triples': sum(s.get('triples', 0) for s in career_stats),
                'stolen_bases': sum(s.get('stolen_bases', 0) for s in career_stats),
                'walks': sum(s.get('walks', 0) for s in career_stats),
                'strikeouts': sum(s.get('strikeouts', 0) for s in career_stats),
                'innings_pitched': sum(s.get('innings_pitched', 0) for s in career_stats),
                'wins': sum(s.get('wins', 0) for s in career_stats),
                'losses': sum(s.get('losses', 0) for s in career_stats),
                'saves': sum(s.get('saves', 0) for s in career_stats),
                'strikeouts_pitched': sum(s.get('strikeouts_pitched', 0) for s in career_stats),
                'quality_starts': sum(s.get('quality_starts', 0) for s in career_stats)
            }
            
            # Calculate career averages
            total_ab = totals['at_bats']
            if total_ab > 0:
                totals['batting_avg'] = round(totals['hits'] / total_ab, 3)
                singles = totals['hits'] - totals['doubles'] - totals['triples'] - totals['home_runs']
                total_bases = singles + (2 * totals['doubles']) + (3 * totals['triples']) + (4 * totals['home_runs'])
                totals['slg'] = round(total_bases / total_ab, 3)
            
            total_pa = total_ab + totals['walks']
            if total_pa > 0:
                totals['obp'] = round((totals['hits'] + totals['walks']) / total_pa, 3)
            
            if 'obp' in totals and 'slg' in totals:
                totals['ops'] = round(totals['obp'] + totals['slg'], 3)
            
            # Calculate career ERA and WHIP
            total_ip = totals['innings_pitched']
            if total_ip > 0:
                total_er = sum(s.get('earned_runs', 0) for s in career_stats if 'earned_runs' in s)
                totals['era'] = round((total_er * 9) / total_ip, 2)
                
                total_h = sum(s.get('hits_allowed', 0) for s in career_stats if 'hits_allowed' in s)
                total_bb = sum(s.get('walks_allowed', 0) for s in career_stats if 'walks_allowed' in s)
                totals['whip'] = round((total_h + total_bb) / total_ip, 3)
        
        return {
            "player_id": player_id,
            "career_stats": career_stats,
            "career_totals": totals if career_stats else None,
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