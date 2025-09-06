"""
Dynasty Dugout - Player Analytics Module
PURPOSE: Calculate comprehensive player analytics including trends, z-scores, and performance metrics
"""

import logging
import statistics
from typing import Dict, Any, List, Optional
from core.database import execute_sql
from core.season_utils import CURRENT_SEASON
from .utils import get_decimal_value, get_long_value, get_string_value

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
            recent_avg = get_decimal_value(recent[5])
            recent_games = get_long_value(recent[0])
            recent_hr = get_long_value(recent[3])
            recent_ab = get_long_value(recent[1])
            
            season_avg = get_decimal_value(season[0])
            season_hr = get_long_value(season[4])
            season_ab = get_long_value(season[7])
            
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
                    "ops": get_decimal_value(season[3]),
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
            if league[1] and get_decimal_value(league[1]) > 0:
                z_scores['batting_avg'] = round(
                    (get_decimal_value(player[0]) - get_decimal_value(league[0])) / 
                    get_decimal_value(league[1]), 2
                )
            
            # OPS
            if league[3] and get_decimal_value(league[3]) > 0:
                z_scores['ops'] = round(
                    (get_decimal_value(player[3]) - get_decimal_value(league[2])) / 
                    get_decimal_value(league[3]), 2
                )
            
            # Home runs
            if league[5] and get_decimal_value(league[5]) > 0:
                z_scores['home_runs'] = round(
                    (get_long_value(player[4]) - get_decimal_value(league[4])) / 
                    get_decimal_value(league[5]), 2
                )
            
            # RBI
            if league[7] and get_decimal_value(league[7]) > 0:
                z_scores['rbi'] = round(
                    (get_long_value(player[5]) - get_decimal_value(league[6])) / 
                    get_decimal_value(league[7]), 2
                )
            
            # Stolen bases
            if league[9] and get_decimal_value(league[9]) > 0:
                z_scores['stolen_bases'] = round(
                    (get_long_value(player[7]) - get_decimal_value(league[8])) / 
                    get_decimal_value(league[9]), 2
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
            
            position = get_string_value(pos_result['records'][0][0])
            
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
                        'rank': get_long_value(record[8]),
                        'player_id': get_long_value(record[0]),
                        'name': get_string_value(record[1]),
                        'batting_avg': get_decimal_value(record[2]),
                        'ops': get_decimal_value(record[3]),
                        'home_runs': get_long_value(record[4]),
                        'rbi': get_long_value(record[5]),
                        'stolen_bases': get_long_value(record[6]),
                        'runs': get_long_value(record[7])
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
                    obp = get_decimal_value(record[9])
                    slg = get_decimal_value(record[10])
                    monthly_splits.append({
                        'month': int(get_decimal_value(record[0])),
                        'games': get_long_value(record[1]),
                        'at_bats': get_long_value(record[2]),
                        'hits': get_long_value(record[3]),
                        'home_runs': get_long_value(record[4]),
                        'rbi': get_long_value(record[5]),
                        'runs': get_long_value(record[6]),
                        'stolen_bases': get_long_value(record[7]),
                        'batting_avg': round(get_decimal_value(record[8]), 3),
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
                hits = get_long_value(record[1])
                at_bats = get_long_value(record[2])
                walks = get_long_value(record[3])
                hbp = get_long_value(record[4])
                
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
            
            averages = [get_decimal_value(r[0]) for r in result['records']]
            
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
                        'year': get_long_value(current[0]),
                        'games': get_long_value(current[1]),
                        'avg_change': round(
                            get_decimal_value(current[2]) - get_decimal_value(previous[2]), 3
                        ),
                        'ops_change': round(
                            get_decimal_value(current[3]) - get_decimal_value(previous[3]), 3
                        ),
                        'hr_change': get_long_value(current[4]) - get_long_value(previous[4]),
                        'rbi_change': get_long_value(current[5]) - get_long_value(previous[5]),
                        'wins': get_long_value(current[7]),
                        'losses': get_long_value(current[8]),
                        'era_change': round(
                            get_decimal_value(current[9]) - get_decimal_value(previous[9]), 2
                        ) if current[9] else None,
                        'whip_change': round(
                            get_decimal_value(current[10]) - get_decimal_value(previous[10]), 3
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
                    'batting_avg_avg': get_decimal_value(record[0]),
                    'obp_avg': get_decimal_value(record[1]),
                    'slg_avg': get_decimal_value(record[2]),
                    'ops_avg': get_decimal_value(record[3]),
                    'home_runs_avg': get_decimal_value(record[4]),
                    'rbi_avg': get_decimal_value(record[5]),
                    'stolen_bases_avg': get_decimal_value(record[6])
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