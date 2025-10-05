"""
Dynasty Dugout - Watch List Module (CANONICAL VERSION)
PURPOSE: User-global watch list with comprehensive league-specific status
FEATURE: Shows each player's ownership, roster status, price, and contract across ALL user's leagues
STRUCTURE: Uses CANONICAL player data format for consistency
"""

import logging
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional, List, Dict, Any

from core.auth_utils import get_current_user
from core.database import execute_sql
from core.season_utils import CURRENT_SEASON
from core.canonical_player import PlayerIdentifiers

logger = logging.getLogger(__name__)
router = APIRouter()

# =============================================================================
# HELPER FUNCTIONS - CANONICAL STRUCTURE
# =============================================================================

def get_user_leagues(user_id: str) -> List[Dict[str, Any]]:
    """Get all leagues the user is a member of"""
    try:
        result = execute_sql(
            """
            SELECT ul.league_id, ul.league_name
            FROM user_leagues ul
            JOIN league_memberships lm ON ul.league_id = lm.league_id
            WHERE lm.user_id = :user_id AND lm.is_active = true
            """,
            {'user_id': user_id},
            database_name='postgres'
        )
        
        if result and result.get('records'):
            return result['records']
        return []
    except Exception as e:
        logger.error(f"Error getting user leagues: {e}")
        return []

def get_player_league_status(mlb_player_id: int, league_id: str, user_id: str) -> Dict[str, Any]:
    """
    Get player's status in a specific league (CANONICAL)
    Returns league_context structure
    """
    try:
        result = execute_sql(
            """
            SELECT 
                lp.league_player_id,
                lp.availability_status,
                lp.roster_status,
                lp.roster_position,
                lp.salary,
                lp.generated_price,
                lp.manual_price_override,
                lp.contract_years,
                lp.team_id,
                lt.team_name,
                lt.manager_name,
                lt.user_id as owner_user_id
            FROM league_players lp
            LEFT JOIN league_teams lt ON lp.team_id = lt.team_id AND lp.league_id = lt.league_id
            WHERE lp.league_id = :league_id::uuid 
                AND lp.mlb_player_id = :mlb_player_id
            """,
            {
                'league_id': league_id,
                'mlb_player_id': mlb_player_id
            },
            database_name='leagues'
        )
        
        if result and result.get('records') and len(result['records']) > 0:
            record = result['records'][0]
            
            # Determine the effective price
            price = record.get('manual_price_override') or record.get('salary') or record.get('generated_price') or 0.0
            
            # Determine status
            is_owned = record.get('availability_status') == 'owned'
            is_user_team = record.get('owner_user_id') == user_id
            
            if is_owned:
                status = 'owned' if is_user_team else 'other_team'
            else:
                status = 'available'
            
            return {
                'league_id': league_id,
                'status': status,
                'team': {
                    'team_id': record.get('team_id'),
                    'team_name': record.get('team_name'),
                    'owner_name': record.get('manager_name'),
                    'is_user_team': is_user_team
                } if is_owned else None,
                'roster': {
                    'status': record.get('roster_status'),
                    'position': record.get('roster_position')
                } if is_owned else None,
                'financial': {
                    'contract_salary': float(price) if price else 0.0,
                    'contract_years': record.get('contract_years')
                }
            }
        else:
            # Player not in this league
            return {
                'league_id': league_id,
                'status': 'not_in_league',
                'team': None,
                'roster': None,
                'financial': None
            }
    except Exception as e:
        logger.error(f"Error getting player league status: {e}")
        return {
            'league_id': league_id,
            'status': 'error',
            'team': None,
            'roster': None,
            'financial': None,
            'error': str(e)
        }

# =============================================================================
# WATCHLIST ENDPOINTS
# =============================================================================

@router.post("/add")
async def add_to_watchlist(
    player_id: int,
    notes: Optional[str] = None,
    priority: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Add a player to user's watch list"""
    try:
        user_id = current_user.get('sub')
        
        # Check if already watched
        check = execute_sql(
            """
            SELECT watch_id FROM user_watchlist 
            WHERE user_id = :user_id AND player_id = :player_id
            """,
            {
                "user_id": user_id,
                "player_id": player_id
            },
            database_name='postgres'
        )
        
        if check.get('records'):
            return {
                "success": False,
                "message": "Player already on watch list"
            }
        
        # Get player info for confirmation (CANONICAL structure)
        player_info = execute_sql(
            """
            SELECT 
                player_id as mlb_id,
                first_name, 
                last_name, 
                position, 
                mlb_team
            FROM mlb_players 
            WHERE player_id = :player_id
            """,
            {"player_id": player_id},
            database_name='postgres'
        )
        
        if not player_info.get('records'):
            raise HTTPException(status_code=404, detail="Player not found")
        
        player = player_info['records'][0]
        
        # Add to watchlist
        execute_sql(
            """
            INSERT INTO user_watchlist (user_id, player_id, notes, priority)
            VALUES (:user_id, :player_id, :notes, :priority)
            """,
            {
                "user_id": user_id,
                "player_id": player_id,
                "notes": notes,
                "priority": priority
            },
            database_name='postgres'
        )
        
        logger.info(f"User {user_id} added {player['first_name']} {player['last_name']} to watchlist")
        
        return {
            "success": True,
            "message": f"Added {player['first_name']} {player['last_name']} to watch list"
        }
        
    except Exception as e:
        logger.error(f"Error adding to watchlist: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/remove/{player_id}")
async def remove_from_watchlist(
    player_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Remove a player from user's watch list"""
    try:
        user_id = current_user.get('sub')
        
        result = execute_sql(
            """
            DELETE FROM user_watchlist 
            WHERE user_id = :user_id AND player_id = :player_id
            RETURNING player_id
            """,
            {
                "user_id": user_id,
                "player_id": player_id
            },
            database_name='postgres'
        )
        
        if not result.get('records'):
            raise HTTPException(status_code=404, detail="Player not on watch list")
        
        logger.info(f"User {user_id} removed player {player_id} from watchlist")
        
        return {
            "success": True,
            "message": "Player removed from watch list"
        }
        
    except Exception as e:
        logger.error(f"Error removing from watchlist: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("")
async def get_watchlist(
    position_filter: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Get user's complete watch list with comprehensive league-specific status
    RETURNS CANONICAL STRUCTURE
    
    Returns:
    - Player info in canonical format
    - Season stats and 14-day rolling stats
    - league_contexts array showing status in EVERY league the user is a member of
    """
    try:
        user_id = current_user.get('sub')
        
        # Build query with optional position filter
        where_clause = "WHERE w.user_id = :user_id"
        params = {"user_id": user_id}
        
        if position_filter:
            where_clause += " AND p.position = :position"
            params["position"] = position_filter
        
        # Get watched players with their basic info and stats (CANONICAL)
        result = execute_sql(
            f"""
            SELECT 
                w.watch_id,
                w.player_id as mlb_id,
                w.added_at,
                w.notes,
                w.priority,
                
                -- Player info (canonical: goes in 'info' object)
                p.first_name,
                p.last_name,
                p.position,
                p.mlb_team,
                p.is_active,
                p.height_inches,
                p.weight_pounds,
                p.birthdate,
                
                -- Season stats (canonical: goes in 'stats.season' object)
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
                pss.holds
            FROM user_watchlist w
            JOIN mlb_players p ON w.player_id = p.player_id
            LEFT JOIN player_season_stats pss ON p.player_id = pss.player_id 
                AND pss.season = {CURRENT_SEASON}
            {where_clause}
            ORDER BY w.priority DESC, w.added_at DESC
            """,
            params,
            database_name='postgres'
        )
        
        players = []
        
        if result.get('records'):
            # Get user's leagues once
            user_leagues = get_user_leagues(user_id)
            
            for record in result['records']:
                mlb_id = record.get('mlb_id')
                
                # Get 14-day rolling stats from main DB
                rolling_result = execute_sql(
                    """
                    SELECT 
                        games_played,
                        at_bats,
                        hits,
                        home_runs,
                        rbi,
                        runs,
                        stolen_bases,
                        batting_avg,
                        obp,
                        slg,
                        ops,
                        innings_pitched,
                        wins,
                        losses,
                        saves,
                        quality_starts,
                        era,
                        whip
                    FROM player_rolling_stats
                    WHERE player_id = :player_id
                        AND period = 'last_14_days'
                        AND as_of_date = CURRENT_DATE
                    """,
                    {'player_id': mlb_id},
                    database_name='postgres'
                )
                
                rolling_stats = None
                if rolling_result.get('records') and len(rolling_result['records']) > 0:
                    rolling_record = rolling_result['records'][0]
                    rolling_stats = {
                        'games_played': rolling_record.get('games_played'),
                        'at_bats': rolling_record.get('at_bats'),
                        'hits': rolling_record.get('hits'),
                        'home_runs': rolling_record.get('home_runs'),
                        'rbi': rolling_record.get('rbi'),
                        'runs': rolling_record.get('runs'),
                        'stolen_bases': rolling_record.get('stolen_bases'),
                        'batting_avg': float(rolling_record['batting_avg']) if rolling_record.get('batting_avg') else None,
                        'obp': float(rolling_record['obp']) if rolling_record.get('obp') else None,
                        'slg': float(rolling_record['slg']) if rolling_record.get('slg') else None,
                        'ops': float(rolling_record['ops']) if rolling_record.get('ops') else None,
                        'innings_pitched': float(rolling_record['innings_pitched']) if rolling_record.get('innings_pitched') else None,
                        'wins': rolling_record.get('wins'),
                        'losses': rolling_record.get('losses'),
                        'saves': rolling_record.get('saves'),
                        'quality_starts': rolling_record.get('quality_starts'),
                        'era': float(rolling_record['era']) if rolling_record.get('era') else None,
                        'whip': float(rolling_record['whip']) if rolling_record.get('whip') else None
                    }
                
                # Get league-specific status for this player across ALL user's leagues
                league_contexts = []
                for league in user_leagues:
                    league_id = league.get('league_id')
                    league_name = league.get('league_name')
                    
                    league_context = get_player_league_status(mlb_id, league_id, user_id)
                    league_context['league_name'] = league_name
                    
                    league_contexts.append(league_context)
                
                # Build CANONICAL player object
                player = {
                    # Watch list specific fields
                    'watch_id': record.get('watch_id'),
                    'added_at': str(record.get('added_at')) if record.get('added_at') else None,
                    'notes': record.get('notes'),
                    'priority': record.get('priority'),
                    
                    # CANONICAL STRUCTURE
                    'ids': {
                        'mlb': mlb_id
                    },
                    'info': {
                        'first_name': record.get('first_name'),
                        'last_name': record.get('last_name'),
                        'full_name': f"{record.get('first_name')} {record.get('last_name')}",
                        'position': record.get('position'),
                        'mlb_team': record.get('mlb_team'),
                        'active': record.get('is_active'),
                        'height_inches': record.get('height_inches'),
                        'weight_pounds': record.get('weight_pounds'),
                        'birthdate': str(record.get('birthdate')) if record.get('birthdate') else None
                    },
                    'stats': {
                        'season': {
                            'games_played': record.get('games_played'),
                            'at_bats': record.get('at_bats'),
                            'runs': record.get('runs'),
                            'hits': record.get('hits'),
                            'doubles': record.get('doubles'),
                            'triples': record.get('triples'),
                            'home_runs': record.get('home_runs'),
                            'rbi': record.get('rbi'),
                            'stolen_bases': record.get('stolen_bases'),
                            'caught_stealing': record.get('caught_stealing'),
                            'walks': record.get('walks'),
                            'strikeouts': record.get('strikeouts'),
                            'batting_avg': float(record['batting_avg']) if record.get('batting_avg') else None,
                            'obp': float(record['obp']) if record.get('obp') else None,
                            'slg': float(record['slg']) if record.get('slg') else None,
                            'ops': float(record['ops']) if record.get('ops') else None,
                            'games_started': record.get('games_started'),
                            'wins': record.get('wins'),
                            'losses': record.get('losses'),
                            'saves': record.get('saves'),
                            'innings_pitched': float(record['innings_pitched']) if record.get('innings_pitched') else None,
                            'hits_allowed': record.get('hits_allowed'),
                            'earned_runs': record.get('earned_runs'),
                            'walks_allowed': record.get('walks_allowed'),
                            'strikeouts_pitched': record.get('strikeouts_pitched'),
                            'era': float(record['era']) if record.get('era') else None,
                            'whip': float(record['whip']) if record.get('whip') else None,
                            'quality_starts': record.get('quality_starts'),
                            'blown_saves': record.get('blown_saves'),
                            'holds': record.get('holds')
                        },
                        'rolling_14_day': rolling_stats
                    },
                    # Multi-league status (canonical: league_contexts array)
                    'league_contexts': league_contexts
                }
                
                players.append(player)
        
        return {
            "success": True,
            "count": len(players),
            "players": players,
            "current_season": CURRENT_SEASON,
            "note": "Players in CANONICAL structure - use player.ids.mlb, player.info.*, player.stats.*, player.league_contexts[]"
        }
        
    except Exception as e:
        logger.error(f"Error fetching watchlist: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/player/{player_id}/status")
async def check_watchlist_status(
    player_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Check if a player is on user's watch list"""
    try:
        user_id = current_user.get('sub')
        
        result = execute_sql(
            """
            SELECT watch_id, notes, priority FROM user_watchlist 
            WHERE user_id = :user_id AND player_id = :player_id
            """,
            {
                "user_id": user_id,
                "player_id": player_id
            },
            database_name='postgres'
        )
        
        is_watched = len(result.get('records', [])) > 0
        watch_data = None
        
        if is_watched:
            record = result['records'][0]
            watch_data = {
                'watch_id': record.get('watch_id'),
                'notes': record.get('notes'),
                'priority': record.get('priority')
            }
        
        return {
            "success": True,
            "is_watched": is_watched,
            "watch_data": watch_data
        }
        
    except Exception as e:
        logger.error(f"Error checking watchlist status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/update/{player_id}")
async def update_watchlist_entry(
    player_id: int,
    notes: Optional[str] = None,
    priority: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """Update notes or priority for a watched player"""
    try:
        user_id = current_user.get('sub')
        
        # Build update query dynamically
        updates = []
        params = {"user_id": user_id, "player_id": player_id}
        
        if notes is not None:
            updates.append("notes = :notes")
            params["notes"] = notes
        
        if priority is not None:
            updates.append("priority = :priority")
            params["priority"] = priority
        
        if not updates:
            raise HTTPException(status_code=400, detail="No updates provided")
        
        update_clause = ", ".join(updates)
        
        result = execute_sql(
            f"""
            UPDATE user_watchlist 
            SET {update_clause}
            WHERE user_id = :user_id AND player_id = :player_id
            RETURNING player_id
            """,
            params,
            database_name='postgres'
        )
        
        if not result.get('records'):
            raise HTTPException(status_code=404, detail="Player not on watch list")
        
        return {
            "success": True,
            "message": "Watch list entry updated"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating watchlist entry: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/summary")
async def get_watchlist_summary(
    current_user: dict = Depends(get_current_user)
):
    """Get quick summary stats about user's watch list"""
    try:
        user_id = current_user.get('sub')
        
        result = execute_sql(
            """
            SELECT 
                COUNT(*) as total_players,
                COUNT(CASE WHEN p.position IN ('C', '1B', '2B', '3B', 'SS', 'OF', 'DH') THEN 1 END) as hitters,
                COUNT(CASE WHEN p.position = 'P' THEN 1 END) as pitchers
            FROM user_watchlist w
            JOIN mlb_players p ON w.player_id = p.player_id
            WHERE w.user_id = :user_id
            """,
            {"user_id": user_id},
            database_name='postgres'
        )
        
        summary = {
            'total_players': 0,
            'hitters': 0,
            'pitchers': 0
        }
        
        if result.get('records') and len(result['records']) > 0:
            record = result['records'][0]
            summary = {
                'total_players': record.get('total_players', 0),
                'hitters': record.get('hitters', 0),
                'pitchers': record.get('pitchers', 0)
            }
        
        return {
            "success": True,
            "summary": summary
        }
        
    except Exception as e:
        logger.error(f"Error getting watchlist summary: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
