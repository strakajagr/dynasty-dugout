"""
Dynasty Dugout - Roster Management Service
Handles roster validation, position requirements, salary caps, and contract management
UPDATED: Full PostgreSQL compatibility with database-per-league architecture
"""

import logging
from typing import Dict, List, Any, Optional, Tuple
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, date
import json
from core.database import execute_sql, get_league_database_name

logger = logging.getLogger(__name__)

class RosterManagementService:
    """
    Core service for managing team rosters within league rules.
    PostgreSQL-compatible with separate databases per league.
    """
    
    @staticmethod
    def get_league_roster_rules(league_id: str) -> Dict[str, Any]:
        """Get league-specific roster and position requirements from main database"""
        try:
            sql = """
                SELECT 
                    max_players_total, min_hitters, max_pitchers, min_pitchers,
                    position_requirements, use_salaries, salary_cap, salary_floor,
                    use_contracts, max_contract_years
                FROM user_leagues 
                WHERE league_id = :league_id::uuid
            """
            
            # Execute on main database
            response = execute_sql(sql, {'league_id': league_id})
            
            if not response.get('records'):
                raise Exception(f"League {league_id} not found")
            
            record = response['records'][0]
            
            # Parse position requirements JSON
            position_requirements = {}
            try:
                pos_req_value = record[4]
                if pos_req_value and not pos_req_value.get('isNull'):
                    pos_req_str = pos_req_value.get('stringValue', '{}')
                    position_requirements = json.loads(pos_req_str)
            except:
                # Default position requirements - ONLY MIN VALUES (no max for eligibility)
                position_requirements = {
                    'C': {'min': 1},
                    '1B': {'min': 1},
                    '2B': {'min': 1},
                    '3B': {'min': 1},
                    'SS': {'min': 1},
                    'OF': {'min': 3},
                    'UTIL': {'min': 1}
                }
            
            # Safe value extraction
            max_players_total = 23
            if record[0] and not record[0].get('isNull'):
                max_players_total = record[0].get('longValue', 23)
            
            min_hitters = 13
            if record[1] and not record[1].get('isNull'):
                min_hitters = record[1].get('longValue', 13)
            
            max_pitchers = 10
            if record[2] and not record[2].get('isNull'):
                max_pitchers = record[2].get('longValue', 10)
            
            min_pitchers = 10
            if record[3] and not record[3].get('isNull'):
                min_pitchers = record[3].get('longValue', 10)
            
            use_salaries = False
            if record[5] and not record[5].get('isNull'):
                use_salaries = record[5].get('booleanValue', False)
            
            salary_cap = 200.0
            if record[6] and not record[6].get('isNull'):
                salary_cap = record[6].get('doubleValue', 200.0)
            
            salary_floor = 0.0
            if record[7] and not record[7].get('isNull'):
                salary_floor = record[7].get('doubleValue', 0.0)
            
            use_contracts = False
            if record[8] and not record[8].get('isNull'):
                use_contracts = record[8].get('booleanValue', False)
            
            max_contract_years = 5
            if record[9] and not record[9].get('isNull'):
                max_contract_years = record[9].get('longValue', 5)
            
            return {
                'league_id': league_id,
                'max_players_total': max_players_total,
                'min_hitters': min_hitters,
                'max_pitchers': max_pitchers,
                'min_pitchers': min_pitchers,
                'position_requirements': position_requirements,
                'use_salaries': use_salaries,
                'salary_cap': salary_cap,
                'salary_floor': salary_floor,
                'use_contracts': use_contracts,
                'max_contract_years': max_contract_years
            }
            
        except Exception as e:
            logger.error(f"Error getting league roster rules: {str(e)}")
            raise

    @staticmethod
    def get_team_roster(league_id: str, team_id: str) -> Dict[str, Any]:
        """Get current roster for a team with position breakdown from league database"""
        try:
            db_name = get_league_database_name(league_id)
            
            # Query league database for roster, then get MLB player info from main database
            roster_sql = """
                SELECT 
                    league_player_id,
                    mlb_player_id,
                    salary,
                    contract_years,
                    roster_status
                FROM players
                WHERE team_id = :team_id::uuid
                ORDER BY roster_status, mlb_player_id
            """
            
            # Execute on league database
            roster_response = execute_sql(roster_sql, {'team_id': team_id}, database_name=db_name)
            
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
            
            if roster_response.get('records'):
                # Get all MLB player IDs to query for their info
                mlb_player_ids = []
                roster_data = {}
                
                for record in roster_response['records']:
                    league_player_id_value = record[0]
                    if league_player_id_value and not league_player_id_value.get('isNull'):
                        league_player_id = league_player_id_value.get('stringValue')
                    else:
                        continue
                    
                    mlb_player_id = None
                    if record[1] and not record[1].get('isNull'):
                        mlb_player_id = record[1].get('longValue')
                    
                    if mlb_player_id:
                        mlb_player_ids.append(mlb_player_id)
                        
                        salary = 1.0
                        if record[2] and not record[2].get('isNull'):
                            salary = record[2].get('doubleValue', 1.0)
                        
                        contract_years = 1
                        if record[3] and not record[3].get('isNull'):
                            contract_years = record[3].get('longValue', 1)
                        
                        roster_status = 'active'
                        if record[4] and not record[4].get('isNull'):
                            roster_status = record[4].get('stringValue', 'active')
                        
                        roster_data[mlb_player_id] = {
                            'league_player_id': league_player_id,
                            'mlb_player_id': mlb_player_id,
                            'salary': salary,
                            'contract_years': contract_years,
                            'roster_status': roster_status
                        }
                
                # Get MLB player info from main database if we have players
                if mlb_player_ids:
                    # Convert to parameterized query
                    placeholders = ','.join([f':id_{i}' for i in range(len(mlb_player_ids))])
                    mlb_sql = f"""
                        SELECT player_id, first_name, last_name, position, mlb_team, is_active
                        FROM mlb_players 
                        WHERE player_id IN ({placeholders})
                    """
                    
                    mlb_params = {f'id_{i}': player_id for i, player_id in enumerate(mlb_player_ids)}
                    
                    # Execute on main database
                    mlb_response = execute_sql(mlb_sql, mlb_params)
                    
                    if mlb_response.get('records'):
                        for mlb_record in mlb_response['records']:
                            mlb_player_id = None
                            if mlb_record[0] and not mlb_record[0].get('isNull'):
                                mlb_player_id = mlb_record[0].get('longValue')
                            
                            if mlb_player_id in roster_data:
                                player_data = roster_data[mlb_player_id]
                                
                                # Add MLB player info
                                first_name = ''
                                if mlb_record[1] and not mlb_record[1].get('isNull'):
                                    first_name = mlb_record[1].get('stringValue', '')
                                
                                last_name = ''
                                if mlb_record[2] and not mlb_record[2].get('isNull'):
                                    last_name = mlb_record[2].get('stringValue', '')
                                
                                position = ''
                                if mlb_record[3] and not mlb_record[3].get('isNull'):
                                    position = mlb_record[3].get('stringValue', '')
                                
                                mlb_team = ''
                                if mlb_record[4] and not mlb_record[4].get('isNull'):
                                    mlb_team = mlb_record[4].get('stringValue', '')
                                
                                is_active = True
                                if mlb_record[5] and not mlb_record[5].get('isNull'):
                                    is_active = mlb_record[5].get('booleanValue', True)
                                
                                player = {
                                    **player_data,
                                    'first_name': first_name,
                                    'last_name': last_name,
                                    'position': position,
                                    'mlb_team': mlb_team,
                                    'is_active': is_active
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
                                if status == 'active' and position:
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
            # Get league rules from main database and team roster from league database
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
            
            # Check position-specific requirements (only minimums)
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
            # Get league rules from main database and current roster from league database
            rules = RosterManagementService.get_league_roster_rules(league_id)
            roster = RosterManagementService.get_team_roster(league_id, team_id)
            
            # Get player info from main database
            player_sql = """
                SELECT first_name, last_name, position, is_active
                FROM mlb_players 
                WHERE player_id = :player_id
            """
            
            # Execute on main database
            player_response = execute_sql(player_sql, {'player_id': player_id})
            
            if not player_response.get('records'):
                return {
                    'can_add': False,
                    'reason': f'Player {player_id} not found'
                }
            
            player_record = player_response['records'][0]
            
            first_name = ''
            if player_record[0] and not player_record[0].get('isNull'):
                first_name = player_record[0].get('stringValue', '')
            
            last_name = ''
            if player_record[1] and not player_record[1].get('isNull'):
                last_name = player_record[1].get('stringValue', '')
            
            position = ''
            if player_record[2] and not player_record[2].get('isNull'):
                position = player_record[2].get('stringValue', '')
            
            is_active = True
            if player_record[3] and not player_record[3].get('isNull'):
                is_active = player_record[3].get('booleanValue', True)
            
            player_info = {
                'first_name': first_name,
                'last_name': last_name,
                'position': position,
                'is_active': is_active
            }
            
            result = {
                'can_add': True,
                'reasons': [],
                'warnings': [],
                'player_info': player_info
            }
            
            db_name = get_league_database_name(league_id)
            
            # Check if player is already on roster
            existing_sql = """
                SELECT roster_status FROM players
                WHERE team_id = :team_id::uuid AND mlb_player_id = :player_id
            """
            
            # Execute on league database
            existing_response = execute_sql(existing_sql, {
                'team_id': team_id, 
                'player_id': player_id
            }, database_name=db_name)
            
            if existing_response.get('records'):
                result['can_add'] = False
                result['reasons'].append('Player is already on this team roster')
                return result
            
            # Check if player is on another team in the league
            other_team_sql = """
                SELECT team_id FROM players
                WHERE mlb_player_id = :player_id AND team_id IS NOT NULL
            """
            
            # Execute on league database
            other_team_response = execute_sql(other_team_sql, {'player_id': player_id}, database_name=db_name)
            
            if other_team_response.get('records'):
                other_team_value = other_team_response['records'][0][0]
                if other_team_value and not other_team_value.get('isNull'):
                    other_team = other_team_value.get('stringValue', '')
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
        """Add a player to a team roster in league database"""
        try:
            # First check if player can be added
            can_add_result = RosterManagementService.can_add_player(league_id, team_id, player_id, salary)
            
            if not can_add_result['can_add']:
                return {
                    'success': False,
                    'message': 'Cannot add player',
                    'reasons': can_add_result['reasons']
                }
            
            db_name = get_league_database_name(league_id)
            
            # Update player in league database
            sql = """
                UPDATE players
                SET 
                    team_id = :team_id::uuid,
                    salary = :salary,
                    contract_years = :contract_years,
                    roster_status = :roster_status,
                    updated_at = NOW()
                WHERE mlb_player_id = :player_id
            """
            
            # Execute on league database
            execute_sql(sql, {
                'team_id': team_id,
                'salary': salary,
                'contract_years': contract_years,
                'roster_status': roster_status,
                'player_id': player_id
            }, database_name=db_name)
            
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
        """Remove a player from a team roster in league database"""
        try:
            db_name = get_league_database_name(league_id)
            
            # Check if player is on this team
            check_sql = """
                SELECT roster_status FROM players
                WHERE team_id = :team_id::uuid AND mlb_player_id = :player_id
            """
            
            # Execute on league database
            check_response = execute_sql(check_sql, {
                'team_id': team_id, 
                'player_id': player_id
            }, database_name=db_name)
            
            if not check_response.get('records'):
                return {
                    'success': False,
                    'message': 'Player not found on this team roster'
                }
            
            # Remove player from team (set team_id to NULL, status to available)
            sql = """
                UPDATE players
                SET 
                    team_id = NULL,
                    roster_status = 'available',
                    updated_at = NOW()
                WHERE team_id = :team_id::uuid AND mlb_player_id = :player_id
            """
            
            # Execute on league database
            execute_sql(sql, {
                'team_id': team_id,
                'player_id': player_id
            }, database_name=db_name)
            
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
        """Move player between active, bench, DL in league database"""
        try:
            valid_statuses = ['active', 'bench', 'dl']
            if new_status not in valid_statuses:
                return {
                    'success': False,
                    'message': f'Invalid status. Must be one of: {valid_statuses}'
                }
            
            db_name = get_league_database_name(league_id)
            
            # Update player status in league database
            sql = """
                UPDATE players
                SET 
                    roster_status = :new_status,
                    updated_at = NOW()
                WHERE team_id = :team_id::uuid AND mlb_player_id = :player_id
            """
            
            # Execute on league database
            execute_sql(sql, {
                'new_status': new_status,
                'team_id': team_id,
                'player_id': player_id
            }, database_name=db_name)
            
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
        """Get players available for pickup in the league from league database"""
        try:
            db_name = get_league_database_name(league_id)
            
            # Get available players from league database
            where_conditions = ["roster_status = 'available'"]
            params = {'limit': limit}
            
            if position:
                where_conditions.append("position = :position")
                params['position'] = position
            
            where_clause = " AND ".join(where_conditions)
            
            sql = f"""
                SELECT 
                    mlb_player_id,
                    salary,
                    first_name,
                    last_name,
                    position,
                    mlb_team,
                    is_active
                FROM players
                WHERE {where_clause}
                ORDER BY position, last_name, first_name
                LIMIT :limit
            """
            
            # Execute on league database
            response = execute_sql(sql, params, database_name=db_name)
            
            available_players = []
            if response.get('records'):
                for record in response['records']:
                    mlb_player_id = None
                    if record[0] and not record[0].get('isNull'):
                        mlb_player_id = record[0].get('longValue')
                    
                    salary = 1.0
                    if record[1] and not record[1].get('isNull'):
                        salary = record[1].get('doubleValue', 1.0)
                    
                    first_name = ''
                    if record[2] and not record[2].get('isNull'):
                        first_name = record[2].get('stringValue', '')
                    
                    last_name = ''
                    if record[3] and not record[3].get('isNull'):
                        last_name = record[3].get('stringValue', '')
                    
                    position = ''
                    if record[4] and not record[4].get('isNull'):
                        position = record[4].get('stringValue', '')
                    
                    mlb_team = ''
                    if record[5] and not record[5].get('isNull'):
                        mlb_team = record[5].get('stringValue', '')
                    
                    is_active = True
                    if record[6] and not record[6].get('isNull'):
                        is_active = record[6].get('booleanValue', True)
                    
                    player = {
                        'mlb_player_id': mlb_player_id,
                        'salary': salary,
                        'first_name': first_name,
                        'last_name': last_name,
                        'position': position,
                        'mlb_team': mlb_team,
                        'is_active': is_active
                    }
                    available_players.append(player)
            
            return available_players
            
        except Exception as e:
            logger.error(f"Error getting available players: {str(e)}")
            return []