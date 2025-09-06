"""
Dynasty Dugout - Async Price Save Jobs Module
Handle large dataset price saves with background processing
"""

import logging
import json
import boto3
import os
import traceback
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from core.auth_utils import get_current_user
from core.database import execute_sql, batch_execute_sql
from .models import SavePricesAsyncRequest, PriceSaveJobStatus
from .settings import verify_commissioner

logger = logging.getLogger(__name__)
router = APIRouter()

# Thread pool for background tasks
executor = ThreadPoolExecutor(max_workers=3)

# Lambda client for invoking background jobs (if in AWS)
lambda_client = None
if os.environ.get('AWS_REGION'):
    lambda_client = boto3.client('lambda', region_name=os.environ.get('AWS_REGION'))

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def ensure_price_jobs_table():
    """Ensure the price save jobs table exists"""
    try:
        logger.info("Ensuring price_save_jobs table exists...")
        execute_sql("""
            CREATE TABLE IF NOT EXISTS price_save_jobs (
                job_id UUID PRIMARY KEY,
                league_id UUID NOT NULL,
                user_id VARCHAR(255) NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                progress INTEGER DEFAULT 0,
                total_players INTEGER DEFAULT 0,
                processed_players INTEGER DEFAULT 0,
                message TEXT,
                error_message TEXT,
                settings JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """, database_name='postgres')
        logger.info("price_save_jobs table check completed")
    except Exception as e:
        logger.error(f"Could not create price_save_jobs table: {e}")
        logger.error(traceback.format_exc())
        raise  # Re-raise the exception so it fails loudly

# Initialize table on module load
ensure_price_jobs_table()

# =============================================================================
# ASYNC PRICE SAVE ENDPOINTS
# =============================================================================

@router.post("/{league_id}/salaries/prices/async")
async def save_player_prices_async(
    league_id: str,
    request: SavePricesAsyncRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Start async job to save player prices (for large datasets)"""
    try:
        user_id = current_user.get('sub') or current_user.get('username')
        
        # Verify commissioner
        if not verify_commissioner(league_id, user_id):
            raise HTTPException(status_code=403, detail="Only commissioner can update player prices")
        
        # Create job ID
        job_id = request.job_id or str(uuid4())
        
        # Debug logging
        logger.info(f"Starting async price save job: job_id={job_id}, league_id={league_id}, user_id={user_id}")
        logger.info(f"Total players to save: {len(request.prices)}")
        logger.info(f"Settings to save: {request.settings.dict()}")
        
        # Serialize settings to JSON string
        settings_json = json.dumps(request.settings.dict())
        logger.info(f"Serialized settings JSON: {settings_json}")
        
        # Insert job record with detailed error handling
        try:
            insert_result = execute_sql(
                """
                INSERT INTO price_save_jobs (
                    job_id, league_id, user_id, status, total_players,
                    settings, created_at, updated_at
                ) VALUES (
                    :job_id::uuid, :league_id::uuid, :user_id, 'pending', :total,
                    :settings::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )
                """,
                {
                    'job_id': job_id,
                    'league_id': league_id,
                    'user_id': user_id,
                    'total': len(request.prices),
                    'settings': settings_json
                },
                database_name='postgres'
            )
            logger.info(f"Job record inserted successfully: {insert_result}")
        except Exception as insert_error:
            logger.error(f"Failed to insert job record: {insert_error}")
            logger.error(f"Insert error traceback: {traceback.format_exc()}")
            raise HTTPException(status_code=500, detail=f"Failed to start async save job: {str(insert_error)}")
        
        # Add background task
        background_tasks.add_task(
            process_price_save_job,
            job_id,
            league_id,
            request,
            user_id
        )
        
        return {
            "success": True,
            "job_id": job_id,
            "message": f"Started async price save job for {len(request.prices)} players",
            "status_url": f"/api/leagues/{league_id}/salaries/job/{job_id}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting async price save: {str(e)}")
        logger.error(f"Full traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Failed to start async save job: {str(e)}")

@router.get("/{league_id}/salaries/job/{job_id}")
async def get_price_save_job_status(
    league_id: str,
    job_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get status of async price save job"""
    try:
        result = execute_sql(
            """
            SELECT 
                status, progress, total_players, processed_players,
                message, error_message, created_at, updated_at
            FROM price_save_jobs
            WHERE job_id = :job_id::uuid AND league_id = :league_id::uuid
            """,
            {'job_id': job_id, 'league_id': league_id},
            database_name='postgres'
        )
        
        if not result or not result.get('records'):
            raise HTTPException(status_code=404, detail="Job not found")
        
        record = result['records'][0]
        
        return PriceSaveJobStatus(
            job_id=job_id,
            status=record[0].get('stringValue'),
            progress=record[1].get('longValue', 0),
            total_players=record[2].get('longValue', 0),
            processed_players=record[3].get('longValue', 0),
            message=record[4].get('stringValue'),
            error=record[5].get('stringValue'),
            created_at=record[6].get('stringValue'),
            updated_at=record[7].get('stringValue')
        ).dict()
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting job status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# =============================================================================
# BACKGROUND TASK PROCESSOR
# =============================================================================

async def process_price_save_job(
    job_id: str,
    league_id: str,
    request: SavePricesAsyncRequest,
    user_id: str
):
    """Process price save job in background - OPTIMIZED with batch operations"""
    try:
        logger.info(f"Processing price save job {job_id} for league {league_id}")
        
        # Update job status to processing
        execute_sql(
            """
            UPDATE price_save_jobs 
            SET status = 'processing', updated_at = CURRENT_TIMESTAMP
            WHERE job_id = :job_id::uuid
            """,
            {'job_id': job_id},
            database_name='postgres'
        )
        
        # Save settings first (convert to batch format)
        settings_params = []
        settings_dict = request.settings.dict()
        for setting_name, setting_value in settings_dict.items():
            if isinstance(setting_value, (list, dict)):
                setting_value = json.dumps(setting_value)
            else:
                setting_value = str(setting_value)
            
            settings_params.append({
                'league_id': league_id,
                'setting_name': setting_name,
                'setting_value': setting_value
            })
        
        # Batch save all settings
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
        
        # Prepare all price parameters for batch operation
        price_params = []
        for player_price in request.prices:
            price_params.append({
                'league_id': league_id,
                'player_id': player_price.player_id,
                'price': player_price.price,
                'tier': player_price.tier or '',
                'manual_override': player_price.manual_override or False,
                'pricing_method': request.method
            })
        
        # Single batch operation for ALL prices
        batch_execute_sql(
            """
            INSERT INTO player_prices (
                league_id, player_id, price, tier, 
                manual_override, pricing_method, updated_at
            ) VALUES (
                :league_id::uuid, :player_id, :price, :tier,
                :manual_override, :pricing_method, NOW()
            )
            ON CONFLICT (league_id, player_id)
            DO UPDATE SET 
                price = EXCLUDED.price,
                tier = EXCLUDED.tier,
                manual_override = EXCLUDED.manual_override,
                pricing_method = EXCLUDED.pricing_method,
                updated_at = NOW()
            """,
            price_params,
            database_name='leagues'
        )
        
        # Mark job as completed
        execute_sql(
            """
            UPDATE price_save_jobs 
            SET status = 'completed', 
                progress = 100,
                processed_players = :total,
                message = 'All player prices saved successfully',
                updated_at = CURRENT_TIMESTAMP
            WHERE job_id = :job_id::uuid
            """,
            {'job_id': job_id, 'total': len(request.prices)},
            database_name='postgres'
        )
        
        logger.info(f"Successfully completed price save job {job_id}")
        
    except Exception as e:
        logger.error(f"Error in background price save: {str(e)}")
        logger.error(f"Background task traceback: {traceback.format_exc()}")
        
        # Mark job as failed
        execute_sql(
            """
            UPDATE price_save_jobs 
            SET status = 'failed',
                error_message = :error,
                updated_at = CURRENT_TIMESTAMP
            WHERE job_id = :job_id::uuid
            """,
            {'job_id': job_id, 'error': str(e)},
            database_name='postgres'
        )