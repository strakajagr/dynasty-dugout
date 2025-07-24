"""
Dynasty Dugout - League Standings Service
Handles all league standings calculations for any scoring system configuration
UPDATED: Full PostgreSQL compatibility with database-per-league architecture
"""

import logging
from typing import Dict, List, Any, Optional, Tuple
from decimal import Decimal, ROUND_HALF_UP
import json
from core.database import execute_sql, get_league_database_name

logger = logging.getLogger(__name__)

class LeagueStandingsService:
    """
    Core service for calculating league standings across all scoring systems.
    PostgreSQL-compatible with separate databases per league.
    """
    
    @staticmethod
    def get_league_config(league_id: str) -> Dict[str, Any]:
        """Get league configuration including scoring system and categories from main database"""
        try:
            sql = """
                SELECT scoring_system, scoring_categories, use_salaries, salary_cap, max_teams
                FROM user_leagues 
                WHERE league_id = :league_id::uuid
            """
            
            # Execute on main database
            response = execute_sql(sql, {'league_id': league_id})
            
            if not response.get('records'):
                raise Exception(f"League {league_id} not found")
            
            record = response['records'][0]
            
            # Safe value extraction
            scoring_system = 'rotisserie_ytd'
            if record[0] and not record[0].get('isNull'):
                scoring_system = record[0].get('stringValue', 'rotisserie_ytd')
            
            scoring_categories = '{}'
            if record[1] and not record[1].get('isNull'):
                scoring_categories = record[1].get('stringValue', '{}')
            
            use_salaries = False
            if record[2] and not record[2].get('isNull'):
                use_salaries = record[2].get('booleanValue', False)
            
            salary_cap = 200.0
            if record[3] and not record[3].get('isNull'):
                salary_cap = record[3].get('doubleValue', 200.0)
            
            max_teams = 12
            if record[4] and not record[4].get('isNull'):
                max_teams = record[4].get('longValue', 12)
            
            return {
                'league_id': league_id,
                'scoring_system': scoring_system,
                'scoring_categories': scoring_categories,
                'use_salaries': use_salaries,
                'salary_cap': salary_cap,
                'max_teams': max_teams
            }
            
        except Exception as e:
            logger.error(f"Error getting league config: {str(e)}")
            raise

    @staticmethod
    def get_team_stats(league_id: str) -> List[Dict[str, Any]]:
        """
        Get aggregated team statistics by summing stats from all rostered players.
        This queries the league-specific database.
        """
        try:
            db_name = get_league_database_name(league_id)
            
            # Get basic team info from league database
            sql = """
                SELECT 
                    team_id,
                    COUNT(*) as roster_count,
                    COALESCE(SUM(salary), 0) as total_salary
                FROM players
                WHERE team_id IS NOT NULL AND roster_status = 'rostered'
                GROUP BY team_id
            """
            
            # Execute on league database
            response = execute_sql(sql, database_name=db_name)
            
            teams = []
            if response.get('records'):
                for record in response['records']:
                    team_id_value = record[0]
                    if team_id_value and not team_id_value.get('isNull'):
                        team_id = team_id_value.get('stringValue')
                    else:
                        continue
                    
                    roster_count = 0
                    if record[1] and not record[1].get('isNull'):
                        roster_count = record[1].get('longValue', 0)
                    
                    total_salary = 0.0
                    if record[2] and not record[2].get('isNull'):
                        total_salary = record[2].get('doubleValue', 0.0)
                    
                    team = {
                        'team_id': team_id,
                        'roster_count': roster_count,
                        'total_salary': total_salary,
                        
                        # TODO: These will come from actual MLB stats aggregation
                        # For now, using placeholder values
                        'stats': {
                            # Hitting stats
                            'R': roster_count * 50,      # Placeholder: ~50 runs per player
                            'HR': roster_count * 15,     # Placeholder: ~15 HRs per player
                            'RBI': roster_count * 45,    # Placeholder: ~45 RBIs per player
                            'SB': roster_count * 8,      # Placeholder: ~8 SBs per player
                            'AVG': 0.275,                # Placeholder batting average
                            'OBP': 0.340,                # Placeholder OBP
                            'SLG': 0.450,                # Placeholder SLG
                            'OPS': 0.790,                # Placeholder OPS
                            'AB': roster_count * 400,    # Placeholder ABs
                            'H': roster_count * 110,     # Placeholder hits
                            'BB': roster_count * 35,     # Placeholder walks
                            'SO': roster_count * 85,     # Placeholder strikeouts
                            
                            # Pitching stats  
                            'W': roster_count * 2,       # Placeholder wins
                            'L': roster_count * 2,       # Placeholder losses
                            'SV': roster_count * 5,      # Placeholder saves
                            'QS': roster_count * 8,      # Placeholder quality starts
                            'ERA': 3.50,                 # Placeholder ERA
                            'WHIP': 1.25,                # Placeholder WHIP
                            'SO_P': roster_count * 120,  # Placeholder pitcher Ks
                            'IP': roster_count * 80.0,   # Placeholder innings
                            'ER': roster_count * 25,     # Placeholder earned runs
                            'H_A': roster_count * 75,    # Placeholder hits allowed
                            'BB_A': roster_count * 25    # Placeholder walks allowed
                        }
                    }
                    teams.append(team)
            
            # If no teams with players, get all teams from teams table
            if not teams:
                teams_sql = """
                    SELECT team_id, team_name, manager_name
                    FROM teams
                    WHERE is_active = true
                """
                
                teams_response = execute_sql(teams_sql, database_name=db_name)
                
                if teams_response.get('records'):
                    for record in teams_response['records']:
                        team_id_value = record[0]
                        if team_id_value and not team_id_value.get('isNull'):
                            team_id = team_id_value.get('stringValue')
                        else:
                            continue
                        
                        team_name = ''
                        if record[1] and not record[1].get('isNull'):
                            team_name = record[1].get('stringValue', '')
                        
                        manager_name = ''
                        if record[2] and not record[2].get('isNull'):
                            manager_name = record[2].get('stringValue', '')
                        
                        team = {
                            'team_id': team_id,
                            'team_name': team_name,
                            'manager_name': manager_name,
                            'roster_count': 0,
                            'total_salary': 0.0,
                            'stats': {
                                # Empty stats for teams with no players
                                'R': 0, 'HR': 0, 'RBI': 0, 'SB': 0, 
                                'AVG': 0.000, 'OBP': 0.000, 'SLG': 0.000, 'OPS': 0.000,
                                'AB': 0, 'H': 0, 'BB': 0, 'SO': 0,
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
            # Get league configuration from main database
            config = LeagueStandingsService.get_league_config(league_id)
            scoring_system = config['scoring_system']
            
            # Parse scoring categories from JSON string
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
                        {'category': 'SO_P', 'weight': 1},
                        {'category': 'QS', 'weight': 3}
                    ]
                }
            
            # Get team stats from league database
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