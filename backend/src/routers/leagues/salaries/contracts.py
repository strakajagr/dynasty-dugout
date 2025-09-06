"""
Dynasty Dugout - Contract Management Module
Handle individual contract updates, extensions, and bulk operations
"""

import logging
from fastapi import APIRouter, HTTPException, Depends
from core.auth_utils import get_current_user
from core.database import execute_sql, batch_execute_sql, execute_transaction
from .models import PlayerContract, ContractExtension, BulkContractUpdate
from .settings import verify_commissioner

logger = logging.getLogger(__name__)
router = APIRouter()

# =============================================================================
# CONTRACT MANAGEMENT ENDPOINTS
# =============================================================================

@router.post("/{league_id}/salaries/contracts/update")
async def update_player_contract(
    league_id: str,
    contract: PlayerContract,
    current_user: dict = Depends(get_current_user)
):
    """Update a player's contract (commissioner only)"""
    try:
        user_id = current_user.get('sub') or current_user.get('username')
        
        # Verify commissioner
        if not verify_commissioner(league_id, user_id):
            raise HTTPException(status_code=403, detail="Only commissioner can update contracts")
        
        # Update contract
        execute_sql(
            """
            UPDATE league_players
            SET salary = :salary,
                contract_years = :contract_years,
                updated_at = NOW()
            WHERE league_id = :league_id::uuid
                AND league_player_id = :league_player_id::uuid
            """,
            {
                'league_id': league_id,
                'league_player_id': contract.league_player_id,
                'salary': contract.salary,
                'contract_years': contract.contract_years
            },
            database_name='leagues'  # SHARED DATABASE
        )
        
        return {
            "success": True,
            "message": "Contract updated successfully",
            "contract": contract.dict()
        }
        
    except Exception as e:
        logger.error(f"Error updating contract: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{league_id}/salaries/contracts/bulk-update")
async def bulk_update_contracts(
    league_id: str,
    request: BulkContractUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Bulk update multiple player contracts (commissioner only) - OPTIMIZED with batch operations"""
    try:
        user_id = current_user.get('sub') or current_user.get('username')
        
        # Verify commissioner
        if not verify_commissioner(league_id, user_id):
            raise HTTPException(status_code=403, detail="Only commissioner can update contracts")
        
        # Prepare batch updates based on update type
        if request.update_type == 'salary':
            batch_params = [{
                'league_id': league_id,
                'league_player_id': contract.league_player_id,
                'salary': contract.salary
            } for contract in request.contracts]
            
            batch_execute_sql(
                """
                UPDATE league_players
                SET salary = :salary, updated_at = NOW()
                WHERE league_id = :league_id::uuid
                    AND league_player_id = :league_player_id::uuid
                """,
                batch_params,
                database_name='leagues'
            )
            
        elif request.update_type == 'years':
            batch_params = [{
                'league_id': league_id,
                'league_player_id': contract.league_player_id,
                'contract_years': contract.contract_years
            } for contract in request.contracts]
            
            batch_execute_sql(
                """
                UPDATE league_players
                SET contract_years = :contract_years, updated_at = NOW()
                WHERE league_id = :league_id::uuid
                    AND league_player_id = :league_player_id::uuid
                """,
                batch_params,
                database_name='leagues'
            )
            
        else:  # 'both'
            batch_params = [{
                'league_id': league_id,
                'league_player_id': contract.league_player_id,
                'salary': contract.salary,
                'contract_years': contract.contract_years
            } for contract in request.contracts]
            
            batch_execute_sql(
                """
                UPDATE league_players
                SET salary = :salary,
                    contract_years = :contract_years,
                    updated_at = NOW()
                WHERE league_id = :league_id::uuid
                    AND league_player_id = :league_player_id::uuid
                """,
                batch_params,
                database_name='leagues'
            )
        
        return {
            "success": True,
            "message": f"Updated {len(request.contracts)} contracts",
            "updated_count": len(request.contracts)
        }
        
    except Exception as e:
        logger.error(f"Error bulk updating contracts: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{league_id}/salaries/contracts/extend")
async def extend_player_contract(
    league_id: str,
    extension: ContractExtension,
    current_user: dict = Depends(get_current_user)
):
    """Extend a player's contract (commissioner only) - Uses transaction for consistency"""
    try:
        user_id = current_user.get('sub') or current_user.get('username')
        
        # Verify commissioner
        if not verify_commissioner(league_id, user_id):
            raise HTTPException(status_code=403, detail="Only commissioner can extend contracts")
        
        # Use transaction to ensure both operations complete
        transaction_statements = [
            {
                'sql': """
                    UPDATE league_players
                    SET salary = :new_salary,
                        contract_years = :new_years,
                        updated_at = NOW()
                    WHERE league_id = :league_id::uuid
                        AND league_player_id = :league_player_id::uuid
                """,
                'parameters': {
                    'league_id': league_id,
                    'league_player_id': extension.league_player_id,
                    'new_salary': extension.new_salary,
                    'new_years': extension.new_years
                }
            },
            {
                'sql': """
                    INSERT INTO contract_extensions (
                        league_id, league_player_id, extension_type,
                        new_salary, new_years, extension_date
                    ) VALUES (
                        :league_id::uuid, :league_player_id::uuid, :extension_type,
                        :new_salary, :new_years, NOW()
                    )
                """,
                'parameters': {
                    'league_id': league_id,
                    'league_player_id': extension.league_player_id,
                    'extension_type': extension.extension_type,
                    'new_salary': extension.new_salary,
                    'new_years': extension.new_years
                }
            }
        ]
        
        execute_transaction(transaction_statements, database_name='leagues')
        
        return {
            "success": True,
            "message": "Contract extended successfully",
            "extension": extension.dict()
        }
        
    except Exception as e:
        logger.error(f"Error extending contract: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))