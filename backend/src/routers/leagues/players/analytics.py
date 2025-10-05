"""
Dynasty Dugout - Player Analytics Module
PURPOSE: Calculate comprehensive player analytics including trends, z-scores, and performance metrics
UPDATED: Added Tile 1 - 30-Day Performance Benchmarking for pitchers
"""

import logging
import statistics
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from core.database import execute_sql
from core.season_utils import CURRENT_SEASON

logger = logging.getLogger(__name__)

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
    
    # =========================================================================
    # GAME LOG TILE ANALYTICS - UPDATED WITH TILE 1
    # =========================================================================
    
    def get_pitcher_tile_analytics(self) -> Dict[str, Any]:
        """
        Get pitcher analytics for game log tiles
        Includes 30-day performance benchmarking
        """
        try:
            logger.info(f"=== Starting get_pitcher_tile_analytics for player {self.player_id}, league {self.league_id} ===")
            
            # Try to get performance_30d with detailed logging
            try:
                logger.info("Fetching performance_30d...")
                performance_30d = self._get_pitcher_performance_30d()
                logger.info(f"performance_30d result keys: {performance_30d.keys() if performance_30d else 'None'}")
                if 'error' in performance_30d:
                    logger.error(f"performance_30d returned error: {performance_30d['error']}")
            except Exception as e:
                logger.error(f"ERROR in _get_pitcher_performance_30d: {str(e)}", exc_info=True)
                performance_30d = {"error": str(e)}
            
            # For now, return empty dicts for other tiles
            trend_vs_starters = {}
            quality_start_rate = {}
            command_metrics = {}
            
            result = {
                "performance_30d": performance_30d,
                "trend_vs_starters": trend_vs_starters,
                "quality_start_rate": quality_start_rate,
                "command_metrics": command_metrics
            }
            
            logger.info(f"=== Returning pitcher tile analytics with keys: {result.keys()} ===")
            return result
            
        except Exception as e:
            logger.error(f"CRITICAL ERROR in get_pitcher_tile_analytics: {str(e)}", exc_info=True)
            return {
                "performance_30d": {"error": str(e)},
                "trend_vs_starters": {},
                "quality_start_rate": {},
                "command_metrics": {}
            }
    def get_hitter_tile_analytics(self) -> Dict[str, Any]:
        """Get hitter analytics for game log tiles"""
        try:
            logger.info(f"=== Starting get_hitter_tile_analytics for player {self.player_id}, league {self.league_id} ===")
            
            # Return empty structure for now
            result = {
                "batting_trend": {},
                "power_metrics": {},
                "clutch_performance": {},
                "streak_indicator": {}
            }
            
            logger.info(f"=== Returning hitter tile analytics ===")
            return result
            
        except Exception as e:
            logger.error(f"Error in get_hitter_tile_analytics: {str(e)}", exc_info=True)
            return {
                "batting_trend": {"error": str(e)},
                "power_metrics": {"error": str(e)},
                "clutch_performance": {"error": str(e)},
                "streak_indicator": {"error": str(e)}
            }
    
    # =========================================================================
    # TILE 1: 30-DAY PERFORMANCE BENCHMARKING
    # =========================================================================
    
    def _get_pitcher_performance_30d(self) -> Dict:
        """Tile 1: 30-day performance benchmarking (uses available data up to 30 days)"""
        try:
            logger.info(f"=== Starting _get_pitcher_performance_30d for player {self.player_id} ===")
            
            # TEMPORARY DIAGNOSTIC - REMOVE AFTER FINDING COLUMNS
            schema_query = """
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'player_game_logs'
            AND column_name IN (
                'was_starter', 'quality_starts', 'holds', 
                'saves', 'wins', 'losses', 'blown_saves',
                'innings_pitched', 'earned_runs', 'strikeouts_pitched',
                'walks_allowed', 'hits_allowed'
            )
            ORDER BY column_name
            """
            schema_result = execute_sql(schema_query, {}, 'postgres')
            logger.info(f"=== COLUMNS THAT EXIST: {schema_result} ===")
            # END DIAGNOSTIC
            data_check_query = """
            SELECT 
                COUNT(*) as total_games,
                MIN(game_date) as earliest_date,
                MAX(game_date) as latest_date,
                CURRENT_DATE - MIN(game_date) as days_covered
            FROM player_game_logs
            WHERE player_id = :player_id 
                AND innings_pitched > 0
                AND game_date >= GREATEST(
                    CURRENT_DATE - INTERVAL '30 days',
                    (SELECT MIN(game_date) FROM player_game_logs WHERE player_id = :player_id)
                )
            """
            
            logger.info(f"Running data check query for player {self.player_id}")
            data_check_result = execute_sql(data_check_query, {'player_id': self.player_id}, 'postgres')
            logger.info(f"Data check result: {data_check_result}")
            
            if not data_check_result or not data_check_result.get('records'):
                logger.error("No pitching data available - no records returned")
                return {"error": "No pitching data available"}
            
            data_record = data_check_result['records'][0]
            total_games = data_record.get('total_games') or 0
            logger.info(f"Total games found: {total_games}")
            
            if total_games == 0:
                logger.error("No pitching appearances found")
                return {"error": "No pitching appearances found"}
            
            days_covered = data_record.get('days_covered') or 30
            logger.info(f"Days covered: {days_covered}")
            
            # Use whatever data is available (up to 30 days)
            interval = f"GREATEST(CURRENT_DATE - INTERVAL '30 days', (SELECT MIN(game_date) FROM player_game_logs WHERE player_id = :player_id))"
            
            # Step 1: Determine pitcher role based on available data
            role_query = f"""
            WITH pitcher_appearances AS (
                SELECT 
                    player_id,
                    COUNT(*) FILTER (WHERE was_starter = true) as starts,
                    COUNT(*) FILTER (WHERE saves > 0) as save_opps,
                    COUNT(*) as total_appearances
                FROM player_game_logs
                WHERE player_id = :player_id 
                    AND game_date >= {interval}
                GROUP BY player_id
            )
            SELECT 
                CASE 
                    WHEN starts >= 2 THEN 'starter'
                    WHEN save_opps >= 3 THEN 'closer'
                    WHEN starts >= 1 THEN 'starter'
                    WHEN save_opps >= 1 THEN 'closer'
                    ELSE 'reliever'
                END as role,
                starts,
                save_opps,
                total_appearances
            FROM pitcher_appearances
            """
            
            logger.info("Running role determination query")
            role_result = execute_sql(role_query, {'player_id': self.player_id}, 'postgres')
            logger.info(f"Role result: {role_result}")
            
            if not role_result or not role_result.get('records'):
                role = 'reliever'  # Default to reliever
                appearances = total_games
                logger.warning(f"No role data, defaulting to reliever with {appearances} appearances")
            else:
                role_record = role_result['records'][0]
                role = role_record.get('role') or 'reliever'
                appearances = role_record.get('total_appearances') or total_games
                logger.info(f"Pitcher role: {role}, appearances: {appearances}")
            
            # Step 2: Get player's stats for available period (up to 30 days)
            player_stats_query = f"""
            SELECT 
                -- Common stats
                COUNT(*) as games,
                SUM(innings_pitched) as total_ip,
                SUM(earned_runs) as total_er,
                SUM(hits_allowed) as total_hits,
                SUM(walks_allowed) as total_walks,
                SUM(strikeouts_pitched) as total_k,
                -- Role-specific
                COUNT(*) FILTER (WHERE wins > 0 AND was_starter = true) as wins,
                COUNT(*) FILTER (WHERE quality_starts > 0) as quality_starts,
                SUM(saves) as saves,
                SUM(holds) as holds,
                -- Date range info
                MIN(game_date) as first_game,
                MAX(game_date) as last_game,
                CURRENT_DATE - MIN(game_date) as days_span
            FROM player_game_logs
            WHERE player_id = :player_id 
                AND game_date >= {interval}
            """
            
            logger.info("Running player stats query")
            player_result = execute_sql(player_stats_query, {'player_id': self.player_id}, 'postgres')
            logger.info(f"Player stats result: {player_result}")
            
            if not player_result or not player_result.get('records'):
                logger.error("Failed to get player stats - no records")
                return {"error": "Failed to get player stats"}
            
            player_record = player_result['records'][0]
            games = player_record.get('games') or 0
            total_ip = player_record.get('total_ip') or 0
            total_er = player_record.get('total_er') or 0
            total_hits = player_record.get('total_hits') or 0
            total_walks = player_record.get('total_walks') or 0
            total_k = player_record.get('total_k') or 0
            wins = player_record.get('wins') or 0
            quality_starts = player_record.get('quality_starts') or 0
            saves = player_record.get('saves') or 0
            holds = player_record.get('holds') or 0
            first_game = player_record.get('first_game')
            last_game = player_record.get('last_game')
            actual_days = player_record.get('days_span') or days_covered
            
            logger.info(f"Stats parsed - Games: {games}, IP: {total_ip}, ER: {total_er}, K: {total_k}")
            
            # Calculate rate stats
            era = (total_er * 9 / total_ip) if total_ip > 0 else 0
            whip = ((total_hits + total_walks) / total_ip) if total_ip > 0 else 0
            bb_per_9 = (total_walks * 9 / total_ip) if total_ip > 0 else 0
            k_per_9 = (total_k * 9 / total_ip) if total_ip > 0 else 0
            
            logger.info(f"Calculated rates - ERA: {era:.2f}, WHIP: {whip:.3f}, BB/9: {bb_per_9:.2f}")
            
            # Build player stats based on role
            if role == 'starter':
                player_stats = {
                    "wins": wins,
                    "era": round(era, 2),
                    "whip": round(whip, 3),
                    "strikeouts": total_k,
                    "quality_starts": quality_starts,
                    "bb_per_9": round(bb_per_9, 2)
                }
            elif role == 'closer':
                player_stats = {
                    "saves": saves,
                    "era": round(era, 2),
                    "whip": round(whip, 3),
                    "strikeouts": total_k,
                    "k_per_9": round(k_per_9, 2),
                    "bb_per_9": round(bb_per_9, 2)
                }
            else:  # reliever
                player_stats = {
                    "holds": holds,
                    "era": round(era, 2),
                    "whip": round(whip, 3),
                    "strikeouts": total_k,
                    "k_per_9": round(k_per_9, 2),
                    "bb_per_9": round(bb_per_9, 2)
                }
            
            logger.info(f"Player stats built for role {role}: {player_stats}")
            
            # Step 3: Get MLB benchmarks based on role
            logger.info(f"Getting MLB benchmarks for role: {role}")
            mlb_benchmark_stats = self._get_mlb_pitcher_benchmarks(role)
            logger.info(f"MLB benchmark result: {mlb_benchmark_stats}")
            
            # Step 4: Get league benchmarks if league_id provided
            league_benchmark_stats = None
            if self.league_id:
                logger.info(f"Getting league benchmarks for league: {self.league_id}")
                league_benchmark_stats = self._get_league_pitcher_benchmarks(role)
                logger.info(f"League benchmark result: {league_benchmark_stats}")
            
            # Step 5: Calculate comparisons
            comparisons = {
                "vs_mlb": self._calculate_pitcher_comparisons(player_stats, mlb_benchmark_stats, role)
            }
            
            if league_benchmark_stats:
                comparisons["vs_league"] = self._calculate_pitcher_comparisons(
                    player_stats, league_benchmark_stats, role
                )
            
            logger.info(f"Comparisons calculated: {comparisons}")
            
            # Build response
            response = {
                "player": {
                    "role": role,
                    "stats": player_stats,
                    "games": games,
                    "period_days": actual_days,  # Actual days of data
                    "period_label": f"Last {actual_days} days" if actual_days < 30 else "Last 30 days"
                },
                "mlb_benchmark": mlb_benchmark_stats,
                "comparisons": comparisons
            }
            
            if league_benchmark_stats:
                response["league_benchmark"] = league_benchmark_stats
            
            logger.info(f"=== Returning response with keys: {response.keys()} ===")
            return response
            
        except Exception as e:
            import traceback
            error_details = traceback.format_exc()
            logger.error(f"Error calculating 30-day performance: {e}")
            logger.error(f"Stack trace: {error_details}")
            error_msg = str(e) if str(e) else f"Unknown error at line {traceback.extract_tb(e.__traceback__)[-1].lineno}"
            return {"error": error_msg}
    
    def _get_mlb_pitcher_benchmarks(self, role: str) -> Dict:
        """Get MLB benchmark stats for pitchers by role"""
        try:
            if role == 'starter':
                # Get benchmarks for starters (min 2 starts in 30 days)
                query = """
                WITH qualified_starters AS (
                    SELECT 
                        player_id,
                        COUNT(*) FILTER (WHERE was_starter = true) as starts_30d
                    FROM player_game_logs
                    WHERE game_date >= CURRENT_DATE - INTERVAL '30 days'
                    GROUP BY player_id
                    HAVING COUNT(*) FILTER (WHERE was_starter = true) >= 2
                ),
                starter_stats AS (
                    SELECT 
                        g.player_id,
                        COUNT(*) FILTER (WHERE g.wins > 0 AND g.was_starter = true) as wins,
                        SUM(g.earned_runs) * 9.0 / NULLIF(SUM(g.innings_pitched), 0) as era,
                        (SUM(g.hits_allowed) + SUM(g.walks_allowed)) / NULLIF(SUM(g.innings_pitched), 0) as whip,
                        SUM(g.strikeouts_pitched) as strikeouts,
                        COUNT(*) FILTER (WHERE g.quality_starts > 0) as quality_starts,
                        SUM(g.walks_allowed) * 9.0 / NULLIF(SUM(g.innings_pitched), 0) as bb_per_9
                    FROM player_game_logs g
                    INNER JOIN qualified_starters q ON g.player_id = q.player_id
                    WHERE g.game_date >= CURRENT_DATE - INTERVAL '30 days'
                        AND g.was_starter = true
                    GROUP BY g.player_id
                )
                SELECT 
                    AVG(wins) as avg_wins,
                    AVG(era) as avg_era,
                    AVG(whip) as avg_whip,
                    AVG(strikeouts) as avg_strikeouts,
                    AVG(quality_starts) as avg_quality_starts,
                    AVG(bb_per_9) as avg_bb_per_9,
                    COUNT(*) as sample_size
                FROM starter_stats
                """
            elif role == 'closer':
                # Get benchmarks for closers (min 3 save opportunities)
                query = """
                WITH qualified_closers AS (
                    SELECT 
                        player_id,
                        COUNT(*) FILTER (WHERE saves > 0 OR blown_saves > 0) as save_opps
                    FROM player_game_logs
                    WHERE game_date >= CURRENT_DATE - INTERVAL '30 days'
                    GROUP BY player_id
                    HAVING COUNT(*) FILTER (WHERE saves > 0 OR blown_saves > 0) >= 3
                ),
                closer_stats AS (
                    SELECT 
                        g.player_id,
                        SUM(g.saves) as saves,
                        SUM(g.earned_runs) * 9.0 / NULLIF(SUM(g.innings_pitched), 0) as era,
                        (SUM(g.hits_allowed) + SUM(g.walks_allowed)) / NULLIF(SUM(g.innings_pitched), 0) as whip,
                        SUM(g.strikeouts_pitched) as strikeouts,
                        SUM(g.strikeouts_pitched) * 9.0 / NULLIF(SUM(g.innings_pitched), 0) as k_per_9,
                        SUM(g.walks_allowed) * 9.0 / NULLIF(SUM(g.innings_pitched), 0) as bb_per_9
                    FROM player_game_logs g
                    INNER JOIN qualified_closers q ON g.player_id = q.player_id
                    WHERE g.game_date >= CURRENT_DATE - INTERVAL '30 days'
                    GROUP BY g.player_id
                )
                SELECT 
                    AVG(saves) as avg_saves,
                    AVG(era) as avg_era,
                    AVG(whip) as avg_whip,
                    AVG(strikeouts) as avg_strikeouts,
                    AVG(k_per_9) as avg_k_per_9,
                    AVG(bb_per_9) as avg_bb_per_9,
                    COUNT(*) as sample_size
                FROM closer_stats
                """
            else:  # reliever
                # Get benchmarks for relievers
                query = """
                WITH reliever_stats AS (
                    SELECT 
                        player_id,
                        SUM(holds) as holds,
                        SUM(earned_runs) * 9.0 / NULLIF(SUM(innings_pitched), 0) as era,
                        (SUM(hits_allowed) + SUM(walks_allowed)) / NULLIF(SUM(innings_pitched), 0) as whip,
                        SUM(strikeouts_pitched) as strikeouts,
                        SUM(strikeouts_pitched) * 9.0 / NULLIF(SUM(innings_pitched), 0) as k_per_9,
                        SUM(walks_allowed) * 9.0 / NULLIF(SUM(innings_pitched), 0) as bb_per_9
                    FROM player_game_logs
                    WHERE game_date >= CURRENT_DATE - INTERVAL '30 days'
                        AND was_starter = false
                        AND innings_pitched > 0
                    GROUP BY player_id
                    HAVING COUNT(*) >= 5
                )
                SELECT 
                    AVG(holds) as avg_holds,
                    AVG(era) as avg_era,
                    AVG(whip) as avg_whip,
                    AVG(strikeouts) as avg_strikeouts,
                    AVG(k_per_9) as avg_k_per_9,
                    AVG(bb_per_9) as avg_bb_per_9,
                    COUNT(*) as sample_size
                FROM reliever_stats
                """
            
            result = execute_sql(query, {}, 'postgres')
            
            if not result or not result.get('records') or not result['records']:
                # Return default benchmarks if no data
                return self._get_default_pitcher_benchmarks(role)
            
            record = result['records'][0]
            
            if role == 'starter':
                return {
                    "stats": {
                        "wins": round(record.get('avg_wins') or 2, 1),
                        "era": round(record.get('avg_era') or 4.12, 2),
                        "whip": round(record.get('avg_whip') or 1.31, 3),
                        "strikeouts": round(record.get('avg_strikeouts') or 38, 1),
                        "quality_starts": round(record.get('avg_quality_starts') or 3, 1),
                        "bb_per_9": round(record.get('avg_bb_per_9') or 2.8, 2)
                    },
                    "sample_size": record.get('sample_size') or 0
                }
            elif role == 'closer':
                return {
                    "stats": {
                        "saves": round(record.get('avg_saves') or 3, 1),
                        "era": round(record.get('avg_era') or 3.50, 2),
                        "whip": round(record.get('avg_whip') or 1.20, 3),
                        "strikeouts": round(record.get('avg_strikeouts') or 12, 1),
                        "k_per_9": round(record.get('avg_k_per_9') or 10.5, 2),
                        "bb_per_9": round(record.get('avg_bb_per_9') or 3.0, 2)
                    },
                    "sample_size": record.get('sample_size') or 0
                }
            else:  # reliever
                return {
                    "stats": {
                        "holds": round(record.get('avg_holds') or 2, 1),
                        "era": round(record.get('avg_era') or 3.85, 2),
                        "whip": round(record.get('avg_whip') or 1.28, 3),
                        "strikeouts": round(record.get('avg_strikeouts') or 10, 1),
                        "k_per_9": round(record.get('avg_k_per_9') or 9.0, 2),
                        "bb_per_9": round(record.get('avg_bb_per_9') or 3.2, 2)
                    },
                    "sample_size": record.get('sample_size') or 0
                }
            
        except Exception as e:
            logger.error(f"Error getting MLB benchmarks: {e}")
            return self._get_default_pitcher_benchmarks(role)
    
    def _get_league_pitcher_benchmarks(self, role: str) -> Dict:
        """Get league benchmark stats for pitchers by role"""
        try:
            # First get active pitchers in the league
            roster_query = """
            SELECT DISTINCT lp.mlb_player_id
            FROM league_players lp
            WHERE lp.league_id = :league_id::uuid
                AND lp.roster_status = 'active'
            """
            
            roster_result = execute_sql(
                roster_query, 
                {'league_id': self.league_id}, 
                'leagues'
            )
            
            if not roster_result or not roster_result.get('records'):
                return None
            
            # Get pitcher IDs
            pitcher_ids = [r.get('mlb_player_id') for r in roster_result['records']]
            
            if not pitcher_ids:
                return None
            
            # Create query based on role (simplified for brevity)
            if role == 'starter':
                stats_query = """
                WITH league_starters AS (
                    SELECT 
                        player_id,
                        COUNT(*) FILTER (WHERE was_starter = true) as starts
                    FROM player_game_logs
                    WHERE player_id = ANY(:pitcher_ids)
                        AND game_date >= CURRENT_DATE - INTERVAL '30 days'
                    GROUP BY player_id
                    HAVING COUNT(*) FILTER (WHERE was_starter = true) >= 2
                ),
                starter_stats AS (
                    SELECT 
                        g.player_id,
                        COUNT(*) FILTER (WHERE g.wins > 0 AND g.was_starter = true) as wins,
                        SUM(g.earned_runs) * 9.0 / NULLIF(SUM(g.innings_pitched), 0) as era,
                        (SUM(g.hits_allowed) + SUM(g.walks_allowed)) / NULLIF(SUM(g.innings_pitched), 0) as whip,
                        SUM(g.strikeouts_pitched) as strikeouts,
                        COUNT(*) FILTER (WHERE g.quality_starts > 0) as quality_starts,
                        SUM(g.walks_allowed) * 9.0 / NULLIF(SUM(g.innings_pitched), 0) as bb_per_9
                    FROM player_game_logs g
                    INNER JOIN league_starters ls ON g.player_id = ls.player_id
                    WHERE g.game_date >= CURRENT_DATE - INTERVAL '30 days'
                        AND g.was_starter = true
                    GROUP BY g.player_id
                )
                SELECT 
                    AVG(wins) as avg_wins,
                    AVG(era) as avg_era,
                    AVG(whip) as avg_whip,
                    AVG(strikeouts) as avg_strikeouts,
                    AVG(quality_starts) as avg_quality_starts,
                    AVG(bb_per_9) as avg_bb_per_9,
                    COUNT(*) as sample_size
                FROM starter_stats
                """
                
                result = execute_sql(stats_query, {'pitcher_ids': pitcher_ids}, 'postgres')
                
                if result and result.get('records') and result['records']:
                    record = result['records'][0]
                    return {
                        "stats": {
                            "wins": round(record.get('avg_wins') or 1.8, 1),
                            "era": round(record.get('avg_era') or 4.45, 2),
                            "whip": round(record.get('avg_whip') or 1.35, 3),
                            "strikeouts": round(record.get('avg_strikeouts') or 35, 1),
                            "quality_starts": round(record.get('avg_quality_starts') or 2.8, 1),
                            "bb_per_9": round(record.get('avg_bb_per_9') or 3.1, 2)
                        },
                        "sample_size": record.get('sample_size') or 0
                    }
            
            # Similar logic for closer and reliever roles would go here
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting league benchmarks: {e}")
            return None
    
    def _calculate_pitcher_comparisons(self, player_stats: Dict, benchmark_stats: Dict, role: str) -> Dict:
        """Calculate if player is better/worse/equal to benchmark"""
        if not benchmark_stats or not benchmark_stats.get('stats'):
            return {}
        
        comparisons = {}
        benchmark = benchmark_stats['stats']
        
        # Define which stats are inverted (lower is better)
        inverted_stats = ['era', 'whip', 'bb_per_9']
        
        for stat_name, player_val in player_stats.items():
            if stat_name in benchmark:
                benchmark_val = benchmark[stat_name]
                
                # Handle None/0 values
                if player_val is None or benchmark_val is None:
                    comparisons[stat_name] = "equal"
                    continue
                
                # 5% threshold for "equal"
                threshold = benchmark_val * 0.05 if benchmark_val != 0 else 0.01
                
                if stat_name in inverted_stats:
                    # Lower is better
                    if player_val < benchmark_val - threshold:
                        comparisons[stat_name] = "better"
                    elif player_val > benchmark_val + threshold:
                        comparisons[stat_name] = "worse"
                    else:
                        comparisons[stat_name] = "equal"
                else:
                    # Higher is better
                    if player_val > benchmark_val + threshold:
                        comparisons[stat_name] = "better"
                    elif player_val < benchmark_val - threshold:
                        comparisons[stat_name] = "worse"
                    else:
                        comparisons[stat_name] = "equal"
        
        return comparisons
    
    def _get_default_pitcher_benchmarks(self, role: str) -> Dict:
        """Return default benchmark values when no data available"""
        if role == 'starter':
            return {
                "stats": {
                    "wins": 2,
                    "era": 4.12,
                    "whip": 1.31,
                    "strikeouts": 38,
                    "quality_starts": 3,
                    "bb_per_9": 2.8
                },
                "sample_size": 0
            }
        elif role == 'closer':
            return {
                "stats": {
                    "saves": 3,
                    "era": 3.50,
                    "whip": 1.20,
                    "strikeouts": 12,
                    "k_per_9": 10.5,
                    "bb_per_9": 3.0
                },
                "sample_size": 0
            }
        else:  # reliever
            return {
                "stats": {
                    "holds": 2,
                    "era": 3.85,
                    "whip": 1.28,
                    "strikeouts": 10,
                    "k_per_9": 9.0,
                    "bb_per_9": 3.2
                },
                "sample_size": 0
            }
    
    # =========================================================================
    # PLACEHOLDER METHODS FOR OTHER TILES
    # =========================================================================
    
    def _get_pitcher_trend_vs_starters(self) -> Dict:
        """Placeholder for Tile 2"""
        return {}
    
    def _get_quality_start_metrics(self) -> Dict:
        """Placeholder for Tile 3"""
        return {}
    
    def _get_command_metrics(self) -> Dict:
        """Placeholder for Tile 4"""
        return {}
    
    # =========================================================================
    # HITTER TILE ANALYTICS METHODS
    # =========================================================================
    
    def _get_30_day_batting_trend(self) -> Dict:
        """30-day batting trend analysis"""
        try:
            query = """
            SELECT 
                -- Last 30 days
                COUNT(*) FILTER (WHERE game_date >= CURRENT_DATE - INTERVAL '30 days') as games_30,
                SUM(at_bats) FILTER (WHERE game_date >= CURRENT_DATE - INTERVAL '30 days') as ab_30,
                SUM(hits) FILTER (WHERE game_date >= CURRENT_DATE - INTERVAL '30 days') as h_30,
                SUM(walks) FILTER (WHERE game_date >= CURRENT_DATE - INTERVAL '30 days') as bb_30,
                SUM(home_runs) FILTER (WHERE game_date >= CURRENT_DATE - INTERVAL '30 days') as hr_30,
                SUM(doubles + triples) FILTER (WHERE game_date >= CURRENT_DATE - INTERVAL '30 days') as xbh_30,
                -- Season
                batting_avg, obp, slg, ops
            FROM player_game_logs
            CROSS JOIN (
                SELECT batting_avg, obp, slg, ops 
                FROM player_season_stats 
                WHERE player_id = :player_id AND season = :season
            ) season_stats
            WHERE player_game_logs.player_id = :player_id 
                AND EXTRACT(YEAR FROM game_date) = :season
            GROUP BY batting_avg, obp, slg, ops
            """
            
            result = execute_sql(query, {'player_id': self.player_id, 'season': CURRENT_SEASON}, 'postgres')
            
            if not result or not result.get('records'):
                return {}
            
            record = result['records'][0]
            games_30 = record.get('games_30') or 0
            ab_30 = record.get('ab_30') or 0
            h_30 = record.get('h_30') or 0
            bb_30 = record.get('bb_30') or 0
            hr_30 = record.get('hr_30') or 0
            xbh_30 = record.get('xbh_30') or 0
            
            avg_30 = h_30 / ab_30 if ab_30 > 0 else 0
            obp_30 = (h_30 + bb_30) / (ab_30 + bb_30) if (ab_30 + bb_30) > 0 else 0
            slg_30 = ((h_30 - xbh_30 - hr_30) + (xbh_30 * 2) + (hr_30 * 4)) / ab_30 if ab_30 > 0 else 0
            
            return {
                "last_30_days": {
                    "games": games_30,
                    "avg": round(avg_30, 3),
                    "obp": round(obp_30, 3),
                    "slg": round(slg_30, 3),
                    "ops": round(obp_30 + slg_30, 3)
                },
                "season": {
                    "avg": record.get('batting_avg'),
                    "obp": record.get('obp'),
                    "slg": record.get('slg'),
                    "ops": record.get('ops')
                },
                "trend": {
                    "avg": self._calculate_trend(avg_30, record.get('batting_avg')),
                    "ops": self._calculate_trend(obp_30 + slg_30, record.get('ops'))
                }
            }
            
        except Exception as e:
            logger.error(f"Error calculating batting trend: {e}")
            return {}
    
    def _get_power_surge_metrics(self) -> Dict:
        """Power metrics analysis"""
        try:
            query = """
            SELECT 
                -- Last 30 days
                SUM(home_runs) FILTER (WHERE game_date >= CURRENT_DATE - INTERVAL '30 days') as hr_30,
                SUM(doubles + triples) FILTER (WHERE game_date >= CURRENT_DATE - INTERVAL '30 days') as xbh_30,
                SUM(at_bats) FILTER (WHERE game_date >= CURRENT_DATE - INTERVAL '30 days') as ab_30,
                -- Last 7 days
                SUM(home_runs) FILTER (WHERE game_date >= CURRENT_DATE - INTERVAL '7 days') as hr_7,
                SUM(at_bats) FILTER (WHERE game_date >= CURRENT_DATE - INTERVAL '7 days') as ab_7,
                -- Season totals
                (SELECT home_runs FROM player_season_stats WHERE player_id = :player_id AND season = :season) as hr_season,
                (SELECT at_bats FROM player_season_stats WHERE player_id = :player_id AND season = :season) as ab_season
            FROM player_game_logs
            WHERE player_id = :player_id 
                AND EXTRACT(YEAR FROM game_date) = :season
            """
            
            result = execute_sql(query, {'player_id': self.player_id, 'season': CURRENT_SEASON}, 'postgres')
            
            if not result or not result.get('records'):
                return {}
            
            record = result['records'][0]
            hr_30 = record.get('hr_30') or 0
            xbh_30 = record.get('xbh_30') or 0
            ab_30 = record.get('ab_30') or 0
            hr_7 = record.get('hr_7') or 0
            ab_7 = record.get('ab_7') or 0
            hr_season = record.get('hr_season') or 0
            ab_season = record.get('ab_season') or 0
            
            hr_rate_30 = (hr_30 / ab_30 * 100) if ab_30 > 0 else 0
            hr_rate_7 = (hr_7 / ab_7 * 100) if ab_7 > 0 else 0
            hr_rate_season = (hr_season / ab_season * 100) if ab_season > 0 else 0
            
            # Determine if on a power surge
            surge_indicator = "🔥 HOT" if hr_7 >= 3 else "📈 WARM" if hr_7 >= 2 else "📊 NORMAL"
            
            return {
                "last_7_days": {
                    "home_runs": hr_7,
                    "hr_rate": round(hr_rate_7, 1),
                    "surge": surge_indicator
                },
                "last_30_days": {
                    "home_runs": hr_30,
                    "extra_base_hits": xbh_30 + hr_30,
                    "hr_rate": round(hr_rate_30, 1)
                },
                "season": {
                    "home_runs": hr_season,
                    "hr_rate": round(hr_rate_season, 1),
                    "pace_162": round(hr_season * 162 / (ab_season / 4), 0) if ab_season > 0 else 0
                }
            }
            
        except Exception as e:
            logger.error(f"Error calculating power metrics: {e}")
            return {}
    
    def _get_enhanced_streak_info(self) -> Dict:
        """Enhanced streak information"""
        try:
            # This extends the existing _calculate_streaks method
            base_streaks = self._calculate_streaks()
            
            # Get additional streak info
            query = """
            SELECT 
                MAX(streak_length) as longest_hit_streak,
                COUNT(*) FILTER (WHERE hits >= 2) as multi_hit_games,
                COUNT(*) FILTER (WHERE hits >= 3) as three_hit_games
            FROM (
                SELECT 
                    game_date,
                    hits,
                    SUM(CASE WHEN hits > 0 THEN 1 ELSE 0 END) 
                        OVER (ORDER BY game_date DESC) as streak_length
                FROM player_game_logs
                WHERE player_id = :player_id 
                    AND EXTRACT(YEAR FROM game_date) = :season
                    AND at_bats > 0
            ) streaks
            WHERE game_date >= CURRENT_DATE - INTERVAL '30 days'
            """
            
            result = execute_sql(query, {'player_id': self.player_id, 'season': CURRENT_SEASON}, 'postgres')
            
            enhanced = base_streaks.copy()
            
            if result and result.get('records'):
                record = result['records'][0]
                enhanced["longest_30_days"] = record.get('longest_hit_streak')
                enhanced["multi_hit_30_days"] = record.get('multi_hit_games')
                enhanced["three_hit_30_days"] = record.get('three_hit_games')
                
                # Determine streak status
                if base_streaks.get("hit_streak", 0) >= 10:
                    enhanced["status"] = "🔥 ON FIRE"
                elif base_streaks.get("hit_streak", 0) >= 5:
                    enhanced["status"] = "📈 HEATING UP"
                elif base_streaks.get("hit_streak", 0) == 0:
                    enhanced["status"] = "❄️ COLD"
                else:
                    enhanced["status"] = "📊 STEADY"
            
            return enhanced
            
        except Exception as e:
            logger.error(f"Error calculating enhanced streaks: {e}")
            return base_streaks if 'base_streaks' in locals() else {}
    
    def _get_clutch_metrics(self) -> Dict:
        """Clutch performance metrics (simplified without RISP data)"""
        try:
            # Since we don't have RISP data in game logs, we'll use late-game performance
            query = """
            SELECT 
                -- High leverage (close games, late innings) - approximation
                COUNT(*) FILTER (WHERE at_bats > 0) as total_games,
                SUM(hits) as total_hits,
                SUM(at_bats) as total_ab,
                SUM(rbi) as total_rbi,
                -- Recent clutch moments (games with 3+ RBI)
                COUNT(*) FILTER (WHERE rbi >= 3) as big_rbi_games,
                -- Walk-off potential (9th inning or later performance)
                SUM(CASE WHEN home_runs > 0 AND rbi >= 2 THEN 1 ELSE 0 END) as clutch_homers
            FROM player_game_logs
            WHERE player_id = :player_id 
                AND game_date >= CURRENT_DATE - INTERVAL '30 days'
            """
            
            result = execute_sql(query, {'player_id': self.player_id}, 'postgres')
            
            if not result or not result.get('records'):
                return {}
            
            record = result['records'][0]
            total_games = record.get('total_games') or 0
            total_hits = record.get('total_hits') or 0
            total_ab = record.get('total_ab') or 0
            total_rbi = record.get('total_rbi') or 0
            big_rbi_games = record.get('big_rbi_games') or 0
            clutch_homers = record.get('clutch_homers') or 0
            
            # Calculate clutch rating based on RBI rate and big games
            rbi_per_game = total_rbi / total_games if total_games > 0 else 0
            clutch_rating = min(100, round(
                (rbi_per_game * 30) + (big_rbi_games * 10) + (clutch_homers * 15)
            ))
            
            return {
                "clutch_rating": clutch_rating,
                "clutch_grade": self._get_grade(clutch_rating),
                "last_30_days": {
                    "rbi": total_rbi,
                    "rbi_per_game": round(rbi_per_game, 2),
                    "big_rbi_games": big_rbi_games,
                    "clutch_homers": clutch_homers
                },
                "description": self._get_clutch_description(clutch_rating)
            }
            
        except Exception as e:
            logger.error(f"Error calculating clutch metrics: {e}")
            return {}
    
    # =========================================================================
    # EXISTING COMPREHENSIVE ANALYTICS METHODS (UNCHANGED)
    # =========================================================================
    
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
            
            # Extract values (already plain Python types)
            recent_avg = recent.get('avg')
            recent_games = recent.get('games')
            recent_hr = recent.get('hr')
            recent_ab = recent.get('ab')
            
            season_avg = season.get('batting_avg')
            season_hr = season.get('home_runs')
            season_ab = season.get('at_bats')
            
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
                    "ops": season.get('ops'),
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
            if league.get('std_ba') and league.get('std_ba') > 0:
                z_scores['batting_avg'] = round(
                    (player.get('batting_avg') - league.get('avg_ba')) / 
                    league.get('std_ba'), 2
                )
            
            # OPS
            if league.get('std_ops') and league.get('std_ops') > 0:
                z_scores['ops'] = round(
                    (player.get('ops') - league.get('avg_ops')) / 
                    league.get('std_ops'), 2
                )
            
            # Home runs
            if league.get('std_hr') and league.get('std_hr') > 0:
                z_scores['home_runs'] = round(
                    (player.get('home_runs') - league.get('avg_hr')) / 
                    league.get('std_hr'), 2
                )
            
            # RBI
            if league.get('std_rbi') and league.get('std_rbi') > 0:
                z_scores['rbi'] = round(
                    (player.get('rbi') - league.get('avg_rbi')) / 
                    league.get('std_rbi'), 2
                )
            
            # Stolen bases
            if league.get('std_sb') and league.get('std_sb') > 0:
                z_scores['stolen_bases'] = round(
                    (player.get('stolen_bases') - league.get('avg_sb')) / 
                    league.get('std_sb'), 2
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
            
            position = pos_result['records'][0].get('position')
            
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
                        'rank': record.get('rank'),
                        'player_id': record.get('player_id'),
                        'name': record.get('name'),
                        'batting_avg': record.get('batting_avg'),
                        'ops': record.get('ops'),
                        'home_runs': record.get('home_runs'),
                        'rbi': record.get('rbi'),
                        'stolen_bases': record.get('stolen_bases'),
                        'runs': record.get('runs')
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
                    obp = record.get('obp') or 0
                    slg = record.get('slg') or 0
                    monthly_splits.append({
                        'month': int(record.get('month') or 0),
                        'games': record.get('games'),
                        'at_bats': record.get('ab'),
                        'hits': record.get('h'),
                        'home_runs': record.get('hr'),
                        'rbi': record.get('rbi'),
                        'runs': record.get('r'),
                        'stolen_bases': record.get('sb'),
                        'batting_avg': round(record.get('avg') or 0, 3),
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
                hits = record.get('hits')
                at_bats = record.get('at_bats')
                walks = record.get('walks')
                hbp = record.get('hit_by_pitch')
                
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
            
            averages = [r.get('avg') if isinstance(r, dict) else r[0] for r in result['records']]
            
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
                        'year': current.get('season'),
                        'games': current.get('games_played'),
                        'avg_change': round(
                            (current.get('batting_avg') or 0) - (previous.get('batting_avg') or 0), 3
                        ),
                        'ops_change': round(
                            (current.get('ops') or 0) - (previous.get('ops') or 0), 3
                        ),
                        'hr_change': (current.get('home_runs') or 0) - (previous.get('home_runs') or 0),
                        'rbi_change': (current.get('rbi') or 0) - (previous.get('rbi') or 0),
                        'wins': current.get('wins'),
                        'losses': current.get('losses'),
                        'era_change': round(
                            (current.get('era') or 0) - (previous.get('era') or 0), 2
                        ) if current.get('era') else None,
                        'whip_change': round(
                            (current.get('whip') or 0) - (previous.get('whip') or 0), 3
                        ) if current.get('whip') else None
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
                    'batting_avg_avg': record.get('batting_avg_avg'),
                    'obp_avg': record.get('obp_avg'),
                    'slg_avg': record.get('slg_avg'),
                    'ops_avg': record.get('ops_avg'),
                    'home_runs_avg': record.get('home_runs_avg'),
                    'rbi_avg': record.get('rbi_avg'),
                    'stolen_bases_avg': record.get('stolen_bases_avg')
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
    
    # =========================================================================
    # HELPER METHODS
    # =========================================================================
    
    def _calculate_trend(self, recent_value: float, season_value: float) -> str:
        """Calculate trend direction"""
        if recent_value > season_value * 1.1:
            return "↑ improving"
        elif recent_value < season_value * 0.9:
            return "↓ declining"
        else:
            return "→ stable"
    
    def _get_grade(self, score: float) -> str:
        """Convert numeric score to letter grade"""
        if score >= 90: return "A+"
        elif score >= 85: return "A"
        elif score >= 80: return "A-"
        elif score >= 75: return "B+"
        elif score >= 70: return "B"
        elif score >= 65: return "B-"
        elif score >= 60: return "C+"
        elif score >= 55: return "C"
        elif score >= 50: return "C-"
        elif score >= 45: return "D+"
        elif score >= 40: return "D"
        else: return "F"
    
    def _get_clutch_description(self, rating: float) -> str:
        """Get description for clutch rating"""
        if rating >= 80: return "Elite clutch performer"
        elif rating >= 65: return "Very reliable in key moments"
        elif rating >= 50: return "Solid with runners on"
        elif rating >= 35: return "Average clutch performance"
        else: return "Struggles in pressure situations"
    
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