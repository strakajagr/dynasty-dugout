"""
Dynasty Dugout - Salary Settings Module
Handle salary cap settings and league configuration
"""

import logging
import json
from fastapi import APIRouter, HTTPException, Depends
from core.auth_utils import get_current_user
from core.database import execute_sql, batch_execute_sql
from core.cache import cached, invalidate_cache_pattern
from .models import SalarySettings

logger = logging.getLogger(__name__)
router = APIRouter()

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def verify_commissioner(league_id: str, user_id: str) -> bool:
    """Verify user is commissioner of the league"""
    try:
        result = execute_sql(
            "SELECT commissioner_user_id FROM user_leagues WHERE league_id = :league_id::uuid",
            {'league_id': league_id},
            database_name='postgres'
        )
        if result and result.get('records'):
            commissioner_id = result['records'][0].get('commissioner_user_id')
            return commissioner_id == user_id
        return False
    except Exception as e:
        logger.error(f"Error verifying commissioner: {e}")
        return False

async def validate_league_membership(league_id: str, user_id: str) -> bool:
    """Check if user is a member of this league"""
    try:
        membership_check = execute_sql(
            "SELECT user_id FROM league_memberships WHERE league_id = :league_id::uuid AND user_id = :user_id",
            parameters={'league_id': league_id, 'user_id': user_id},
            database_name='postgres'
        )
        if membership_check and membership_check.get("records"):
            return True
        return False
    except Exception as e:
        logger.error(f"League membership validation error: {str(e)}")
        return False

# =============================================================================
# SALARY SETTINGS ENDPOINTS
# =============================================================================

@router.get("/{league_id}/salaries/settings")
@cached(ttl_seconds=600, key_prefix='salary_settings', key_params=['league_id'])
async def get_salary_settings(
    league_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get current salary cap and pricing settings for the league
    
    CACHED: 10 minute TTL - Settings don't change often
    """
    try:
        user_id = current_user.get('sub') or current_user.get('username')
        
        # Validate membership
        if not await validate_league_membership(league_id, user_id):
            raise HTTPException(status_code=403, detail="Not a member of this league")
        
        # Get salary settings
        settings_query = """
            SELECT setting_name, setting_value
            FROM league_settings
            WHERE league_id = :league_id::uuid
            AND setting_name IN (
                'salary_cap', 'draft_cap', 'season_cap', 
                'min_salary', 'salary_increment', 'rookie_price',
                'use_dual_cap', 'standard_contract_length',
                'draft_cap_usage', 'extension_rules', 'pricing_method'
            )
        """
        
        result = execute_sql(
            settings_query,
            {'league_id': league_id},
            database_name='leagues'  # SHARED DATABASE
        )
        
        settings = SalarySettings()
        
        if result and result.get('records'):
            for record in result['records']:
                setting_name = record.get('setting_name')
                setting_value = record.get('setting_value')
                
                # Skip if setting_value is None
                if setting_value is None:
                    logger.warning(f"Setting {setting_name} has None value, using default")
                    continue
                
                try:
                    if setting_name == 'salary_cap':
                        settings.salary_cap = float(setting_value)
                        settings.total_cap = float(setting_value)
                    elif setting_name == 'draft_cap':
                        settings.draft_cap = float(setting_value)
                    elif setting_name == 'season_cap':
                        settings.season_cap = float(setting_value)
                    elif setting_name == 'min_salary':
                        settings.min_salary = float(setting_value)
                    elif setting_name == 'salary_increment':
                        settings.salary_increment = float(setting_value)
                    elif setting_name == 'rookie_price':
                        settings.rookie_price = float(setting_value)
                    elif setting_name == 'use_dual_cap':
                        settings.use_dual_cap = setting_value.lower() == 'true'
                    elif setting_name == 'standard_contract_length':
                        settings.standard_contract_length = int(setting_value)
                    elif setting_name == 'draft_cap_usage':
                        settings.draft_cap_usage = float(setting_value)
                    elif setting_name == 'extension_rules':
                        try:
                            settings.extension_rules = json.loads(setting_value)
                        except:
                            settings.extension_rules = []
                    elif setting_name == 'pricing_method':
                        settings.pricing_method = setting_value
                except (ValueError, TypeError) as e:
                    logger.error(f"Error converting setting {setting_name}={setting_value}: {e}")
                    continue
        
        return {
            "success": True,
            "settings": settings.dict()
        }
        
    except Exception as e:
        logger.error(f"Error getting salary settings: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{league_id}/salaries/settings")
async def update_salary_settings(
    league_id: str,
    settings: SalarySettings,
    current_user: dict = Depends(get_current_user)
):
    """Update salary cap and pricing settings (commissioner only) - OPTIMIZED with batch operations"""
    try:
        user_id = current_user.get('sub') or current_user.get('username')
        
        # Verify commissioner
        if not verify_commissioner(league_id, user_id):
            raise HTTPException(status_code=403, detail="Only commissioner can update salary settings")
        
        # Prepare batch parameters for all settings
        settings_params = []
        settings_to_update = [
            ('salary_cap', str(settings.salary_cap)),
            ('draft_cap', str(settings.draft_cap)),
            ('season_cap', str(settings.season_cap)),
            ('min_salary', str(settings.min_salary)),
            ('salary_increment', str(settings.salary_increment)),
            ('rookie_price', str(settings.rookie_price)),
            ('use_dual_cap', str(settings.use_dual_cap)),
            ('standard_contract_length', str(settings.standard_contract_length)),
            ('draft_cap_usage', str(settings.draft_cap_usage)),
            ('extension_rules', json.dumps(settings.extension_rules)),
            ('pricing_method', settings.pricing_method or 'adaptive')
        ]
        
        for setting_name, setting_value in settings_to_update:
            settings_params.append({
                'league_id': league_id,
                'setting_name': setting_name,
                'setting_value': setting_value
            })
        
        # Batch update all settings in one operation
        batch_execute_sql(
            """
            INSERT INTO league_settings (league_id, setting_name, setting_value, updated_at)
            VALUES (:league_id::uuid, :setting_name, :setting_value, NOW())
            ON CONFLICT (league_id, setting_name) 
            DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW()
            """,
            settings_params,
            database_name='leagues'
        )
        
        # Invalidate settings cache for this league
        invalidate_cache_pattern(f'salary_settings:{league_id}')
        logger.info(f"Invalidated salary settings cache for league {league_id}")
        
        return {
            "success": True,
            "message": "Salary settings updated successfully",
            "settings": settings.dict()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating salary settings: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))