"""
Dynasty Dugout - League Lifecycle Management Module
Creates new leagues using an asynchronous pattern to avoid API Gateway timeouts.
- /create: Immediately creates a league entry and triggers a worker Lambda.
- /creation-status: Allows the frontend to poll for completion status.
"""

import logging
import json
import os
import boto3
from uuid import uuid4
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from ...core.auth_utils import get_current_user
from ...core.database import execute_sql

logger = logging.getLogger(__name__)
router = APIRouter()

# AWS Lambda Client
lambda_client = boto3.client('lambda')
LEAGUE_WORKER_LAMBDA_NAME = os.environ.get('LEAGUE_WORKER_LAMBDA_NAME', 'league-creation-worker')

# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class LeagueCreateRequest(BaseModel):
    league_name: str = Field(..., min_length=3, max_length=255)
    use_salaries: bool = Field(default=True)
    use_contracts: bool = Field(default=True)
    max_teams: int = Field(default=12, ge=4, le=20)
    use_waivers: bool = Field(default=False)
    salary_cap: float = Field(default=260.0)

# =============================================================================
# ASYNCHRONOUS API ENDPOINTS
# =============================================================================

@router.post("/create", status_code=202)
async def create_league_async(league_data: LeagueCreateRequest, current_user: dict = Depends(get_current_user)):
    """
    Initiates league creation. Creates an immediate record and triggers a background worker.
    Returns a 202 Accepted response with a URL to poll for status.
    """
    user_id = current_user.get('sub')
    league_id = str(uuid4())
    database_name = f"league_{league_id.replace('-', '_')}"

    logger.info(f"[{league_id[:8]}] 🚀 Initiating async league creation for '{league_data.league_name}'")

    # 1. Create the "phone book" entry with 'pending' status
    try:
        execute_sql(
            """INSERT INTO user_leagues (league_id, league_name, commissioner_user_id, database_name, creation_status, status)
               VALUES (:league_id::uuid, :league_name, :user_id, :db_name, 'pending', 'creating')""",
            {'league_id': league_id, 'league_name': league_data.league_name, 'user_id': user_id, 'db_name': database_name},
            database_name='postgres'
        )
        # [FIXED] Explicitly set is_active to true for the new membership record.
        execute_sql(
            """INSERT INTO league_memberships (league_id, user_id, role, is_active)
               VALUES (:league_id::uuid, :user_id, 'commissioner', true)""",
            {'league_id': league_id, 'user_id': user_id}, 
            database_name='postgres'
        )
        logger.info(f"[{league_id[:8]}] ✅ Phone book entry created")
        
    except Exception as e:
        logger.error(f"[{league_id[:8]}] 💥 Failed to create initial league record: {e}")
        raise HTTPException(status_code=500, detail="Failed to initiate league creation")

    # 2. Trigger the background worker Lambda
    payload = {
        'league_id': league_id,
        'user_id': user_id,
        'league_data': league_data.model_dump()
    }

    try:
        response = lambda_client.invoke(
            FunctionName=LEAGUE_WORKER_LAMBDA_NAME,
            InvocationType='Event',  # Asynchronous invocation
            Payload=json.dumps(payload)
        )
        logger.info(f"[{league_id[:8]}] ✅ Worker Lambda invoked with status: {response.get('StatusCode')}")
        
    except Exception as e:
        logger.error(f"[{league_id[:8]}] 💥 Failed to invoke worker Lambda: {e}")
        # Clean up phone book entry
        try:
            execute_sql("DELETE FROM user_leagues WHERE league_id = :league_id::uuid", 
                        {'league_id': league_id}, 'postgres')
            execute_sql("DELETE FROM league_memberships WHERE league_id = :league_id::uuid", 
                        {'league_id': league_id}, 'postgres')
        except:
            pass
        raise HTTPException(status_code=500, detail="Failed to start league creation")

    status_url = f"/api/leagues/{league_id}/creation-status"
    return JSONResponse(
        status_code=202,
        content={
            "success": True,
            "league_id": league_id,
            "status": "pending",
            "message": "League creation has started. Poll the status URL for updates.",
            "status_url": status_url
        }
    )

@router.get("/{league_id}/creation-status")
async def get_league_creation_status(league_id: str, current_user: dict = Depends(get_current_user)):
    """Check status of league creation job."""
    user_id = current_user.get('sub')
    
    # Verify user is member
    membership = execute_sql(
        "SELECT user_id FROM league_memberships WHERE league_id = :league_id::uuid AND user_id = :user_id",
        {'league_id': league_id, 'user_id': user_id}, 'postgres'
    )
    
    if not membership.get('records'):
        raise HTTPException(status_code=404, detail="League not found")

    # Get status from the now-guaranteed-to-exist columns
    result = execute_sql(
        "SELECT creation_status, creation_error_message FROM user_leagues WHERE league_id = :league_id::uuid",
        {'league_id': league_id}, 'postgres'
    )
    
    if not result.get('records'):
        raise HTTPException(status_code=404, detail="League status record not found")

    record = result['records'][0]
    status = record[0].get('stringValue', 'unknown')
    error_message = record[1].get('stringValue') if len(record) > 1 and not record[1].get('isNull') else None
    
    return {
        "league_id": league_id,
        "status": status,
        "error_message": error_message
    }

# =============================================================================
# ORIGINAL HELPER FUNCTIONS (Now used by the worker Lambda)
# =============================================================================

def get_full_schema_sqls() -> list[str]:
    """Returns the complete list of CREATE TABLE statements for a new league database."""
    return [
        """CREATE TABLE IF NOT EXISTS league_settings (
            setting_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            league_id UUID NOT NULL,
            setting_name VARCHAR(100) NOT NULL,
            setting_value TEXT,
            setting_type VARCHAR(50) DEFAULT 'string',
            category VARCHAR(50),
            description TEXT,
            last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )""",
        """CREATE TABLE IF NOT EXISTS league_teams (
            team_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            league_id UUID NOT NULL,
            user_id VARCHAR(255) NOT NULL,
            team_name VARCHAR(255),
            manager_name VARCHAR(255),
            is_commissioner BOOLEAN DEFAULT FALSE,
            is_active BOOLEAN DEFAULT TRUE,
            slot_number INTEGER,
            total_salary DECIMAL(12,2) DEFAULT 0,
            roster_spots_used INTEGER DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )""",
        """CREATE TABLE IF NOT EXISTS league_players (
            league_player_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            mlb_player_id INTEGER NOT NULL,
            team_id UUID,
            salary DECIMAL(8,2) DEFAULT 1.0,
            contract_years INTEGER DEFAULT 1,
            contract_start_date DATE,
            contract_end_date DATE,
            availability_status VARCHAR(20) DEFAULT 'free_agent',
            roster_status VARCHAR(20) DEFAULT 'active',
            acquisition_date TIMESTAMP WITH TIME ZONE,
            acquisition_method VARCHAR(20),
            acquisition_cost DECIMAL(8,2),
            fantasy_points DECIMAL(8,2) DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            CONSTRAINT unique_mlb_player_id UNIQUE(mlb_player_id)
        )""",
        """CREATE TABLE IF NOT EXISTS league_transactions (
            transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            league_player_id UUID NOT NULL,
            from_team_id UUID,
            to_team_id UUID,
            transaction_type VARCHAR(20) NOT NULL,
            transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            processed_date TIMESTAMP WITH TIME ZONE,
            salary DECIMAL(8,2),
            contract_years INTEGER,
            notes TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )""",
        # =============================================================================
        # [FINAL VERSION] This schema is now fully aligned with the main DB's
        # `player_stats` table and organized for clarity.
        # =============================================================================
        """CREATE TABLE IF NOT EXISTS player_season_stats (
            season_stat_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            player_id INTEGER NOT NULL,
            season INTEGER NOT NULL DEFAULT 2025,
            
            -- Hitting Stats
            games_played INTEGER DEFAULT 0,
            at_bats INTEGER DEFAULT 0,
            runs INTEGER DEFAULT 0,
            hits INTEGER DEFAULT 0,
            doubles INTEGER DEFAULT 0,
            triples INTEGER DEFAULT 0,
            home_runs INTEGER DEFAULT 0,
            rbi INTEGER DEFAULT 0,
            walks INTEGER DEFAULT 0,
            strikeouts INTEGER DEFAULT 0,
            stolen_bases INTEGER DEFAULT 0,
            caught_stealing INTEGER DEFAULT 0,
            hit_by_pitch INTEGER DEFAULT 0,
            sacrifice_hits INTEGER DEFAULT 0,
            sacrifice_flies INTEGER DEFAULT 0,

            -- Pitching Stats
            games_started INTEGER DEFAULT 0,
            innings_pitched NUMERIC(6,1) DEFAULT 0.0,
            wins INTEGER DEFAULT 0,
            losses INTEGER DEFAULT 0,
            saves INTEGER DEFAULT 0,
            holds INTEGER DEFAULT 0,
            blown_saves INTEGER DEFAULT 0,
            quality_starts INTEGER DEFAULT 0,
            earned_runs INTEGER DEFAULT 0,
            hits_allowed INTEGER DEFAULT 0,
            home_runs_allowed INTEGER DEFAULT 0,
            walks_allowed INTEGER DEFAULT 0,
            strikeouts_pitched INTEGER DEFAULT 0,
            hit_batters INTEGER DEFAULT 0,
            wild_pitches INTEGER DEFAULT 0,
            balks INTEGER DEFAULT 0,
            
            -- Calculated Ratios
            avg NUMERIC(5,3) DEFAULT 0.000,
            obp NUMERIC(5,3) DEFAULT 0.000,
            slg NUMERIC(5,3) DEFAULT 0.000,
            ops NUMERIC(5,3) DEFAULT 0.000,
            era NUMERIC(5,2) DEFAULT 0.00,
            whip NUMERIC(5,3) DEFAULT 0.000,
            k9 DOUBLE PRECISION DEFAULT 0.0,
            bb9 DOUBLE PRECISION DEFAULT 0.0,

            -- Metadata
            last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            CONSTRAINT unique_player_season UNIQUE(player_id, season)
        )""",
        """CREATE TABLE IF NOT EXISTS player_daily_team_stats (
            daily_stat_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            mlb_player_id INTEGER NOT NULL,
            team_id UUID NOT NULL,
            game_date DATE NOT NULL,
            at_bats INTEGER DEFAULT 0, hits INTEGER DEFAULT 0, doubles INTEGER DEFAULT 0,
            triples INTEGER DEFAULT 0, home_runs INTEGER DEFAULT 0, rbi INTEGER DEFAULT 0,
            runs INTEGER DEFAULT 0, walks INTEGER DEFAULT 0, strikeouts INTEGER DEFAULT 0,
            stolen_bases INTEGER DEFAULT 0, innings_pitched DECIMAL(4,1) DEFAULT 0,
            wins INTEGER DEFAULT 0, losses INTEGER DEFAULT 0, saves INTEGER DEFAULT 0,
            earned_runs INTEGER DEFAULT 0, hits_allowed INTEGER DEFAULT 0,
            walks_allowed INTEGER DEFAULT 0, strikeouts_pitched INTEGER DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )""",
        """CREATE TABLE IF NOT EXISTS player_team_accumulated_stats (
            accumulated_stat_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            mlb_player_id INTEGER NOT NULL, team_id UUID NOT NULL,
            first_game_date DATE, last_game_date DATE, team_games_played INTEGER DEFAULT 0,
            team_at_bats INTEGER DEFAULT 0, team_hits INTEGER DEFAULT 0, team_home_runs INTEGER DEFAULT 0,
            team_rbi INTEGER DEFAULT 0, team_runs INTEGER DEFAULT 0, team_stolen_bases INTEGER DEFAULT 0,
            team_batting_avg DECIMAL(4,3) DEFAULT 0.000, team_innings_pitched DECIMAL(5,1) DEFAULT 0,
            team_wins INTEGER DEFAULT 0, team_losses INTEGER DEFAULT 0, team_saves INTEGER DEFAULT 0,
            team_earned_runs INTEGER DEFAULT 0, team_strikeouts_pitched INTEGER DEFAULT 0,
            team_era DECIMAL(4,2) DEFAULT 0.00, team_whip DECIMAL(4,3) DEFAULT 0.000,
            last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )""",
        """CREATE TABLE IF NOT EXISTS league_standings (
            standing_id UUID PRIMARY KEY DEFAULT gen_random_uuid(), team_id UUID NOT NULL,
            category VARCHAR(50) NOT NULL, value DECIMAL(10,4), rank INTEGER, points INTEGER,
            calculation_date DATE DEFAULT CURRENT_DATE,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )""",
        """CREATE TABLE IF NOT EXISTS league_messages (
            message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(), league_id UUID NOT NULL,
            user_id VARCHAR(255) NOT NULL, message_text TEXT,
            message_type VARCHAR(50) DEFAULT 'general',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )""",
        """CREATE TABLE IF NOT EXISTS league_invitations (
            invitation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(), league_id UUID NOT NULL,
            email VARCHAR(255) NOT NULL, owner_name VARCHAR(255) NOT NULL,
            status VARCHAR(20) DEFAULT 'pending', invited_by VARCHAR(255) NOT NULL,
            invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )"""
    ]

def load_all_mlb_players(database_name: str, league_id: str):
    """Loads all active MLB players into the league with default fantasy values."""
    try:
        logger.info(f"[{league_id[:8]}] ⚾ Loading all MLB players...")
        all_players = execute_sql("SELECT player_id FROM mlb_players WHERE is_active = true", database_name='postgres')
        if not all_players or not all_players.get("records"): 
            return 0
        
        values_list = [f"({int(rec[0]['longValue'])})" for rec in all_players["records"]]
        total_players = len(values_list)
        logger.info(f"[{league_id[:8]}] Found {total_players} players. Inserting in batches...")
        
        for i in range(0, total_players, 500):
            chunk = values_list[i:i+500]
            batch_sql = f"INSERT INTO league_players (mlb_player_id) VALUES {', '.join(chunk)} ON CONFLICT (mlb_player_id) DO NOTHING"
            execute_sql(batch_sql, database_name=database_name)
        
        logger.info(f"[{league_id[:8]}] ✅ Loaded {total_players} MLB players.")
        return total_players
    except Exception as e:
        logger.error(f"[{league_id[:8]}] ⚠️ Error loading MLB players: {str(e)}")
        raise e

def sync_player_stats(database_name: str, league_id: str):
    """Syncs 2025 player stats from the main DB to the new league DB in batches."""
    try:
        logger.info(f"[{league_id[:8]}] 📊 Syncing 2025 player stats...")
        main_stats = execute_sql("SELECT * FROM player_stats WHERE season = 2025", database_name='postgres')
        if not main_stats or not main_stats.get('records'):
            logger.warning(f"[{league_id[:8]}] ⚠️ No 2025 stats found to sync.")
            return 0
            
        all_records = main_stats['records']
        total_records, synced_count = len(all_records), 0

        for i in range(0, total_records, 200):
            batch = all_records[i:i + 200]
            values_list = []
            for record in batch:
                def get_val(r, index, type_key='longValue', default=0):
                    try: 
                        return r[index].get(type_key, default)
                    except (IndexError, KeyError): 
                        return default
                
                values_str = ", ".join(map(str, [
                    get_val(record, 1), get_val(record, 2), get_val(record, 3), get_val(record, 4),
                    get_val(record, 5), get_val(record, 7), get_val(record, 6), get_val(record, 8),
                    get_val(record, 9), get_val(record, 10), get_val(record, 11), get_val(record, 12),
                    get_val(record, 13), f"'{get_val(record, 14, 'stringValue', '0.000')}'",
                    f"'{get_val(record, 15, 'stringValue', '0.000')}'", f"'{get_val(record, 16, 'stringValue', '0.000')}'",
                    f"'{get_val(record, 17, 'stringValue', '0.000')}'", get_val(record, 18),
                    f"'{get_val(record, 19, 'stringValue', '0.0')}'", get_val(record, 20), get_val(record, 21),
                    get_val(record, 22), get_val(record, 23), get_val(record, 32), get_val(record, 24),
                    get_val(record, 25), get_val(record, 26), get_val(record, 27),
                    f"'{get_val(record, 28, 'stringValue', '0.00')}'", f"'{get_val(record, 29, 'stringValue', '0.000')}'",
                ]))
                values_list.append(f"({values_str}, NOW())")
            
            if values_list:
                batch_sql = f"""
                    INSERT INTO player_season_stats (
                        player_id, season_year, games_played, at_bats, hits, runs, rbi, home_runs,
                        doubles, triples, stolen_bases, walks, strikeouts, avg, obp, slg, ops,
                        games_started, innings_pitched, wins, losses, saves, holds, quality_starts,
                        earned_runs, hits_allowed, walks_allowed, strikeouts_pitched, era, whip, last_updated
                    ) VALUES {', '.join(values_list)} ON CONFLICT (player_id, season_year) DO NOTHING
                """
                execute_sql(batch_sql, database_name=database_name)
                synced_count += len(values_list)
        
        logger.info(f"[{league_id[:8]}] ✅ Synced {synced_count} player stats records.")
        return synced_count
    except Exception as e:
        logger.error(f"[{league_id[:8]}] 💥 FATAL: Error syncing player stats: {str(e)}")
        raise e

# =============================================================================
# DESTRUCTIVE OPERATIONS (Retained for admin/cleanup purposes)
# =============================================================================

@router.delete("/{league_id}")
async def delete_league(league_id: str, current_user: dict = Depends(get_current_user)):
    """Deletes a league and all its associated data."""
    user_id = current_user.get('sub')
    logger.info(f"[{league_id[:8]}] 🗑️ Received request to delete league")
    try:
        membership_result = execute_sql(
            "SELECT role FROM league_memberships WHERE league_id = :league_id::uuid AND user_id = :user_id",
            {'league_id': league_id, 'user_id': user_id}, 
            database_name='postgres'
        )
        if not membership_result.get('records') or membership_result['records'][0][0].get('stringValue') != 'commissioner':
            raise HTTPException(status_code=403, detail="Only the commissioner can delete this league.")

        league_result = execute_sql(
            "SELECT database_name FROM user_leagues WHERE league_id = :league_id::uuid",
            {'league_id': league_id}, 
            database_name='postgres'
        )
        database_name = league_result['records'][0][0].get('stringValue') if league_result.get('records') else None
        
        logger.info(f"[{league_id[:8]}] Deleting phone book entries...")
        execute_sql("DELETE FROM league_memberships WHERE league_id = :league_id::uuid", {'league_id': league_id}, database_name='postgres')
        execute_sql("DELETE FROM user_leagues WHERE league_id = :league_id::uuid", {'league_id': league_id}, database_name='postgres')

        if database_name:
            try:
                logger.info(f"[{league_id[:8]}] Dropping database '{database_name}'...")
                execute_sql(f'DROP DATABASE IF EXISTS "{database_name}"', database_name='postgres')
            except Exception as db_drop_error:
                logger.error(f"Could not drop database {database_name}. Manual cleanup may be needed. Error: {db_drop_error}")
        
        return {"success": True, "message": "League deleted successfully."}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete league {league_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")
