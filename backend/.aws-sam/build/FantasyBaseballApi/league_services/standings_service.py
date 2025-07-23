"""
Dynasty Dugout - League Standings Service
Handles all league standings calculations for any scoring system configuration
"""

import logging
from typing import Dict, List, Any, Optional, Tuple
from decimal import Decimal, ROUND_HALF_UP
from core.database import execute_sql

logger = logging.getLogger(__name__)

class LeagueStandingsService:
    """
    Core service for calculating league standings across all scoring systems.
    Reads league configuration and applies appropriate scoring logic.
    """
    
    @staticmethod
    def get_league_config(league_id: str) -> Dict[str, Any]:
        """Get league configuration including scoring system and categories"""
        try:
            sql = f"""
                SELECT scoring_system, scoring_categories, use_salaries, salary_cap, max_teams
                FROM user_leagues 
                WHERE league_id = '{league_id}'
            """
            
            response = execute_sql(sql)
            
            if not response.get('records'):
                raise Exception(f"League {league_id} not found")
            
            record = response['records'][0]
            return {
                'league_id': league_id,
                'scoring_system': record[0].get('stringValue') if record[0] and not record[0].get('isNull') else 'rotisserie_ytd',
                'scoring_categories': record[1].get('stringValue') if record[1] and not record[1].get('isNull') else '{}',
                'use_salaries': record[2].get('booleanValue') if record[2] and not record[2].get('isNull') else False,
                'salary_cap': record[3].get('doubleValue') if record[3] and not record[3].get('isNull') else 200.0,
                'max_teams': record[4].get('longValue') if record[4] and not record[4].get('isNull') else 12
            }
            
        except Exception as e:
            logger.error(f"Error getting league config: {str(e)}")
            raise

    @staticmethod
    def get_team_stats(league_id: str) -> List[Dict[str, Any]]:
        """
        Get aggregated team statistics by summing stats from all rostered players.
        This is the foundation for all scoring calculations.
        """
        try:
            table_name = f"league_{league_id.replace('-', '_')}_players"
            
            # This is a complex query that will need to join with actual player stats
            # For now, returning mock data structure
            sql = f"""
                SELECT 
                    team_id,
                    COUNT(*) as roster_count,
                    COALESCE(SUM(salary), 0) as total_salary
                FROM {table_name}
                WHERE team_id IS NOT NULL AND roster_status = 'active'
                GROUP BY team_id
            """
            
            response = execute_sql(sql)
            
            teams = []
            if response.get('records'):
                for record in response['records']:
                    team = {
                        'team_id': record[0].get('stringValue') if record[0] and not record[0].get('isNull') else None,
                        'roster_count': record[1].get('longValue') if record[1] and not record[1].get('isNull') else 0,
                        'total_salary': record[2].get('doubleValue') if record[2] and not record[2].get('isNull') else 0.0,
                        
                        # TODO: These will come from actual MLB stats aggregation
                        'stats': {
                            # Hitting stats
                            'R': 0, 'HR': 0, 'RBI': 0, 'SB': 0, 
                            'AVG': 0.000, 'OBP': 0.000, 'SLG': 0.000, 'OPS': 0.000,
                            'AB': 0, 'H': 0, 'BB': 0, 'SO': 0,
                            
                            # Pitching stats  
                            'W': 0, 'L': 0, 'SV': 0, 'QS': 0,
                            'ERA': 0.00, 'WHIP': 0.00, 'SO_P': 0,
                            'IP': 0.0, 'ER': 0, 'H_A': 0, 'BB_A': 0
                        }
                    }
                    teams.append(team)
            
            return teams
            
        except Exception as e:
            logger.error(f"Error getting team stats: {str(e)}")
            raise

    @staticmethod
    def calculate_rotisserie_standings(teams: List[Dict[str, Any]], scoring_categories: Dict[str, Any], num_teams: int) -> List[Dict[str, Any]]:
        """
        Calculate rotisserie standings by ranking teams in each selected category.
        Teams get points based on their rank (1st = num_teams points, last = 1 point).
        Only uses categories selected in league configuration.
        """
        try:
            standings = []
            
            for team in teams:
                team_standing = {
                    'team_id': team['team_id'],
                    'team_name': team.get('team_name', f"Team {team['team_id'][:8]}"),
                    'category_points': {},
                    'category_ranks': {},
                    'category_values': {},
                    'total_points': 0
                }
                standings.append(team_standing)
            
            # Get all selected categories from both hitters and pitchers
            selected_categories = []
            
            # Add hitter categories
            for hitter_cat in scoring_categories.get('hitters', []):
                if isinstance(hitter_cat, dict) and 'category' in hitter_cat:
                    selected_categories.append(hitter_cat['category'])
                elif isinstance(hitter_cat, str):
                    selected_categories.append(hitter_cat)
            
            # Add pitcher categories
            for pitcher_cat in scoring_categories.get('pitchers', []):
                if isinstance(pitcher_cat, dict) and 'category' in pitcher_cat:
                    selected_categories.append(pitcher_cat['category'])
                elif isinstance(pitcher_cat, str):
                    selected_categories.append(pitcher_cat)
            
            logger.info(f"Calculating rotisserie standings for {len(selected_categories)} categories: {selected_categories}")
            
            # Calculate rankings for each selected category
            for category in selected_categories:
                # Determine if this is an inverse stat (lower is better)
                inverse_stats = ['ERA', 'WHIP', 'L', 'BS', 'CS', 'SO', 'E', 'GIDP']
                is_inverse = category in inverse_stats
                
                # Sort teams by this category
                sorted_teams = sorted(
                    teams, 
                    key=lambda t: t['stats'].get(category, 0),
                    reverse=not is_inverse  # Inverse stats: lower is better (ascending sort)
                )
                
                # Handle ties - teams with same value get same rank, next rank skips
                current_rank = 1
                previous_value = None
                teams_at_rank = 0
                
                for i, team in enumerate(sorted_teams):
                    stat_value = team['stats'].get(category, 0)
                    
                    # Check for ties
                    if previous_value is not None and stat_value != previous_value:
                        current_rank = i + 1
                    
                    # Assign points based on ranking (1st place gets most points)
                    points = num_teams - current_rank + 1
                    
                    # Find this team in standings and update
                    for standing in standings:
                        if standing['team_id'] == team['team_id']:
                            standing['category_points'][category] = points
                            standing['category_ranks'][category] = current_rank
                            standing['category_values'][category] = stat_value
                            standing['total_points'] += points
                            break
                    
                    previous_value = stat_value
                
                logger.info(f"Category {category} rankings calculated - Leader: {sorted_teams[0]['team_id'][:8]} with {sorted_teams[0]['stats'].get(category, 0)}")
            
            # Sort by total points (highest first)
            standings.sort(key=lambda x: x['total_points'], reverse=True)
            
            # Add overall rank and calculate some summary stats
            for rank, standing in enumerate(standings, 1):
                standing['overall_rank'] = rank
                standing['categories_won'] = sum(1 for rank in standing['category_ranks'].values() if rank == 1)
                standing['avg_rank'] = sum(standing['category_ranks'].values()) / len(standing['category_ranks']) if standing['category_ranks'] else 0
                standing['total_categories'] = len(selected_categories)
            
            logger.info(f"Rotisserie standings calculated: {standings[0]['team_name']} leads with {standings[0]['total_points']} points")
            
            return standings
            
        except Exception as e:
            logger.error(f"Error calculating rotisserie standings: {str(e)}")
            raise

    @staticmethod
    def calculate_points_standings(teams: List[Dict[str, Any]], scoring_categories: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Calculate points-based standings by multiplying stats by their weights.
        Total points = sum(stat_value * stat_weight) for all categories.
        """
        try:
            standings = []
            
            for team in teams:
                team_standing = {
                    'team_id': team['team_id'],
                    'team_name': team.get('team_name', f"Team {team['team_id'][:8]}"),
                    'category_points': {},
                    'total_points': 0
                }
                
                # Calculate points for hitter categories
                for hitter_cat in scoring_categories.get('hitters', []):
                    category = hitter_cat.get('category')
                    weight = float(hitter_cat.get('weight', 1))
                    stat_value = team['stats'].get(category, 0)
                    
                    points = float(stat_value) * weight
                    team_standing['category_points'][category] = points
                    team_standing['total_points'] += points
                
                # Calculate points for pitcher categories
                for pitcher_cat in scoring_categories.get('pitchers', []):
                    category = pitcher_cat.get('category')
                    weight = float(pitcher_cat.get('weight', 1))
                    stat_value = team['stats'].get(category, 0)
                    
                    points = float(stat_value) * weight
                    team_standing['category_points'][category] = points
                    team_standing['total_points'] += points
                
                standings.append(team_standing)
            
            # Sort by total points (highest first)
            standings.sort(key=lambda x: x['total_points'], reverse=True)
            
            # Add overall rank
            for rank, standing in enumerate(standings, 1):
                standing['overall_rank'] = rank
            
            return standings
            
        except Exception as e:
            logger.error(f"Error calculating points standings: {str(e)}")
            raise

    @staticmethod
    def calculate_head_to_head_standings(teams: List[Dict[str, Any]], categories: List[str], scoring_system: str) -> List[Dict[str, Any]]:
        """
        Calculate head-to-head standings based on weekly matchups.
        Different H2H systems have different win/loss criteria.
        """
        try:
            standings = []
            
            for team in teams:
                team_standing = {
                    'team_id': team['team_id'],
                    'team_name': team.get('team_name', f"Team {team['team_id'][:8]}"),
                    'wins': 0,
                    'losses': 0,
                    'ties': 0,
                    'win_percentage': 0.000,
                    'points_for': 0,
                    'points_against': 0
                }
                standings.append(team_standing)
            
            # TODO: Implement actual H2H matchup logic
            # This requires weekly matchup data and opponent comparisons
            # For now, return basic structure
            
            return standings
            
        except Exception as e:
            logger.error(f"Error calculating H2H standings: {str(e)}")
            raise

    @staticmethod
    def generate_league_standings(league_id: str) -> Dict[str, Any]:
        """
        Main method to generate complete league standings based on league configuration.
        This is the primary entry point for getting standings for any league.
        """
        try:
            # Get league configuration
            config = LeagueStandingsService.get_league_config(league_id)
            scoring_system = config['scoring_system']
            
            # Parse scoring categories from JSON string
            import json
            try:
                scoring_categories = json.loads(config['scoring_categories'])
            except:
                # Default categories if parsing fails
                scoring_categories = {
                    'hitters': [
                        {'category': 'R', 'weight': 1},
                        {'category': 'HR', 'weight': 4},
                        {'category': 'RBI', 'weight': 1},
                        {'category': 'SB', 'weight': 2},
                        {'category': 'AVG', 'weight': 0.1},
                        {'category': 'OPS', 'weight': 0.1}
                    ],
                    'pitchers': [
                        {'category': 'W', 'weight': 3},
                        {'category': 'SV', 'weight': 5},
                        {'category': 'ERA', 'weight': -1},
                        {'category': 'WHIP', 'weight': -1},
                        {'category': 'SO', 'weight': 1},
                        {'category': 'QS', 'weight': 3}
                    ]
                }
            
            # Get team stats
            teams = LeagueStandingsService.get_team_stats(league_id)
            
            if not teams:
                return {
                    'success': True,
                    'league_id': league_id,
                    'scoring_system': scoring_system,
                    'standings': [],
                    'message': 'No teams found in league'
                }
            
            # Calculate standings based on scoring system
            standings = []
            
            if scoring_system.startswith('rotisserie'):
                standings = LeagueStandingsService.calculate_rotisserie_standings(
                    teams, scoring_categories, len(teams)
                )
                
            elif scoring_system == 'total_points':
                standings = LeagueStandingsService.calculate_points_standings(
                    teams, scoring_categories
                )
                
            elif scoring_system.startswith('h2h'):
                standings = LeagueStandingsService.calculate_head_to_head_standings(
                    teams, scoring_categories, scoring_system
                )
            
            else:
                # Default to rotisserie
                standings = LeagueStandingsService.calculate_rotisserie_standings(
                    teams, scoring_categories, len(teams)
                )
            
            return {
                'success': True,
                'league_id': league_id,
                'scoring_system': scoring_system,
                'standings': standings,
                'config': config,
                'categories': scoring_categories
            }
            
        except Exception as e:
            logger.error(f"Error generating league standings: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    @staticmethod
    def get_category_leaders(league_id: str, category: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Get the top performers in a specific category across the league"""
        try:
            teams = LeagueStandingsService.get_team_stats(league_id)
            
            # Sort by category (handle inverse stats)
            is_inverse = category in ['ERA', 'WHIP', 'L', 'BS', 'CS', 'SO', 'E', 'GIDP']
            
            sorted_teams = sorted(
                teams,
                key=lambda t: t['stats'].get(category, 0),
                reverse=not is_inverse
            )
            
            leaders = []
            for rank, team in enumerate(sorted_teams[:limit], 1):
                leaders.append({
                    'rank': rank,
                    'team_id': team['team_id'],
                    'team_name': team.get('team_name', f"Team {team['team_id'][:8]}"),
                    'value': team['stats'].get(category, 0)
                })
            
            return leaders
            
        except Exception as e:
            logger.error(f"Error getting category leaders: {str(e)}")
            return []