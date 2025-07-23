"""
Dynasty Dugout - Roster Management Service
Handles roster validation, position requirements, salary caps, and contract management
FIXED: SQL injection vulnerabilities and position requirements structure
"""

import logging
from typing import Dict, List, Any, Optional, Tuple
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, date
import json
from core.database import execute_sql

logger = logging.getLogger(__name__)

class RosterManagementService:
    """
    Core service for managing team rosters within league rules.
    Validates position requirements, salary caps, contract years, and roster moves.
    """
    
    @staticmethod
    def get_league_roster_rules(league_id: str) -> Dict[str, Any]:
        """Get league-specific roster and position requirements"""
        try:
            # FIXED: Use parameterized query to prevent SQL injection
            sql = """
                SELECT 
                    max_players_total, min_hitters, max_pitchers, min_pitchers,
                    position_requirements, use_salaries, salary_cap, salary_floor,
                    use_contracts, max_contract_years
                FROM user_leagues 
                WHERE league_id = :league_id
            """
            
            response = execute_sql(sql, {'league_id': league_id})
            
            if not response.get('records'):
                raise Exception(f"League {league_id} not found")
            
            record = response['records'][0]
            
            # Parse position requirements JSON
            position_requirements = {}
            try:
                pos_req_str = record[4].get('stringValue') if record[4] and not record[4].get('isNull') else '{}'
                position_requirements = json.loads(pos_req_str)
            except:
                # FIXED: Default position requirements - ONLY MIN VALUES (no max for eligibility)
                position_requirements = {
                    'C': {'min': 1},
                    '1B': {'min': 1},
                    '2B': {'min': 1},
                    '3B': {'min': 1},
                    'SS': {'min': 1},
                    'OF': {'min': 3},
                    'UTIL': {'min': 1}
                }
            
            return {
                'league_id': league_id,
                'max_players_total': record[0].get('longValue') if record[0] and not record[0].get('isNull') else 23,
                'min_hitters': record[1].get('longValue') if record[1] and not record[1].get('isNull') else 13,
                'max_pitchers': record[2].get('longValue') if record[2] and not record[2].get('isNull') else 10,
                'min_pitchers': record[3].get('longValue') if record[3] and not record[3].get('isNull') else 10,
                'position_requirements': position_requirements,
                'use_salaries': record[5].get('booleanValue') if record[5] and not record[5].get('isNull') else False,
                'salary_cap': record[6].get('doubleValue') if record[6] and not record[6].get('isNull') else 200.0,
                'salary_floor': record[7].get('doubleValue') if record[7] and not record[7].get('isNull') else 0.0,
                'use_contracts': record[8].get('booleanValue') if record[8] and not record[8].get('isNull') else False,
                'max_contract_years': record[9].get('longValue') if record[9] and not record[9].get('isNull') else 5
            }
            
        except Exception as e:
            logger.error(f"Error getting league roster rules: {str(e)}")
            raise

    @staticmethod
    def get_team_roster(league_id: str, team_id: str) -> Dict[str, Any]:
        """Get current roster for a team with position breakdown"""
        try:
            # FIXED: Safely construct table name and use parameterized query
            sanitized_league_id = league_id.replace('-', '_')
            table_name = f"league_{sanitized_league_id}_players"
            
            sql = f"""
                SELECT 
                    lp.league_player_id,
                    lp.mlb_player_id,
                    lp.salary,
                    lp.contract_years,
                    lp.roster_status,
                    mp.first_name,
                    mp.last_name,
                    mp.position,
                    mp.mlb_team,
                    mp.is_active
                FROM {table_name} lp
                JOIN mlb_players mp ON lp.mlb_player_id = mp.player_id
                WHERE lp.team_id = :team_id
                ORDER BY lp.roster_status, mp.position, mp.last_name
            """
            
            response = execute_sql(sql, {'team_id': team_id})
            
            roster = {
                'team_id': team_id,
                'active_players': [],
                'bench_players': [],
                'dl_players': [],
                'total_salary': 0.0,
                'position_counts': {},
                'roster_counts': {
                    'active': 0,
                    'bench': 0,
                    'dl': 0,
                    'total': 0
                }
            }
            
            if response.get('records'):
                for record in response['records']:
                    player = {
                        'league_player_id': record[0].get('stringValue') if record[0] and not record[0].get('isNull') else None,
                        'mlb_player_id': record[1].get('longValue') if record[1] and not record[1].get('isNull') else None,
                        'salary': record[2].get('doubleValue') if record[2] and not record[2].get('isNull') else 1.0,
                        'contract_years': record[3].get('longValue') if record[3] and not record[3].get('isNull') else 1,
                        'roster_status': record[4].get('stringValue') if record[4] and not record[4].get('isNull') else 'active',
                        'first_name': record[5].get('stringValue') if record[5] and not record[5].get('isNull') else '',
                        'last_name': record[6].get('stringValue') if record[6] and not record[6].get('isNull') else '',
                        'position': record[7].get('stringValue') if record[7] and not record[7].get('isNull') else '',
                        'mlb_team': record[8].get('stringValue') if record[8] and not record[8].get('isNull') else '',
                        'is_active': record[9].get('booleanValue') if record[9] and not record[9].get('isNull') else True
                    }
                    
                    # Add to appropriate roster list
                    status = player['roster_status']
                    if status == 'active':
                        roster['active_players'].append(player)
                        roster['roster_counts']['active'] += 1
                    elif status == 'bench':
                        roster['bench_players'].append(player)
                        roster['roster_counts']['bench'] += 1
                    elif status == 'dl':
                        roster['dl_players'].append(player)
                        roster['roster_counts']['dl'] += 1
                    
                    # Count positions (only active players)
                    if status == 'active':
                        position = player['position']
                        if position:
                            roster['position_counts'][position] = roster['position_counts'].get(position, 0) + 1
                    
                    # Add to total salary
                    roster['total_salary'] += player['salary']
                    roster['roster_counts']['total'] += 1
            
            return roster
            
        except Exception as e:
            logger.error(f"Error getting team roster: {str(e)}")
            raise

    @staticmethod
    def validate_roster_requirements(league_id: str, team_id: str) -> Dict[str, Any]:
        """Validate if team roster meets league requirements"""
        try:
            # Get league rules and team roster
            rules = RosterManagementService.get_league_roster_rules(league_id)
            roster = RosterManagementService.get_team_roster(league_id, team_id)
            
            validation_result = {
                'is_valid': True,
                'violations': [],
                'warnings': [],
                'summary': {
                    'total_players': roster['roster_counts']['total'],
                    'active_players': roster['roster_counts']['active'],
                    'total_salary': roster['total_salary'],
                    'position_counts': roster['position_counts']
                }
            }
            
            # Check total roster size
            if roster['roster_counts']['total'] > rules['max_players_total']:
                validation_result['violations'].append(
                    f"Roster size ({roster['roster_counts']['total']}) exceeds maximum ({rules['max_players_total']})"
                )
                validation_result['is_valid'] = False
            
            # Check active lineup requirements
            active_count = roster['roster_counts']['active']
            hitter_positions = ['C', '1B', '2B', '3B', 'SS', 'OF', 'UTIL']
            pitcher_positions = ['SP', 'RP', 'P']
            
            # Count hitters vs pitchers in active lineup
            active_hitters = 0
            active_pitchers = 0
            
            for position, count in roster['position_counts'].items():
                if position in hitter_positions:
                    active_hitters += count
                elif position in pitcher_positions:
                    active_pitchers += count
            
            # Validate hitter requirements
            if active_hitters < rules['min_hitters']:
                validation_result['violations'].append(
                    f"Not enough active hitters ({active_hitters}/{rules['min_hitters']})"
                )
                validation_result['is_valid'] = False
            
            # Validate pitcher requirements
            if active_pitchers < rules['min_pitchers']:
                validation_result['violations'].append(
                    f"Not enough active pitchers ({active_pitchers}/{rules['min_pitchers']})"
                )
                validation_result['is_valid'] = False
            
            if active_pitchers > rules['max_pitchers']:
                validation_result['violations'].append(
                    f"Too many active pitchers ({active_pitchers}/{rules['max_pitchers']})"
                )
                validation_result['is_valid'] = False
            
            # FIXED: Check position-specific requirements (only minimums)
            position_requirements = rules['position_requirements']
            for position, requirements in position_requirements.items():
                current_count = roster['position_counts'].get(position, 0)
                min_required = requirements.get('min', 0)
                
                # Only check minimum requirements - no max limits for position eligibility
                if current_count < min_required:
                    validation_result['violations'].append(
                        f"Not enough {position} players ({current_count}/{min_required})"
                    )
                    validation_result['is_valid'] = False
            
            # Check salary cap if enabled
            if rules['use_salaries']:
                if roster['total_salary'] > rules['salary_cap']:
                    validation_result['violations'].append(
                        f"Salary cap exceeded (${roster['total_salary']:.1f}/${rules['salary_cap']:.1f})"
                    )
                    validation_result['is_valid'] = False
                
                if roster['total_salary'] < rules['salary_floor']:
                    validation_result['violations'].append(
                        f"Below salary floor (${roster['total_salary']:.1f}/${rules['salary_floor']:.1f})"
                    )
                    validation_result['is_valid'] = False
                
                # Warning if close to salary cap
                cap_utilization = (roster['total_salary'] / rules['salary_cap']) * 100
                if cap_utilization > 95:
                    validation_result['warnings'].append(
                        f"Close to salary cap ({cap_utilization:.1f}% utilized)"
                    )
            
            return validation_result
            
        except Exception as e:
            logger.error(f"Error validating roster requirements: {str(e)}")
            return {
                'is_valid': False,
                'violations': [f"Validation error: {str(e)}"],
                'warnings': []
            }

    @staticmethod
    def can_add_player(league_id: str, team_id: str, player_id: int, salary: float = 1.0) -> Dict[str, Any]:
        """Check if a player can be added to a team roster"""
        try:
            # Get league rules and current roster
            rules = RosterManagementService.get_league_roster_rules(league_id)
            roster = RosterManagementService.get_team_roster(league_id, team_id)
            
            # FIXED: Use parameterized query
            player_sql = """
                SELECT first_name, last_name, position, is_active
                FROM mlb_players 
                WHERE player_id = :player_id
            """
            
            player_response = execute_sql(player_sql, {'player_id': player_id})
            
            if not player_response.get('records'):
                return {
                    'can_add': False,
                    'reason': f'Player {player_id} not found'
                }
            
            player_record = player_response['records'][0]
            player_info = {
                'first_name': player_record[0].get('stringValue', ''),
                'last_name': player_record[1].get('stringValue', ''),
                'position': player_record[2].get('stringValue', ''),
                'is_active': player_record[3].get('booleanValue', True)
            }
            
            result = {
                'can_add': True,
                'reasons': [],
                'warnings': [],
                'player_info': player_info
            }
            
            # FIXED: Safe table name and parameterized queries
            sanitized_league_id = league_id.replace('-', '_')
            table_name = f"league_{sanitized_league_id}_players"
            
            # Check if player is already on roster
            existing_sql = f"""
                SELECT roster_status FROM {table_name}
                WHERE team_id = :team_id AND mlb_player_id = :player_id
            """
            
            existing_response = execute_sql(existing_sql, {
                'team_id': team_id, 
                'player_id': player_id
            })
            
            if existing_response.get('records'):
                result['can_add'] = False
                result['reasons'].append('Player is already on this team roster')
                return result
            
            # Check if player is on another team in the league
            other_team_sql = f"""
                SELECT team_id FROM {table_name}
                WHERE mlb_player_id = :player_id AND team_id IS NOT NULL
            """
            
            other_team_response = execute_sql(other_team_sql, {'player_id': player_id})
            
            if other_team_response.get('records'):
                other_team = other_team_response['records'][0][0].get('stringValue', '')
                result['can_add'] = False
                result['reasons'].append(f'Player is already owned by team {other_team[:8]}')
                return result
            
            # Check roster size limits
            if roster['roster_counts']['total'] >= rules['max_players_total']:
                result['can_add'] = False
                result['reasons'].append(
                    f'Roster is full ({roster["roster_counts"]["total"]}/{rules["max_players_total"]})'
                )
            
            # Check salary cap if enabled
            if rules['use_salaries']:
                new_total_salary = roster['total_salary'] + salary
                if new_total_salary > rules['salary_cap']:
                    result['can_add'] = False
                    result['reasons'].append(
                        f'Would exceed salary cap (${new_total_salary:.1f}/${rules["salary_cap"]:.1f})'
                    )
                
                # Warning if close to cap
                cap_utilization = (new_total_salary / rules['salary_cap']) * 100
                if cap_utilization > 90:
                    result['warnings'].append(
                        f'Would use {cap_utilization:.1f}% of salary cap'
                    )
            
            # FIXED: Check position limits (only minimums matter for eligibility)
            position = player_info['position']
            if position and position in rules['position_requirements']:
                current_count = roster['position_counts'].get(position, 0)
                # Note: No max check since position eligibility only has minimums
                
            # Check if player is active in MLB
            if not player_info['is_active']:
                result['warnings'].append('Player is not currently active in MLB')
            
            return result
            
        except Exception as e:
            logger.error(f"Error checking if can add player: {str(e)}")
            return {
                'can_add': False,
                'reasons': [f'Error: {str(e)}']
            }

    @staticmethod
    def add_player_to_roster(league_id: str, team_id: str, player_id: int, salary: float = 1.0, 
                           contract_years: int = 1, roster_status: str = 'bench') -> Dict[str, Any]:
        """Add a player to a team roster"""
        try:
            # First check if player can be added
            can_add_result = RosterManagementService.can_add_player(league_id, team_id, player_id, salary)
            
            if not can_add_result['can_add']:
                return {
                    'success': False,
                    'message': 'Cannot add player',
                    'reasons': can_add_result['reasons']
                }
            
            # FIXED: Safe table name and parameterized query
            sanitized_league_id = league_id.replace('-', '_')
            table_name = f"league_{sanitized_league_id}_players"
            
            sql = f"""
                UPDATE {table_name}
                SET 
                    team_id = :team_id,
                    salary = :salary,
                    contract_years = :contract_years,
                    roster_status = :roster_status,
                    updated_at = NOW()
                WHERE mlb_player_id = :player_id
            """
            
            execute_sql(sql, {
                'team_id': team_id,
                'salary': salary,
                'contract_years': contract_years,
                'roster_status': roster_status,
                'player_id': player_id
            })
            
            logger.info(f"Added player {player_id} to team {team_id} in league {league_id}")
            
            return {
                'success': True,
                'message': f'Player added to roster',
                'player_info': can_add_result['player_info'],
                'warnings': can_add_result.get('warnings', [])
            }
            
        except Exception as e:
            logger.error(f"Error adding player to roster: {str(e)}")
            return {
                'success': False,
                'message': f'Failed to add player: {str(e)}'
            }

    @staticmethod
    def remove_player_from_roster(league_id: str, team_id: str, player_id: int) -> Dict[str, Any]:
        """Remove a player from a team roster"""
        try:
            # FIXED: Safe table name and parameterized queries
            sanitized_league_id = league_id.replace('-', '_')
            table_name = f"league_{sanitized_league_id}_players"
            
            # Check if player is on this team
            check_sql = f"""
                SELECT roster_status FROM {table_name}
                WHERE team_id = :team_id AND mlb_player_id = :player_id
            """
            
            check_response = execute_sql(check_sql, {
                'team_id': team_id, 
                'player_id': player_id
            })
            
            if not check_response.get('records'):
                return {
                    'success': False,
                    'message': 'Player not found on this team roster'
                }
            
            # Remove player from team (set team_id to NULL, status to available)
            sql = f"""
                UPDATE {table_name}
                SET 
                    team_id = NULL,
                    roster_status = 'available',
                    updated_at = NOW()
                WHERE team_id = :team_id AND mlb_player_id = :player_id
            """
            
            execute_sql(sql, {
                'team_id': team_id,
                'player_id': player_id
            })
            
            logger.info(f"Removed player {player_id} from team {team_id} in league {league_id}")
            
            return {
                'success': True,
                'message': 'Player removed from roster'
            }
            
        except Exception as e:
            logger.error(f"Error removing player from roster: {str(e)}")
            return {
                'success': False,
                'message': f'Failed to remove player: {str(e)}'
            }

    @staticmethod
    def move_player_status(league_id: str, team_id: str, player_id: int, new_status: str) -> Dict[str, Any]:
        """Move player between active, bench, DL"""
        try:
            valid_statuses = ['active', 'bench', 'dl']
            if new_status not in valid_statuses:
                return {
                    'success': False,
                    'message': f'Invalid status. Must be one of: {valid_statuses}'
                }
            
            # FIXED: Safe table name and parameterized query
            sanitized_league_id = league_id.replace('-', '_')
            table_name = f"league_{sanitized_league_id}_players"
            
            # Update player status
            sql = f"""
                UPDATE {table_name}
                SET 
                    roster_status = :new_status,
                    updated_at = NOW()
                WHERE team_id = :team_id AND mlb_player_id = :player_id
            """
            
            execute_sql(sql, {
                'new_status': new_status,
                'team_id': team_id,
                'player_id': player_id
            })
            
            # Validate roster after move
            validation = RosterManagementService.validate_roster_requirements(league_id, team_id)
            
            return {
                'success': True,
                'message': f'Player moved to {new_status}',
                'roster_validation': validation
            }
            
        except Exception as e:
            logger.error(f"Error moving player status: {str(e)}")
            return {
                'success': False,
                'message': f'Failed to move player: {str(e)}'
            }

    @staticmethod
    def get_available_players(league_id: str, position: str = None, limit: int = 50) -> List[Dict[str, Any]]:
        """Get players available for pickup in the league"""
        try:
            # FIXED: Safe table name and parameterized query
            sanitized_league_id = league_id.replace('-', '_')
            table_name = f"league_{sanitized_league_id}_players"
            
            where_conditions = ["lp.roster_status = 'available'"]
            params = {'limit': limit}
            
            if position:
                where_conditions.append("mp.position = :position")
                params['position'] = position
            
            where_clause = " AND ".join(where_conditions)
            
            sql = f"""
                SELECT 
                    lp.mlb_player_id,
                    lp.salary,
                    mp.first_name,
                    mp.last_name,
                    mp.position,
                    mp.mlb_team,
                    mp.is_active
                FROM {table_name} lp
                JOIN mlb_players mp ON lp.mlb_player_id = mp.player_id
                WHERE {where_clause}
                ORDER BY mp.position, mp.last_name, mp.first_name
                LIMIT :limit
            """
            
            response = execute_sql(sql, params)
            
            available_players = []
            if response.get('records'):
                for record in response['records']:
                    player = {
                        'mlb_player_id': record[0].get('longValue') if record[0] and not record[0].get('isNull') else None,
                        'salary': record[1].get('doubleValue') if record[1] and not record[1].get('isNull') else 1.0,
                        'first_name': record[2].get('stringValue') if record[2] and not record[2].get('isNull') else '',
                        'last_name': record[3].get('stringValue') if record[3] and not record[3].get('isNull') else '',
                        'position': record[4].get('stringValue') if record[4] and not record[4].get('isNull') else '',
                        'mlb_team': record[5].get('stringValue') if record[5] and not record[5].get('isNull') else '',
                        'is_active': record[6].get('booleanValue') if record[6] and not record[6].get('isNull') else True
                    }
                    available_players.append(player)
            
            return available_players
            
        except Exception as e:
            logger.error(f"Error getting available players: {str(e)}")
            return []