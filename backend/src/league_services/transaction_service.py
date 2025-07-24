"""
Dynasty Dugout - Transaction Service
Handles trades, waivers, free agent pickups, and transaction processing
UPDATED: Full PostgreSQL compatibility with database-per-league architecture
"""

import logging
from typing import Dict, List, Any, Optional, Tuple
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, date, timedelta
import json
from uuid import uuid4
from core.database import execute_sql, get_league_database_name

logger = logging.getLogger(__name__)

class TransactionService:
    """
    Core service for processing all league transactions.
    Handles trades, waivers, free agent pickups, drops, and transaction validation.
    """
    
    @staticmethod
    def get_league_transaction_rules(league_id: str) -> Dict[str, Any]:
        """Get league-specific transaction rules and deadlines"""
        try:
            # Query main database for league rules
            sql = """
                SELECT 
                    transaction_deadline, use_waivers, season_start_date, season_end_date,
                    max_teams, scoring_system
                FROM user_leagues 
                WHERE league_id = :league_id::uuid
            """
            
            response = execute_sql(sql, {'league_id': league_id})
            
            if not response.get('records'):
                raise Exception(f"League {league_id} not found")
            
            record = response['records'][0]
            
            return {
                'league_id': league_id,
                'transaction_deadline': record[0].get('stringValue') if record[0] and not record[0].get('isNull') else 'monday',
                'use_waivers': record[1].get('booleanValue') if record[1] and not record[1].get('isNull') else False,
                'season_start_date': record[2].get('stringValue') if record[2] and not record[2].get('isNull') else None,
                'season_end_date': record[3].get('stringValue') if record[3] and not record[3].get('isNull') else None,
                'max_teams': record[4].get('longValue') if record[4] and not record[4].get('isNull') else 12,
                'scoring_system': record[5].get('stringValue') if record[5] and not record[5].get('isNull') else 'rotisserie_ytd'
            }
            
        except Exception as e:
            logger.error(f"Error getting league transaction rules: {str(e)}")
            raise

    @staticmethod
    def create_transaction_log_table(league_id: str) -> None:
        """Create transaction log table in the league database"""
        try:
            db_name = get_league_database_name(league_id)
            
            sql = """
                CREATE TABLE IF NOT EXISTS transactions (
                    transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    transaction_type VARCHAR(50) NOT NULL,
                    from_team_id UUID,
                    to_team_id UUID,
                    player_id INTEGER NOT NULL,
                    salary_change DECIMAL(8,2),
                    contract_change INTEGER,
                    transaction_date TIMESTAMP DEFAULT NOW(),
                    processed_date TIMESTAMP,
                    status VARCHAR(20) DEFAULT 'pending',
                    notes TEXT,
                    created_by VARCHAR(255)
                );
            """
            
            execute_sql(sql, {}, database_name=db_name)
            
        except Exception as e:
            logger.error(f"Error creating transaction log table: {str(e)}")
            raise

    @staticmethod
    def process_free_agent_pickup(league_id: str, team_id: str, player_id: int, 
                                salary: float = 1.0, contract_years: int = 1) -> Dict[str, Any]:
        """Process a free agent pickup"""
        try:
            # Import roster management service
            from league_services.roster_management import RosterManagementService
            
            # Check if player can be added
            can_add = RosterManagementService.can_add_player(league_id, team_id, player_id, salary)
            
            if not can_add['can_add']:
                return {
                    'success': False,
                    'transaction_type': 'free_agent_pickup',
                    'message': 'Cannot add player',
                    'reasons': can_add['reasons']
                }
            
            # Create transaction record in league database
            transaction_id = str(uuid4())
            db_name = get_league_database_name(league_id)
            
            TransactionService.create_transaction_log_table(league_id)
            
            transaction_sql = """
                INSERT INTO transactions 
                (transaction_id, transaction_type, to_team_id, player_id, salary_change, contract_change, status)
                VALUES (:transaction_id::uuid, :transaction_type, :team_id::uuid, :player_id, :salary_change, :contract_change, :status)
            """
            
            execute_sql(transaction_sql, {
                'transaction_id': transaction_id,
                'transaction_type': 'free_agent_pickup',
                'team_id': team_id,
                'player_id': player_id,
                'salary_change': salary,
                'contract_change': contract_years,
                'status': 'completed'
            }, database_name=db_name)
            
            # Add player to roster
            add_result = RosterManagementService.add_player_to_roster(
                league_id, team_id, player_id, salary, contract_years, 'bench'
            )
            
            if not add_result['success']:
                return {
                    'success': False,
                    'transaction_type': 'free_agent_pickup',
                    'message': add_result['message']
                }
            
            # Update transaction with completion
            complete_sql = """
                UPDATE transactions
                SET processed_date = NOW(), notes = :notes
                WHERE transaction_id = :transaction_id::uuid
            """
            
            execute_sql(complete_sql, {
                'transaction_id': transaction_id,
                'notes': 'Free agent pickup completed'
            }, database_name=db_name)
            
            logger.info(f"Free agent pickup: Player {player_id} added to team {team_id} in league {league_id}")
            
            return {
                'success': True,
                'transaction_type': 'free_agent_pickup',
                'transaction_id': transaction_id,
                'player_info': add_result['player_info'],
                'message': f'Player added to roster for ${salary}'
            }
            
        except Exception as e:
            logger.error(f"Error processing free agent pickup: {str(e)}")
            return {
                'success': False,
                'transaction_type': 'free_agent_pickup',
                'error': str(e)
            }

    @staticmethod
    def process_player_drop(league_id: str, team_id: str, player_id: int) -> Dict[str, Any]:
        """Process dropping a player from roster"""
        try:
            from league_services.roster_management import RosterManagementService
            
            # Create transaction record in league database
            transaction_id = str(uuid4())
            db_name = get_league_database_name(league_id)
            
            TransactionService.create_transaction_log_table(league_id)
            
            transaction_sql = """
                INSERT INTO transactions 
                (transaction_id, transaction_type, from_team_id, player_id, status)
                VALUES (:transaction_id::uuid, :transaction_type, :team_id::uuid, :player_id, :status)
            """
            
            execute_sql(transaction_sql, {
                'transaction_id': transaction_id,
                'transaction_type': 'drop',
                'team_id': team_id,
                'player_id': player_id,
                'status': 'completed'
            }, database_name=db_name)
            
            # Remove player from roster
            drop_result = RosterManagementService.remove_player_from_roster(league_id, team_id, player_id)
            
            if not drop_result['success']:
                return {
                    'success': False,
                    'transaction_type': 'drop',
                    'message': drop_result['message']
                }
            
            # Update transaction with completion
            complete_sql = """
                UPDATE transactions
                SET processed_date = NOW(), notes = :notes
                WHERE transaction_id = :transaction_id::uuid
            """
            
            execute_sql(complete_sql, {
                'transaction_id': transaction_id,
                'notes': 'Player drop completed'
            }, database_name=db_name)
            
            logger.info(f"Player drop: Player {player_id} dropped from team {team_id} in league {league_id}")
            
            return {
                'success': True,
                'transaction_type': 'drop',
                'transaction_id': transaction_id,
                'message': 'Player dropped from roster'
            }
            
        except Exception as e:
            logger.error(f"Error processing player drop: {str(e)}")
            return {
                'success': False,
                'transaction_type': 'drop',
                'error': str(e)
            }

    @staticmethod
    def create_trade_proposal(league_id: str, from_team_id: str, to_team_id: str, 
                            trade_details: Dict[str, Any]) -> Dict[str, Any]:
        """Create a trade proposal between teams"""
        try:
            trade_id = str(uuid4())
            db_name = get_league_database_name(league_id)
            
            TransactionService.create_transaction_log_table(league_id)
            
            # Validate trade details
            from_players = trade_details.get('from_players', [])
            to_players = trade_details.get('to_players', [])
            
            if not from_players and not to_players:
                return {
                    'success': False,
                    'message': 'Trade must include at least one player'
                }
            
            # Create trade proposal record in league database
            proposal_sql = """
                INSERT INTO transactions 
                (transaction_id, transaction_type, from_team_id, to_team_id, status, notes)
                VALUES (:transaction_id::uuid, :transaction_type, :from_team_id::uuid, :to_team_id::uuid, :status, :notes)
            """
            
            execute_sql(proposal_sql, {
                'transaction_id': trade_id,
                'transaction_type': 'trade_proposal',
                'from_team_id': from_team_id,
                'to_team_id': to_team_id,
                'status': 'pending',
                'notes': json.dumps(trade_details)
            }, database_name=db_name)
            
            # Create individual transaction records for each player in trade
            for player_id in from_players:
                player_trade_id = str(uuid4())
                player_sql = """
                    INSERT INTO transactions 
                    (transaction_id, transaction_type, from_team_id, to_team_id, player_id, status, notes)
                    VALUES (:transaction_id::uuid, :transaction_type, :from_team_id::uuid, :to_team_id::uuid, :player_id, :status, :notes)
                """
                execute_sql(player_sql, {
                    'transaction_id': player_trade_id,
                    'transaction_type': 'trade_player',
                    'from_team_id': from_team_id,
                    'to_team_id': to_team_id,
                    'player_id': player_id,
                    'status': 'pending',
                    'notes': f'Part of trade {trade_id}'
                }, database_name=db_name)
            
            for player_id in to_players:
                player_trade_id = str(uuid4())
                player_sql = """
                    INSERT INTO transactions 
                    (transaction_id, transaction_type, from_team_id, to_team_id, player_id, status, notes)
                    VALUES (:transaction_id::uuid, :transaction_type, :from_team_id::uuid, :to_team_id::uuid, :player_id, :status, :notes)
                """
                execute_sql(player_sql, {
                    'transaction_id': player_trade_id,
                    'transaction_type': 'trade_player',
                    'from_team_id': to_team_id,
                    'to_team_id': from_team_id,
                    'player_id': player_id,
                    'status': 'pending',
                    'notes': f'Part of trade {trade_id}'
                }, database_name=db_name)
            
            logger.info(f"Trade proposal created: {trade_id} between teams {from_team_id} and {to_team_id}")
            
            return {
                'success': True,
                'transaction_type': 'trade_proposal',
                'trade_id': trade_id,
                'message': 'Trade proposal created',
                'trade_details': trade_details
            }
            
        except Exception as e:
            logger.error(f"Error creating trade proposal: {str(e)}")
            return {
                'success': False,
                'transaction_type': 'trade_proposal',
                'error': str(e)
            }

    @staticmethod
    def process_trade_acceptance(league_id: str, trade_id: str, accepting_team_id: str) -> Dict[str, Any]:
        """Process acceptance of a trade proposal"""
        try:
            from league_services.roster_management import RosterManagementService
            
            db_name = get_league_database_name(league_id)
            
            # Get trade details from league database
            trade_sql = """
                SELECT from_team_id, to_team_id, notes, status
                FROM transactions
                WHERE transaction_id = :trade_id::uuid AND transaction_type = :transaction_type
            """
            
            trade_response = execute_sql(trade_sql, {
                'trade_id': trade_id,
                'transaction_type': 'trade_proposal'
            }, database_name=db_name)
            
            if not trade_response.get('records'):
                return {
                    'success': False,
                    'message': 'Trade proposal not found'
                }
            
            trade_record = trade_response['records'][0]
            from_team = trade_record[0].get('stringValue') if trade_record[0] and not trade_record[0].get('isNull') else None
            to_team = trade_record[1].get('stringValue') if trade_record[1] and not trade_record[1].get('isNull') else None
            trade_details_str = trade_record[2].get('stringValue', '{}') if trade_record[2] and not trade_record[2].get('isNull') else '{}'
            status = trade_record[3].get('stringValue') if trade_record[3] and not trade_record[3].get('isNull') else None
            
            if status != 'pending':
                return {
                    'success': False,
                    'message': f'Trade is already {status}'
                }
            
            # Verify accepting team is part of the trade
            if accepting_team_id not in [from_team, to_team]:
                return {
                    'success': False,
                    'message': 'Team is not part of this trade'
                }
            
            trade_details = json.loads(trade_details_str)
            
            # Process player swaps
            from_players = trade_details.get('from_players', [])
            to_players = trade_details.get('to_players', [])
            
            # Move players from from_team to to_team
            for player_id in from_players:
                # Remove from from_team
                RosterManagementService.remove_player_from_roster(league_id, from_team, player_id)
                # Add to to_team
                RosterManagementService.add_player_to_roster(league_id, to_team, player_id, 1.0, 1, 'bench')
            
            # Move players from to_team to from_team
            for player_id in to_players:
                # Remove from to_team
                RosterManagementService.remove_player_from_roster(league_id, to_team, player_id)
                # Add to from_team
                RosterManagementService.add_player_to_roster(league_id, from_team, player_id, 1.0, 1, 'bench')
            
            # Update trade status in league database
            complete_sql = """
                UPDATE transactions
                SET 
                    status = :status,
                    processed_date = NOW(),
                    notes = notes || :completion_note
                WHERE transaction_id = :trade_id::uuid
            """
            
            execute_sql(complete_sql, {
                'status': 'completed',
                'completion_note': ' - Trade completed',
                'trade_id': trade_id
            }, database_name=db_name)
            
            # Update related player transaction records
            update_players_sql = """
                UPDATE transactions
                SET 
                    status = :status,
                    processed_date = NOW()
                WHERE notes LIKE :pattern
            """
            
            execute_sql(update_players_sql, {
                'status': 'completed',
                'pattern': f'%Part of trade {trade_id}%'
            }, database_name=db_name)
            
            logger.info(f"Trade completed: {trade_id} in league {league_id}")
            
            return {
                'success': True,
                'transaction_type': 'trade_completion',
                'trade_id': trade_id,
                'message': 'Trade completed successfully',
                'players_moved': len(from_players) + len(to_players)
            }
            
        except Exception as e:
            logger.error(f"Error processing trade acceptance: {str(e)}")
            return {
                'success': False,
                'transaction_type': 'trade_completion',
                'error': str(e)
            }

    @staticmethod
    def process_waiver_claim(league_id: str, team_id: str, player_id: int, 
                           waiver_priority: int, salary: float = 1.0) -> Dict[str, Any]:
        """Process a waiver claim"""
        try:
            # Check league waiver rules from main database
            rules = TransactionService.get_league_transaction_rules(league_id)
            
            if not rules['use_waivers']:
                return {
                    'success': False,
                    'message': 'This league does not use waivers'
                }
            
            waiver_id = str(uuid4())
            db_name = get_league_database_name(league_id)
            
            TransactionService.create_transaction_log_table(league_id)
            
            # Create waiver claim record in league database
            claim_sql = """
                INSERT INTO transactions 
                (transaction_id, transaction_type, to_team_id, player_id, salary_change, status, notes)
                VALUES (:transaction_id::uuid, :transaction_type, :team_id::uuid, :player_id, :salary_change, :status, :notes)
            """
            
            execute_sql(claim_sql, {
                'transaction_id': waiver_id,
                'transaction_type': 'waiver_claim',
                'team_id': team_id,
                'player_id': player_id,
                'salary_change': salary,
                'status': 'pending',
                'notes': f'Waiver priority: {waiver_priority}'
            }, database_name=db_name)
            
            logger.info(f"Waiver claim submitted: Player {player_id} by team {team_id} in league {league_id}")
            
            return {
                'success': True,
                'transaction_type': 'waiver_claim',
                'waiver_id': waiver_id,
                'message': 'Waiver claim submitted',
                'waiver_priority': waiver_priority,
                'player_id': player_id
            }
            
        except Exception as e:
            logger.error(f"Error processing waiver claim: {str(e)}")
            return {
                'success': False,
                'transaction_type': 'waiver_claim',
                'error': str(e)
            }

    @staticmethod
    def get_transaction_history(league_id: str, filters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Get transaction history for the league"""
        try:
            db_name = get_league_database_name(league_id)
            
            # Check if transactions table exists in league database
            check_sql = """
                SELECT COUNT(*) FROM information_schema.tables 
                WHERE table_name = 'transactions' AND table_schema = 'public'
            """
            
            check_response = execute_sql(check_sql, {}, database_name=db_name)
            if not check_response.get('records') or check_response['records'][0][0].get('longValue', 0) == 0:
                return []
            
            if filters is None:
                filters = {}
            
            # Build WHERE clause with parameterized queries
            where_conditions = ["1=1"]  # Base condition
            params = {}
            
            transaction_type = filters.get('transaction_type')
            if transaction_type:
                where_conditions.append("transaction_type = :transaction_type")
                params['transaction_type'] = transaction_type
            
            team_id = filters.get('team_id')
            if team_id:
                where_conditions.append("(from_team_id = :team_id::uuid OR to_team_id = :team_id::uuid)")
                params['team_id'] = team_id
            
            status = filters.get('status')
            if status:
                where_conditions.append("status = :status")
                params['status'] = status
            
            # Date range
            days_back = filters.get('days_back', 30)
            where_conditions.append("transaction_date > NOW() - INTERVAL ':days_back days'")
            params['days_back'] = days_back
            
            where_clause = " AND ".join(where_conditions)
            
            # Pagination
            limit = filters.get('limit', 100)
            offset = filters.get('offset', 0)
            params['limit'] = limit
            params['offset'] = offset
            
            sql = f"""
                SELECT 
                    transaction_id,
                    transaction_type,
                    from_team_id,
                    to_team_id,
                    player_id,
                    salary_change,
                    contract_change,
                    transaction_date,
                    processed_date,
                    status,
                    notes,
                    created_by
                FROM transactions
                WHERE {where_clause}
                ORDER BY transaction_date DESC
                LIMIT :limit OFFSET :offset
            """
            
            response = execute_sql(sql, params, database_name=db_name)
            
            transactions = []
            if response.get('records'):
                for record in response['records']:
                    transaction = {
                        'transaction_id': record[0].get('stringValue') if record[0] and not record[0].get('isNull') else None,
                        'transaction_type': record[1].get('stringValue') if record[1] and not record[1].get('isNull') else '',
                        'from_team_id': record[2].get('stringValue') if record[2] and not record[2].get('isNull') else None,
                        'to_team_id': record[3].get('stringValue') if record[3] and not record[3].get('isNull') else None,
                        'player_id': record[4].get('longValue') if record[4] and not record[4].get('isNull') else None,
                        'salary_change': record[5].get('doubleValue') if record[5] and not record[5].get('isNull') else None,
                        'contract_change': record[6].get('longValue') if record[6] and not record[6].get('isNull') else None,
                        'transaction_date': record[7].get('stringValue') if record[7] and not record[7].get('isNull') else None,
                        'processed_date': record[8].get('stringValue') if record[8] and not record[8].get('isNull') else None,
                        'status': record[9].get('stringValue') if record[9] and not record[9].get('isNull') else '',
                        'notes': record[10].get('stringValue') if record[10] and not record[10].get('isNull') else '',
                        'created_by': record[11].get('stringValue') if record[11] and not record[11].get('isNull') else None
                    }
                    transactions.append(transaction)
            
            return transactions
            
        except Exception as e:
            logger.error(f"Error getting transaction history: {str(e)}")
            return []

    @staticmethod
    def get_pending_transactions(league_id: str) -> List[Dict[str, Any]]:
        """Get all pending transactions that need processing"""
        try:
            return TransactionService.get_transaction_history(
                league_id, 
                {'status': 'pending', 'limit': 50}
            )
            
        except Exception as e:
            logger.error(f"Error getting pending transactions: {str(e)}")
            return []

    @staticmethod
    def cancel_transaction(league_id: str, transaction_id: str, cancelling_user: str) -> Dict[str, Any]:
        """Cancel a pending transaction"""
        try:
            db_name = get_league_database_name(league_id)
            
            # Check if transaction exists and is pending in league database
            check_sql = """
                SELECT status, transaction_type FROM transactions
                WHERE transaction_id = :transaction_id::uuid
            """
            
            check_response = execute_sql(check_sql, {
                'transaction_id': transaction_id
            }, database_name=db_name)
            
            if not check_response.get('records'):
                return {
                    'success': False,
                    'message': 'Transaction not found'
                }
            
            record = check_response['records'][0]
            status = record[0].get('stringValue') if record[0] and not record[0].get('isNull') else None
            transaction_type = record[1].get('stringValue') if record[1] and not record[1].get('isNull') else None
            
            if status != 'pending':
                return {
                    'success': False,
                    'message': f'Cannot cancel {status} transaction'
                }
            
            # Cancel the transaction in league database
            cancel_sql = """
                UPDATE transactions
                SET 
                    status = :status,
                    processed_date = NOW(),
                    notes = COALESCE(notes, '') || :cancellation_note
                WHERE transaction_id = :transaction_id::uuid
            """
            
            execute_sql(cancel_sql, {
                'status': 'cancelled',
                'cancellation_note': f' - Cancelled by {cancelling_user}',
                'transaction_id': transaction_id
            }, database_name=db_name)
            
            logger.info(f"Transaction cancelled: {transaction_id} by {cancelling_user}")
            
            return {
                'success': True,
                'transaction_id': transaction_id,
                'transaction_type': transaction_type,
                'message': 'Transaction cancelled successfully'
            }
            
        except Exception as e:
            logger.error(f"Error cancelling transaction: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    @staticmethod
    def validate_transaction_deadline(league_id: str) -> Dict[str, Any]:
        """Check if transactions are currently allowed based on league deadlines"""
        try:
            # Get rules from main database
            rules = TransactionService.get_league_transaction_rules(league_id)
            
            current_time = datetime.now()
            deadline_day = rules['transaction_deadline'].lower()
            
            # Simple deadline validation (can be enhanced with specific time rules)
            is_allowed = True
            message = "Transactions are currently allowed"
            
            # Check if we're in season
            if rules['season_start_date'] and rules['season_end_date']:
                season_start = datetime.fromisoformat(rules['season_start_date'])
                season_end = datetime.fromisoformat(rules['season_end_date'])
                
                if current_time < season_start:
                    is_allowed = False
                    message = "Transactions not allowed - season hasn't started"
                elif current_time > season_end:
                    is_allowed = False
                    message = "Transactions not allowed - season has ended"
            
            # Check weekly deadline (basic implementation)
            current_weekday = current_time.strftime('%A').lower()
            
            if deadline_day != 'none' and current_weekday == deadline_day:
                # Could add specific time checks here
                pass
            
            return {
                'transactions_allowed': is_allowed,
                'message': message,
                'deadline_day': deadline_day,
                'current_day': current_weekday,
                'current_time': current_time.isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error validating transaction deadline: {str(e)}")
            return {
                'transactions_allowed': False,
                'message': f'Error checking deadlines: {str(e)}'
            }