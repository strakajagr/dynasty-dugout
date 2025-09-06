"""
Dynasty Dugout - Transaction Helper Functions
Shared utilities for all transaction operations
"""

from typing import Optional
from datetime import date, timedelta
from core.database import execute_sql
import logging
import uuid

logger = logging.getLogger(__name__)

def get_user_team_id(league_id: str, user_id: str) -> Optional[str]:
    """Get the team ID for a user in a specific league"""
    try:
        result = execute_sql(
            """SELECT team_id FROM league_teams 
               WHERE league_id = :league_id::uuid AND user_id = :user_id""",
            parameters={'league_id': league_id, 'user_id': user_id},
            database_name='leagues'  # SHARED DATABASE
        )
        
        if result and result.get("records") and len(result["records"]) > 0:
            return result["records"][0][0]["stringValue"]
        return None
    except Exception as e:
        logger.error(f"Error getting user team ID: {e}", exc_info=True)
        return None

def log_transaction(league_id: str, transaction_data: dict):
    """Log a transaction to the league_transactions table"""
    try:
        # Add league_id to transaction data
        transaction_data['league_id'] = league_id
        
        execute_sql(
            """
            INSERT INTO league_transactions
            (transaction_id, league_id, league_player_id, from_team_id, to_team_id, transaction_type,
             salary, contract_years, transaction_date, notes)
            VALUES (:transaction_id::uuid, :league_id::uuid, :league_player_id::uuid, :from_team_id::uuid, :to_team_id::uuid,
                    :transaction_type, :salary, :contract_years, :transaction_date::timestamp, :notes)
            """,
            parameters=transaction_data,
            database_name='leagues'  # SHARED DATABASE
        )
    except Exception as e:
        logger.error(f"Error logging transaction: {e}", exc_info=True)

def record_roster_status_change(league_id: str, league_player_id: str, team_id: str, 
                               new_status: str, user_id: str, reason: str = None):
    """Record roster status change in history table"""
    try:
        today = date.today()
        
        # End current status period
        execute_sql(
            """UPDATE roster_status_history 
               SET end_date = :yesterday 
               WHERE league_id = :league_id::uuid
                 AND league_player_id = :player_id::uuid 
                 AND end_date IS NULL""",
            {'league_id': league_id, 'player_id': league_player_id, 'yesterday': today - timedelta(days=1)},
            database_name='leagues'  # SHARED DATABASE
        )
        
        # Start new status period
        execute_sql(
            """INSERT INTO roster_status_history 
               (league_id, league_player_id, team_id, roster_status, effective_date, changed_by, change_reason)
               VALUES (:league_id::uuid, :player_id::uuid, :team_id::uuid, :status, :today, :user_id, :reason)""",
            {
                'league_id': league_id,
                'player_id': league_player_id,
                'team_id': team_id,
                'status': new_status,
                'today': today,
                'user_id': user_id,
                'reason': reason
            },
            database_name='leagues'  # SHARED DATABASE
        )
    except Exception as e:
        logger.error(f"Error recording roster status change: {e}")

def get_value_from_field(field, value_type='long'):
    """Helper function to extract values from AWS RDS Data API response fields"""
    if not field:
        return 0 if value_type != 'string' else ""
    
    if value_type == 'long':
        return field.get("longValue", 0) or field.get("intValue", 0)
    elif value_type == 'decimal':
        # DECIMAL/NUMERIC types come as stringValue from AWS RDS Data API
        val = field.get("stringValue")
        if val:
            try:
                return float(val)
            except:
                pass
        # Fallback to doubleValue if exists
        return field.get("doubleValue", 0.0) or field.get("floatValue", 0.0)
    elif value_type == 'string':
        return field.get("stringValue", "")
    return 0