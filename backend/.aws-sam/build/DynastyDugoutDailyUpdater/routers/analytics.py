"""
Dynasty Dugout - Analytics Router
Career stats, recent performance, hot/cold analysis, and trending players
"""

import logging
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends

from core.auth_utils import get_current_user
from core.database import execute_sql, format_player_data

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/players/{player_id}/career")
async def get_player_career_stats(
    player_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get complete career year-by-year statistics for a player"""
    try:
        sql = """
        SELECT 
            season_year, league, team_abbreviation, team_name,
            games_played, at_bats, hits, runs, rbis, home_runs, doubles, triples,
            stolen_bases, walks, strikeouts, avg, obp, slg, ops,
            innings_pitched, wins, losses, saves, era, whip,
            age, is_playoff
        FROM player_career_stats 
        WHERE player_id = :player_id 
        ORDER BY season_year DESC, is_playoff ASC
        """
        
        parameters = [{'name': 'player_id', 'value': {'longValue': player_id}}]
        response = execute_sql(sql, parameters)
        
        career_stats = format_player_data(response.get('records', []), response)
        
        return {
            "player_id": player_id,
            "career_stats": career_stats,
            "total_seasons": len(career_stats)
        }
        
    except Exception as e:
        logger.error(f"Error fetching career stats: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch career stats")

@router.get("/players/{player_id}/recent-performance")
async def get_player_recent_performance(
    player_id: int,
    days: int = 28,
    current_user: dict = Depends(get_current_user)
):
    """Get recent performance based on individual game logs"""
    try:
        # Get recent games
        sql = """
        SELECT 
            game_date, team_abbreviation, opponent_abbreviation, home_away,
            games_played, at_bats, hits, runs, rbis, home_runs, doubles, 
            stolen_bases, walks, strikeouts,
            innings_pitched, wins, losses, saves, earned_runs, 
            hits_allowed, walks_allowed, strikeouts_pitched
        FROM player_game_logs 
        WHERE player_id = :player_id 
        AND game_date >= CURRENT_DATE - :days * INTERVAL '1 day'
        ORDER BY game_date DESC
        LIMIT 20
        """
        
        parameters = [
            {'name': 'player_id', 'value': {'longValue': player_id}},
            {'name': 'days', 'value': {'longValue': days}}
        ]
        response = execute_sql(sql, parameters)
        
        recent_games = format_player_data(response.get('records', []), response)
        
        # Calculate aggregated recent stats
        if recent_games:
            # Determine if pitcher or hitter based on stats
            is_pitcher = any(float(game.get('innings_pitched', 0)) > 0 for game in recent_games)
            
            if is_pitcher:
                # Aggregate pitching stats
                total_games = len(recent_games)
                total_innings = sum(float(game.get('innings_pitched', 0)) for game in recent_games)
                total_earned_runs = sum(int(game.get('earned_runs', 0)) for game in recent_games)
                total_wins = sum(int(game.get('wins', 0)) for game in recent_games)
                total_losses = sum(int(game.get('losses', 0)) for game in recent_games)
                total_saves = sum(int(game.get('saves', 0)) for game in recent_games)
                total_strikeouts = sum(int(game.get('strikeouts_pitched', 0)) for game in recent_games)
                total_hits_allowed = sum(int(game.get('hits_allowed', 0)) for game in recent_games)
                total_walks_allowed = sum(int(game.get('walks_allowed', 0)) for game in recent_games)
                
                era = (total_earned_runs * 9 / total_innings) if float(total_innings) > 0 else 0
                whip = ((total_hits_allowed + total_walks_allowed) / total_innings) if float(total_innings) > 0 else 0
                
                aggregated_stats = {
                    "type": "pitching",
                    "games": total_games,
                    "innings_pitched": round(total_innings, 1),
                    "era": round(era, 2),
                    "whip": round(whip, 2),
                    "wins": total_wins,
                    "losses": total_losses,
                    "saves": total_saves,
                    "strikeouts": total_strikeouts
                }
            else:
                # Aggregate hitting stats
                total_games = len(recent_games)
                total_at_bats = sum(int(game.get('at_bats', 0)) for game in recent_games)
                total_hits = sum(int(game.get('hits', 0)) for game in recent_games)
                total_runs = sum(int(game.get('runs', 0)) for game in recent_games)
                total_rbis = sum(int(game.get('rbis', 0)) for game in recent_games)
                total_home_runs = sum(int(game.get('home_runs', 0)) for game in recent_games)
                total_doubles = sum(int(game.get('doubles', 0)) for game in recent_games)
                total_stolen_bases = sum(int(game.get('stolen_bases', 0)) for game in recent_games)
                total_walks = sum(int(game.get('walks', 0)) for game in recent_games)
                total_strikeouts = sum(int(game.get('strikeouts', 0)) for game in recent_games)
                
                avg = (total_hits / total_at_bats) if int(total_at_bats) > 0 else 0
                obp = ((total_hits + total_walks) / (total_at_bats + total_walks)) if int(total_at_bats + total_walks) > 0 else 0
                
                aggregated_stats = {
                    "type": "hitting",
                    "games": total_games,
                    "at_bats": total_at_bats,
                    "hits": total_hits,
                    "avg": round(avg, 3),
                    "obp": round(obp, 3),
                    "runs": total_runs,
                    "rbis": total_rbis,
                    "home_runs": total_home_runs,
                    "doubles": total_doubles,
                    "stolen_bases": total_stolen_bases,
                    "walks": total_walks,
                    "strikeouts": total_strikeouts
                }
        else:
            aggregated_stats = {"type": "none", "games": 0}
        
        return {
            "player_id": player_id,
            "period_days": days,
            "recent_games": recent_games,
            "aggregated_stats": aggregated_stats,
            "total_games": len(recent_games)
        }
        
    except Exception as e:
        logger.error(f"Error fetching recent performance: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch recent performance")

@router.get("/players/{player_id}/hot-cold-analysis")
async def get_player_hot_cold_analysis(
    player_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Analyze if player is hot or cold based on recent vs season performance"""
    try:
        # Get last 10 games
        recent_sql = """
        SELECT 
            at_bats, hits, home_runs, rbis,
            innings_pitched, earned_runs, strikeouts_pitched
        FROM player_game_logs 
        WHERE player_id = :player_id 
        AND game_date >= CURRENT_DATE - INTERVAL '21 days'
        ORDER BY game_date DESC
        LIMIT 10
        """
        
        # Get season totals
        season_sql = """
        SELECT 
            at_bats, hits, home_runs, rbis, avg, obp, slg,
            innings_pitched, earned_runs, era, whip, strikeouts_pitched
        FROM player_stats 
        WHERE player_id = :player_id 
        AND season_year = 2025
        """
        
        parameters = [{'name': 'player_id', 'value': {'longValue': player_id}}]
        
        recent_response = execute_sql(recent_sql, parameters)
        season_response = execute_sql(season_sql, parameters)
        
        recent_games = format_player_data(recent_response.get('records', []), recent_response)
        season_stats = format_player_data(season_response.get('records', []), season_response)
        
        if not recent_games or not season_stats:
            return {"analysis": "insufficient_data"}
        
        season_stat = season_stats[0]
        
        # Determine if pitcher or hitter
        is_pitcher = float(season_stat.get('innings_pitched', 0)) > 0
        
        if is_pitcher:
            # Pitching hot/cold analysis
            recent_innings = sum(float(game.get('innings_pitched', 0)) for game in recent_games)
            recent_earned_runs = sum(int(game.get('earned_runs', 0)) for game in recent_games)
            recent_strikeouts = sum(int(game.get('strikeouts_pitched', 0)) for game in recent_games)
            
            recent_era = (recent_earned_runs * 9 / recent_innings) if float(recent_innings) > 0 else 999
            season_era = float(season_stat.get('era', 0))
            
            recent_k_per_9 = (recent_strikeouts * 9 / recent_innings) if float(recent_innings) > 0 else 0
            season_k_per_9 = (float(season_stat.get('strikeouts_pitched', 0)) * 9 / float(season_stat.get('innings_pitched', 1))) if float(season_stat.get('innings_pitched', 0)) > 0 else 0
            
            # Hot if recent ERA is significantly better and K rate is up
            era_improvement = season_era - recent_era
            k_improvement = recent_k_per_9 - season_k_per_9
            
            if era_improvement > 1.0 and k_improvement > 1.0:
                status = "hot"
                confidence = min(95, 60 + (era_improvement * 10) + (k_improvement * 5))
            elif era_improvement < -1.5 or k_improvement < -2.0:
                status = "cold"
                confidence = min(95, 60 + abs(era_improvement * 8))
            else:
                status = "neutral"
                confidence = 50
            
            analysis = {
                "status": status,
                "confidence": round(confidence),
                "type": "pitching",
                "recent_era": round(recent_era, 2),
                "season_era": round(season_era, 2),
                "era_change": round(era_improvement, 2),
                "recent_k_per_9": round(recent_k_per_9, 1),
                "season_k_per_9": round(season_k_per_9, 1),
                "games_analyzed": len(recent_games)
            }
        else:
            # Hitting hot/cold analysis
            recent_at_bats = sum(int(game.get('at_bats', 0)) for game in recent_games)
            recent_hits = sum(int(game.get('hits', 0)) for game in recent_games)
            recent_home_runs = sum(int(game.get('home_runs', 0)) for game in recent_games)
            
            recent_avg = (recent_hits / recent_at_bats) if int(recent_at_bats) > 0 else 0
            season_avg = float(season_stat.get('avg', 0))
            
            recent_hr_rate = (recent_home_runs / recent_at_bats) if int(recent_at_bats) > 0 else 0
            season_hr_rate = (float(season_stat.get('home_runs', 0)) / float(season_stat.get('at_bats', 1))) if float(season_stat.get('at_bats', 0)) > 0 else 0
            
            # Hot if recent average is significantly higher
            avg_improvement = recent_avg - season_avg
            hr_improvement = recent_hr_rate - season_hr_rate
            
            if avg_improvement > 0.05 and recent_avg > 0.25:
                status = "hot"
                confidence = min(95, 60 + (avg_improvement * 300))
            elif avg_improvement < -0.05 or recent_avg < 0.15:
                status = "cold"
                confidence = min(95, 60 + abs(avg_improvement * 200))
            else:
                status = "neutral"
                confidence = 50
            
            analysis = {
                "status": status,
                "confidence": round(confidence),
                "type": "hitting",
                "recent_avg": round(recent_avg, 3),
                "season_avg": round(season_avg, 3),
                "avg_change": round(avg_improvement, 3),
                "recent_hr_rate": round(recent_hr_rate, 3),
                "season_hr_rate": round(season_hr_rate, 3),
                "games_analyzed": len(recent_games)
            }
        
        return {
            "player_id": player_id,
            "analysis": analysis
        }
        
    except Exception as e:
        logger.error(f"Error in hot/cold analysis: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to analyze performance")

@router.get("/players/{player_id}/game-logs")
async def get_player_game_logs(
    player_id: int,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get individual game logs for detailed analysis"""
    try:
        sql = """
        SELECT 
            game_date, team_abbreviation, opponent_abbreviation, home_away,
            games_played, at_bats, hits, runs, rbis, home_runs, doubles, triples,
            stolen_bases, walks, strikeouts, hit_by_pitch,
            innings_pitched, wins, losses, saves, earned_runs, 
            hits_allowed, walks_allowed, strikeouts_pitched
        FROM player_game_logs 
        WHERE player_id = :player_id 
        ORDER BY game_date DESC
        LIMIT :limit
        """
        
        parameters = [
            {'name': 'player_id', 'value': {'longValue': player_id}},
            {'name': 'limit', 'value': {'longValue': limit}}
        ]
        response = execute_sql(sql, parameters)
        
        game_logs = format_player_data(response.get('records', []), response)
        
        # Add calculated fields for each game
        for game in game_logs:
            # Calculate single-game stats
            if int(game.get('at_bats', 0)) > 0:
                game['game_avg'] = round(int(game.get('hits', 0)) / int(game.get('at_bats', 1)), 3)
            
            if float(game.get('innings_pitched', 0)) > 0:
                ip = float(game.get('innings_pitched', 0))
                er = int(game.get('earned_runs', 0))
                game['game_era'] = round((er * 9) / ip, 2) if float(ip) > 0 else 0
        
        return {
            "player_id": player_id,
            "game_logs": game_logs,
            "total_games": len(game_logs)
        }
        
    except Exception as e:
        logger.error(f"Error fetching game logs: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch game logs")

@router.get("/players/trending")
async def get_trending_players(
    trend_type: str = "hot",  # "hot", "cold", "emerging"
    position: Optional[str] = None,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get trending players based on recent performance"""
    try:
        # Get players with significant recent performance changes
        sql = """
        WITH recent_performance AS (
            SELECT 
                p.player_id,
                p.first_name,
                p.last_name,
                p.position,
                p.mlb_team,
                COUNT(gl.game_log_id) as recent_games,
                
                -- Hitting metrics
                CASE 
                    WHEN SUM(gl.at_bats) > 0 
                    THEN SUM(gl.hits)::DECIMAL / SUM(gl.at_bats)
                    ELSE NULL 
                END as recent_avg,
                ps.avg as season_avg,
                
                -- Power metrics
                SUM(gl.home_runs) as recent_hrs,
                SUM(gl.rbis) as recent_rbis,
                
                -- Pitching metrics
                CASE 
                    WHEN SUM(gl.innings_pitched) > 0 
                    THEN (SUM(gl.earned_runs) * 9.0) / SUM(gl.innings_pitched)
                    ELSE NULL 
                END as recent_era,
                ps.era as season_era
                
            FROM mlb_players p
            LEFT JOIN player_game_logs gl ON p.player_id = gl.player_id 
                AND gl.game_date >= CURRENT_DATE - INTERVAL '14 days'
            LEFT JOIN player_stats ps ON p.player_id = ps.player_id 
                AND ps.season_year = 2025
            WHERE p.is_active = true
            AND (:position IS NULL OR p.position = :position)
            GROUP BY p.player_id, p.first_name, p.last_name, p.position, p.mlb_team, ps.avg, ps.era
            HAVING COUNT(gl.game_log_id) >= 5
        )
        SELECT 
            player_id, first_name, last_name, position, mlb_team,
            recent_games, recent_avg, season_avg,
            COALESCE(recent_avg - season_avg, 0) as avg_change,
            recent_hrs, recent_rbis,
            recent_era, season_era,
            COALESCE(season_era - recent_era, 0) as era_improvement
        FROM recent_performance
        WHERE (recent_avg IS NOT NULL AND season_avg IS NOT NULL)
           OR (recent_era IS NOT NULL AND season_era IS NOT NULL)
        ORDER BY 
            CASE 
                WHEN :trend_type = 'hot' THEN GREATEST(
                    COALESCE(recent_avg - season_avg, 0),
                    COALESCE(season_era - recent_era, 0)
                )
                WHEN :trend_type = 'cold' THEN LEAST(
                    COALESCE(recent_avg - season_avg, 0),
                    COALESCE(season_era - recent_era, 0)
                )
                ELSE COALESCE(recent_avg - season_avg, 0)
            END DESC
        LIMIT :limit
        """
        
        parameters = [
            {'name': 'position', 'value': {'stringValue': position} if position else {'isNull': True}},
            {'name': 'trend_type', 'value': {'stringValue': trend_type}},
            {'name': 'limit', 'value': {'longValue': limit}}
        ]
        
        response = execute_sql(sql, parameters)
        trending_players = format_player_data(response.get('records', []), response)
        
        return {
            "trend_type": trend_type,
            "position_filter": position,
            "trending_players": trending_players,
            "total": len(trending_players)
        }
        
    except Exception as e:
        logger.error(f"Error fetching trending players: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch trending players")

@router.get("/stats/dashboard")
async def get_stats_dashboard(
    current_user: dict = Depends(get_current_user)
):
    """Get comprehensive stats dashboard data"""
    try:
        # Database summary stats
        summary_sql = """
        SELECT 
            (SELECT COUNT(*) FROM mlb_players WHERE is_active = true) as active_players,
            (SELECT COUNT(*) FROM player_stats WHERE season_year = 2025) as players_with_stats,
            (SELECT COUNT(*) FROM player_career_stats) as career_seasons,
            (SELECT COUNT(*) FROM player_game_logs WHERE season_year = 2025) as game_logs_2025,
            (SELECT MAX(game_date) FROM player_game_logs) as latest_game_date,
            (SELECT COUNT(DISTINCT player_id) FROM player_game_logs WHERE game_date >= CURRENT_DATE - INTERVAL '7 days') as active_last_week
        """
        
        response = execute_sql(summary_sql)
        dashboard_stats = format_player_data(response.get('records', []), response)
        
        return {
            "dashboard": dashboard_stats[0] if dashboard_stats else {},
            "data_freshness": {
                "last_updated": datetime.now().isoformat(),
                "next_update": "Daily at 6:00 AM EST"
            }
        }
        
    except Exception as e:
        logger.error(f"Error fetching dashboard stats: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch dashboard stats")