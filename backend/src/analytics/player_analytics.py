# backend/src/analytics/player_analytics.py
import numpy as np
from typing import Dict, List, Optional, Tuple, Union
from datetime import datetime, timedelta
import logging
from core.database import execute_sql

logger = logging.getLogger(__name__)

class PlayerAnalytics:
    """Advanced player analytics using numpy for statistical calculations"""
    
    @staticmethod
    def _extract_value(field, value_type: str = 'long') -> Union[int, float, str]:
        """Helper to safely extract values from RDS Data API response"""
        if not field or field.get('isNull'):
            return 0 if value_type != 'string' else ""
        
        if value_type == 'long':
            return field.get('longValue', 0)
        elif value_type == 'decimal':
            # Handle decimal values (can come as stringValue or doubleValue)
            if 'stringValue' in field:
                try:
                    return float(field['stringValue'])
                except (ValueError, TypeError):
                    return 0.0
            return field.get('doubleValue', 0.0)
        elif value_type == 'string':
            return field.get('stringValue', "")
        return 0
    
    @staticmethod
    def calculate_z_scores(player_stats: Dict, league_averages: Dict) -> Dict:
        """Calculate Z-scores using numpy for vectorized operations"""
        stat_categories = [
            'batting_avg', 'home_runs', 'rbi', 'runs', 'stolen_bases',
            'obp', 'slg', 'ops', 'walks', 'strikeouts'
        ]
        
        z_scores = {}
        player_values = []
        league_means = []
        league_stds = []
        valid_stats = []
        
        # Collect data for vectorized calculation
        for stat in stat_categories:
            if (stat in player_stats and 
                f'{stat}_avg' in league_averages and 
                f'{stat}_std' in league_averages):
                
                player_val = float(player_stats[stat])
                league_avg = float(league_averages[f'{stat}_avg'])
                league_std = float(league_averages[f'{stat}_std'])
                
                if league_std > 0:  # Avoid division by zero
                    player_values.append(player_val)
                    league_means.append(league_avg)
                    league_stds.append(league_std)
                    valid_stats.append(stat)
        
        if valid_stats:
            # Vectorized Z-score calculation using numpy
            player_array = np.array(player_values)
            means_array = np.array(league_means)
            stds_array = np.array(league_stds)
            
            z_score_array = np.round((player_array - means_array) / stds_array, 2)
            
            # Map back to dictionary
            for stat, z_score in zip(valid_stats, z_score_array):
                z_scores[stat] = float(z_score)
        
        return z_scores
    
    @staticmethod
    def get_league_averages(season: int, position: Optional[str] = None) -> Dict:
        """Get league averages and standard deviations with improved error handling"""
        try:
            position_filter = "AND p.position = :position" if position else ""
            
            query = f"""
                SELECT 
                    pss.batting_avg, pss.home_runs, pss.rbi, pss.runs, 
                    pss.stolen_bases, pss.obp, pss.slg, pss.ops, 
                    pss.walks, pss.strikeouts
                FROM player_season_stats pss
                JOIN mlb_players p ON pss.player_id = p.player_id
                WHERE pss.season = :season
                    AND pss.games_played >= 50
                    AND pss.at_bats >= 100
                    {position_filter}
            """
            
            params = {'season': season}
            if position:
                params['position'] = position
            
            result = execute_sql(query, parameters=params, database_name='postgres')
            
            if not result or not result.get('records'):
                logger.warning(f"No league data found for season {season}, position {position}")
                return {}
            
            # Extract all player data for numpy processing
            stat_categories = ['batting_avg', 'home_runs', 'rbi', 'runs', 'stolen_bases',
                             'obp', 'slg', 'ops', 'walks', 'strikeouts']
            
            # Build arrays for each stat category
            stat_data = {stat: [] for stat in stat_categories}
            
            for record in result['records']:
                for i, stat in enumerate(stat_categories):
                    value = PlayerAnalytics._extract_value(record[i], 'decimal' if stat in ['batting_avg', 'obp', 'slg', 'ops'] else 'long')
                    if value is not None and value > 0:  # Filter out null/zero values
                        stat_data[stat].append(value)
            
            # Calculate means and standard deviations using numpy
            league_stats = {}
            for stat, values in stat_data.items():
                if values:  # Only calculate if we have data
                    np_array = np.array(values)
                    league_stats[f'{stat}_avg'] = float(np.mean(np_array))
                    league_stats[f'{stat}_std'] = float(np.std(np_array, ddof=1))  # Sample std deviation
                    league_stats[f'{stat}_median'] = float(np.median(np_array))
                    league_stats[f'{stat}_min'] = float(np.min(np_array))
                    league_stats[f'{stat}_max'] = float(np.max(np_array))
                    league_stats[f'{stat}_count'] = len(values)
                else:
                    # Default values if no data
                    league_stats[f'{stat}_avg'] = 0.0
                    league_stats[f'{stat}_std'] = 1.0
                    league_stats[f'{stat}_median'] = 0.0
                    league_stats[f'{stat}_min'] = 0.0
                    league_stats[f'{stat}_max'] = 0.0
                    league_stats[f'{stat}_count'] = 0
            
            return league_stats
            
        except Exception as e:
            logger.error(f"Error calculating league averages: {str(e)}")
            return {}
    
    @staticmethod
    def get_monthly_splits(player_id: int, season: int) -> List[Dict]:
        """Get month-by-month performance with numpy-enhanced calculations"""
        try:
            query = """
                SELECT 
                    EXTRACT(MONTH FROM game_date) as month,
                    ARRAY_AGG(at_bats) as at_bats_array,
                    ARRAY_AGG(hits) as hits_array,
                    ARRAY_AGG(home_runs) as home_runs_array,
                    ARRAY_AGG(rbi) as rbi_array,
                    ARRAY_AGG(runs) as runs_array,
                    ARRAY_AGG(walks) as walks_array,
                    ARRAY_AGG(strikeouts) as strikeouts_array,
                    ARRAY_AGG(stolen_bases) as stolen_bases_array
                FROM player_game_logs
                WHERE player_id = :player_id 
                    AND EXTRACT(YEAR FROM game_date) = :season
                    AND at_bats > 0
                GROUP BY EXTRACT(MONTH FROM game_date)
                ORDER BY month
            """
            
            result = execute_sql(
                query,
                parameters={'player_id': player_id, 'season': season},
                database_name='postgres'
            )
            
            monthly_data = []
            if result and result.get('records'):
                for record in result['records']:
                    month = int(PlayerAnalytics._extract_value(record[0], 'long'))
                    
                    # Extract arrays and convert to numpy for calculations
                    at_bats_str = PlayerAnalytics._extract_value(record[1], 'string')
                    hits_str = PlayerAnalytics._extract_value(record[2], 'string')
                    home_runs_str = PlayerAnalytics._extract_value(record[3], 'string')
                    rbi_str = PlayerAnalytics._extract_value(record[4], 'string')
                    runs_str = PlayerAnalytics._extract_value(record[5], 'string')
                    walks_str = PlayerAnalytics._extract_value(record[6], 'string')
                    strikeouts_str = PlayerAnalytics._extract_value(record[7], 'string')
                    stolen_bases_str = PlayerAnalytics._extract_value(record[8], 'string')
                    
                    # Parse PostgreSQL arrays and convert to numpy
                    def parse_pg_array(array_str):
                        if not array_str or array_str == '{}':
                            return np.array([])
                        # Remove braces and split by comma
                        clean_str = array_str.strip('{}')
                        if not clean_str:
                            return np.array([])
                        return np.array([int(x) for x in clean_str.split(',') if x.strip()])
                    
                    at_bats_array = parse_pg_array(at_bats_str)
                    hits_array = parse_pg_array(hits_str)
                    home_runs_array = parse_pg_array(home_runs_str)
                    rbi_array = parse_pg_array(rbi_str)
                    runs_array = parse_pg_array(runs_str)
                    walks_array = parse_pg_array(walks_str)
                    strikeouts_array = parse_pg_array(strikeouts_str)
                    stolen_bases_array = parse_pg_array(stolen_bases_str)
                    
                    # Calculate totals and advanced stats using numpy
                    if len(at_bats_array) > 0:
                        total_ab = int(np.sum(at_bats_array))
                        total_hits = int(np.sum(hits_array))
                        total_hr = int(np.sum(home_runs_array))
                        total_rbi = int(np.sum(rbi_array))
                        total_runs = int(np.sum(runs_array))
                        total_walks = int(np.sum(walks_array))
                        total_k = int(np.sum(strikeouts_array))
                        total_sb = int(np.sum(stolen_bases_array))
                        
                        # Calculate rates
                        batting_avg = round(total_hits / total_ab, 3) if total_ab > 0 else 0.000
                        obp = round((total_hits + total_walks) / (total_ab + total_walks), 3) if (total_ab + total_walks) > 0 else 0.000
                        
                        # Calculate consistency using numpy (coefficient of variation)
                        if len(hits_array) > 1 and np.mean(hits_array) > 0:
                            hit_consistency = round(np.std(hits_array) / np.mean(hits_array), 3)
                        else:
                            hit_consistency = 0.000
                        
                        monthly_data.append({
                            'month': month,
                            'games': len(at_bats_array),
                            'at_bats': total_ab,
                            'hits': total_hits,
                            'home_runs': total_hr,
                            'rbi': total_rbi,
                            'runs': total_runs,
                            'walks': total_walks,
                            'strikeouts': total_k,
                            'stolen_bases': total_sb,
                            'batting_avg': batting_avg,
                            'obp': obp,
                            'consistency': hit_consistency,
                            'hr_per_game': round(total_hr / len(at_bats_array), 2) if len(at_bats_array) > 0 else 0.0
                        })
            
            return monthly_data
            
        except Exception as e:
            logger.error(f"Error getting monthly splits for player {player_id}: {str(e)}")
            return []
    
    @staticmethod
    def get_hot_cold_zones(player_id: int, days: int = 30) -> Dict:
        """Advanced hot/cold analysis using numpy statistical methods"""
        try:
            cutoff_date = datetime.now() - timedelta(days=days)
            
            query = """
                SELECT 
                    game_date,
                    at_bats,
                    hits,
                    home_runs,
                    rbi,
                    walks,
                    strikeouts
                FROM player_game_logs
                WHERE player_id = :player_id 
                    AND game_date >= :cutoff_date
                    AND at_bats > 0
                ORDER BY game_date DESC
            """
            
            result = execute_sql(
                query,
                parameters={'player_id': player_id, 'cutoff_date': cutoff_date.date().isoformat()},
                database_name='postgres'
            )
            
            if not result or not result.get('records') or len(result['records']) < 5:
                return {'status': 'insufficient_data', 'games_analyzed': 0}
            
            # Extract game-by-game data into numpy arrays
            games_data = []
            for record in result['records']:
                at_bats = PlayerAnalytics._extract_value(record[1], 'long')
                hits = PlayerAnalytics._extract_value(record[2], 'long')
                home_runs = PlayerAnalytics._extract_value(record[3], 'long')
                rbi = PlayerAnalytics._extract_value(record[4], 'long')
                walks = PlayerAnalytics._extract_value(record[5], 'long')
                strikeouts = PlayerAnalytics._extract_value(record[6], 'long')
                
                if at_bats > 0:  # Only include games with at-bats
                    game_avg = hits / at_bats
                    games_data.append({
                        'avg': game_avg,
                        'at_bats': at_bats,
                        'hits': hits,
                        'home_runs': home_runs,
                        'rbi': rbi,
                        'walks': walks,
                        'strikeouts': strikeouts
                    })
            
            if len(games_data) < 5:
                return {'status': 'insufficient_data', 'games_analyzed': len(games_data)}
            
            # Convert to numpy arrays for statistical analysis
            avg_array = np.array([g['avg'] for g in games_data])
            hr_array = np.array([g['home_runs'] for g in games_data])
            rbi_array = np.array([g['rbi'] for g in games_data])
            
            # Calculate recent performance metrics
            recent_avg = np.mean(avg_array)
            recent_std = np.std(avg_array)
            recent_trend = np.polyfit(range(len(avg_array)), avg_array, 1)[0]  # Linear trend
            
            # Get season stats for comparison
            season_query = """
                SELECT batting_avg, home_runs, rbi, games_played, at_bats
                FROM player_season_stats
                WHERE player_id = :player_id AND season = :season
            """
            
            season_result = execute_sql(
                season_query,
                parameters={'player_id': player_id, 'season': datetime.now().year},
                database_name='postgres'
            )
            
            if season_result and season_result.get('records'):
                season_record = season_result['records'][0]
                season_avg = PlayerAnalytics._extract_value(season_record[0], 'decimal')
                season_hr = PlayerAnalytics._extract_value(season_record[1], 'long')
                season_games = PlayerAnalytics._extract_value(season_record[3], 'long')
                
                # Calculate Z-score for recent performance vs season
                if season_games > 20:  # Minimum games for valid comparison
                    avg_diff = recent_avg - season_avg
                    
                    # Statistical significance test using numpy
                    if len(avg_array) >= 10:
                        # One-sample t-test equivalent
                        t_stat = (recent_avg - season_avg) / (recent_std / np.sqrt(len(avg_array)))
                        confidence = min(95, abs(t_stat) * 20)  # Approximate confidence
                    else:
                        confidence = 50
                    
                    # Determine hot/cold status
                    if avg_diff > 0.075 and recent_trend > 0:
                        status = "hot"
                        confidence = min(95, confidence + 15)
                    elif avg_diff > 0.040:
                        status = "warm"
                    elif avg_diff < -0.075 and recent_trend < 0:
                        status = "cold"
                        confidence = min(95, confidence + 15)
                    elif avg_diff < -0.040:
                        status = "cool"
                    else:
                        status = "neutral"
                    
                    return {
                        'status': status,
                        'confidence': round(confidence),
                        'games_analyzed': len(games_data),
                        'recent_avg': round(recent_avg, 3),
                        'season_avg': round(season_avg, 3),
                        'avg_difference': round(avg_diff, 3),
                        'trend_slope': round(recent_trend, 4),
                        'consistency': round(recent_std, 3),
                        'recent_hr_rate': round(np.mean(hr_array), 2),
                        'recent_rbi_rate': round(np.mean(rbi_array), 2)
                    }
            
            return {'status': 'no_season_data', 'games_analyzed': len(games_data)}
            
        except Exception as e:
            logger.error(f"Error in hot/cold analysis for player {player_id}: {str(e)}")
            return {'status': 'error', 'error': str(e)}
    
    @staticmethod
    def calculate_advanced_metrics(player_stats: Dict) -> Dict:
        """Calculate advanced sabermetric-style metrics using numpy"""
        try:
            # Extract basic stats
            at_bats = float(player_stats.get('at_bats', 0))
            hits = float(player_stats.get('hits', 0))
            doubles = float(player_stats.get('doubles', 0))
            triples = float(player_stats.get('triples', 0))
            home_runs = float(player_stats.get('home_runs', 0))
            walks = float(player_stats.get('walks', 0))
            hit_by_pitch = float(player_stats.get('hit_by_pitch', 0))
            sacrifice_flies = float(player_stats.get('sacrifice_flies', 0))
            
            if at_bats == 0:
                return {'error': 'No at-bats data'}
            
            # Calculate basic rates
            avg = hits / at_bats
            obp = (hits + walks + hit_by_pitch) / (at_bats + walks + hit_by_pitch + sacrifice_flies) if (at_bats + walks + hit_by_pitch + sacrifice_flies) > 0 else 0
            slg = (hits + doubles + (triples * 2) + (home_runs * 3)) / at_bats
            ops = obp + slg
            
            # Advanced metrics using numpy for calculations
            singles = hits - doubles - triples - home_runs
            total_bases = singles + (doubles * 2) + (triples * 3) + (home_runs * 4)
            
            # ISO (Isolated Power)
            iso = slg - avg
            
            # BABIP approximation (without strikeouts data, simplified)
            babip = (hits - home_runs) / (at_bats - home_runs) if (at_bats - home_runs) > 0 else 0
            
            # wOBA weights (2024 approximate values)
            woba_weights = np.array([0.69, 0.72, 0.88, 1.24, 1.56, 2.07])  # BB, HBP, 1B, 2B, 3B, HR
            woba_events = np.array([walks, hit_by_pitch, singles, doubles, triples, home_runs])
            woba_numerator = np.sum(woba_weights * woba_events)
            woba_denominator = at_bats + walks + hit_by_pitch + sacrifice_flies
            woba = woba_numerator / woba_denominator if woba_denominator > 0 else 0
            
            return {
                'avg': round(avg, 3),
                'obp': round(obp, 3),
                'slg': round(slg, 3),
                'ops': round(ops, 3),
                'iso': round(iso, 3),
                'babip': round(babip, 3),
                'woba': round(woba, 3),
                'total_bases': int(total_bases),
                'extra_base_hits': int(doubles + triples + home_runs),
                'power_factor': round(home_runs / at_bats * 100, 1) if at_bats > 0 else 0
            }
            
        except Exception as e:
            logger.error(f"Error calculating advanced metrics: {str(e)}")
            return {'error': str(e)}
    
    @staticmethod
    def get_percentile_rankings(player_stats: Dict, league_stats: Dict) -> Dict:
        """Calculate percentile rankings using numpy"""
        try:
            rankings = {}
            
            key_stats = ['batting_avg', 'home_runs', 'rbi', 'runs', 'ops']
            
            for stat in key_stats:
                if stat in player_stats and f'{stat}_avg' in league_stats:
                    player_value = float(player_stats[stat])
                    league_avg = float(league_stats[f'{stat}_avg'])
                    league_std = float(league_stats[f'{stat}_std'])
                    
                    if league_std > 0:
                        # Calculate Z-score and convert to percentile
                        z_score = (player_value - league_avg) / league_std
                        percentile = int(np.round(50 + (z_score * 15)))  # Approximate normal distribution
                        percentile = max(1, min(99, percentile))  # Clamp between 1-99
                        
                        rankings[stat] = {
                            'value': player_value,
                            'league_avg': league_avg,
                            'percentile': percentile,
                            'z_score': round(z_score, 2)
                        }
            
            return rankings
            
        except Exception as e:
            logger.error(f"Error calculating percentile rankings: {str(e)}")
            return {}