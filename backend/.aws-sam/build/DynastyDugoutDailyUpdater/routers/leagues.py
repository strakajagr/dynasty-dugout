"""
Dynasty Dugout - Leagues Management Router
Complete league management API with all services integrated
FIXED: All SQL injection vulnerabilities removed + UUID casting fix
"""

import logging
import json
from datetime import datetime, date
from typing import Dict, List, Optional, Any
from uuid import uuid4
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field

from core.auth_utils import get_current_user
from core.database import execute_sql

# Import all league services
from league_services.standings_service import LeagueStandingsService
from league_services.scoring_engine import ScoringEngineService
from league_services.roster_management import RosterManagementService
from league_services.league_player_service import LeaguePlayerService
from league_services.transaction_service import TransactionService

logger = logging.getLogger(__name__)
router = APIRouter()

# =============================================================================
# PYDANTIC MODELS
# =============================================================================

class LeagueCreateRequest(BaseModel):
    """League creation request with full configuration"""
    league_name: str = Field(..., min_length=3, max_length=255)
    player_pool: str = Field(default="american_national")
    scoring_system: str = Field(default="rotisserie_ytd")
    scoring_categories: dict = Field(default_factory=dict)
    use_salaries: bool = Field(default=True)
    salary_cap: Optional[float] = Field(default=200.0)
    salary_floor: Optional[float] = Field(default=0.0)
    max_teams: int = Field(default=12, ge=4, le=20)
    max_players_total: int = Field(default=23)
    min_hitters: int = Field(default=13)
    max_pitchers: int = Field(default=10)
    min_pitchers: int = Field(default=10)
    position_requirements: dict = Field(default_factory=dict)
    use_contracts: bool = Field(default=True)
    max_contract_years: int = Field(default=5)
    transaction_deadline: str = Field(default="monday")
    use_waivers: bool = Field(default=False)
    season_start_date: Optional[str] = None
    season_end_date: Optional[str] = None

class TransactionRequest(BaseModel):
    """Transaction request model"""
    transaction_type: str
    player_id: int
    salary: Optional[float] = 1.0
    contract_years: Optional[int] = 1

class TradeProposal(BaseModel):
    """Trade proposal model"""
    to_team_id: str
    from_players: List[int] = []
    to_players: List[int] = []
    notes: Optional[str] = ""

# =============================================================================
# LEAGUE CREATION & MANAGEMENT
# =============================================================================

@router.post("/create")
async def create_league(
    league_data: LeagueCreateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a new league with complete configuration"""
    try:
        user_id = current_user.get('sub')
        league_id = str(uuid4())
        
        logger.info(f"Creating league '{league_data.league_name}' for user: {user_id}")
        
        # Create the league record with full configuration
        create_league_sql = """
            CREATE TABLE IF NOT EXISTS user_leagues (
                league_id UUID PRIMARY KEY,
                league_name VARCHAR(255) NOT NULL,
                commissioner_user_id VARCHAR(255) NOT NULL,
                player_pool VARCHAR(50) DEFAULT 'american_national',
                scoring_system VARCHAR(100) DEFAULT 'rotisserie_ytd',
                scoring_categories TEXT,
                use_salaries BOOLEAN DEFAULT TRUE,
                salary_cap DECIMAL(10,2) DEFAULT 200.0,
                salary_floor DECIMAL(10,2) DEFAULT 0.0,
                max_teams INTEGER DEFAULT 12,
                max_players_total INTEGER DEFAULT 23,
                min_hitters INTEGER DEFAULT 13,
                max_pitchers INTEGER DEFAULT 10,
                min_pitchers INTEGER DEFAULT 10,
                position_requirements TEXT,
                use_contracts BOOLEAN DEFAULT TRUE,
                max_contract_years INTEGER DEFAULT 5,
                transaction_deadline VARCHAR(20) DEFAULT 'monday',
                use_waivers BOOLEAN DEFAULT FALSE,
                season_start_date DATE,
                season_end_date DATE,
                status VARCHAR(20) DEFAULT 'setup',
                created_at TIMESTAMP DEFAULT NOW()
            );
        """
        
        execute_sql(create_league_sql)
        
        # FIXED: Use parameterized query with UUID casting
        insert_league_sql = """
            INSERT INTO user_leagues (
                league_id, league_name, commissioner_user_id, player_pool, scoring_system,
                scoring_categories, use_salaries, salary_cap, salary_floor, max_teams,
                max_players_total, min_hitters, max_pitchers, min_pitchers,
                position_requirements, use_contracts, max_contract_years,
                transaction_deadline, use_waivers, season_start_date, season_end_date
            ) VALUES (
                :league_id::uuid, :league_name, :user_id, :player_pool, :scoring_system,
                :scoring_categories, :use_salaries, :salary_cap, :salary_floor, :max_teams,
                :max_players_total, :min_hitters, :max_pitchers, :min_pitchers,
                :position_requirements, :use_contracts, :max_contract_years,
                :transaction_deadline, :use_waivers, :season_start_date::date, :season_end_date::date
            )
        """
        
        # Prepare parameters safely
        params = {
            'league_id': league_id,
            'league_name': league_data.league_name,
            'user_id': user_id,
            'player_pool': league_data.player_pool,
            'scoring_system': league_data.scoring_system,
            'scoring_categories': json.dumps(league_data.scoring_categories),
            'use_salaries': league_data.use_salaries,
            'salary_cap': league_data.salary_cap,
            'salary_floor': league_data.salary_floor or 0.0,
            'max_teams': league_data.max_teams,
            'max_players_total': league_data.max_players_total,
            'min_hitters': league_data.min_hitters,
            'max_pitchers': league_data.max_pitchers,
            'min_pitchers': league_data.min_pitchers,
            'position_requirements': json.dumps(league_data.position_requirements),
            'use_contracts': league_data.use_contracts,
            'max_contract_years': league_data.max_contract_years,
            'transaction_deadline': league_data.transaction_deadline,
            'use_waivers': league_data.use_waivers,
            'season_start_date': league_data.season_start_date,
            'season_end_date': league_data.season_end_date
        }
        
        execute_sql(insert_league_sql, params)
        
        # Create league membership table
        create_membership_sql = """
            CREATE TABLE IF NOT EXISTS league_memberships (
                membership_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                league_id UUID NOT NULL,
                user_id VARCHAR(255) NOT NULL,
                role VARCHAR(20) DEFAULT 'owner',
                is_active BOOLEAN DEFAULT TRUE,
                joined_at TIMESTAMP DEFAULT NOW(),
                CONSTRAINT unique_league_user UNIQUE(league_id, user_id)
            );
        """
        
        execute_sql(create_membership_sql)
        
        # FIXED: Add commissioner as member with UUID casting
        add_member_sql = """
            INSERT INTO league_memberships (league_id, user_id, role)
            VALUES (:league_id::uuid, :user_id, 'commissioner')
            ON CONFLICT (league_id, user_id) DO NOTHING
        """
        
        execute_sql(add_member_sql, {
            'league_id': league_id,
            'user_id': user_id
        })
        
        # Create league-specific player pool
        player_pool_result = LeaguePlayerService.create_league_player_pool(
            league_id, league_data.player_pool
        )
        
        logger.info(f"League created with {player_pool_result['players_added']} players: {league_id}")
        
        return {
            "success": True,
            "league_id": league_id,
            "league_name": league_data.league_name,
            "player_pool": player_pool_result,
            "message": f"League '{league_data.league_name}' created successfully"
        }
        
    except Exception as e:
        logger.error(f"Error creating league: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create league: {str(e)}")

@router.get("/my-leagues")
async def get_my_leagues(current_user: dict = Depends(get_current_user)):
    """Get all leagues for the current user"""
    try:
        user_id = current_user.get('sub')
        
        # FIXED: Use parameterized query
        sql = """
            SELECT 
                ul.league_id, ul.league_name, ul.status, ul.salary_cap, ul.max_teams,
                ul.scoring_system, ul.player_pool, lm.role, ul.created_at
            FROM league_memberships lm
            JOIN user_leagues ul ON lm.league_id = ul.league_id
            WHERE lm.user_id = :user_id AND lm.is_active = true
            ORDER BY ul.created_at DESC
        """
        
        response = execute_sql(sql, {'user_id': user_id})
        
        leagues = []
        if response.get('records'):
            for record in response['records']:
                league = {
                    'league_id': record[0].get('stringValue') if record[0] and not record[0].get('isNull') else None,
                    'league_name': record[1].get('stringValue') if record[1] and not record[1].get('isNull') else None,
                    'status': record[2].get('stringValue') if record[2] and not record[2].get('isNull') else None,
                    'salary_cap': record[3].get('doubleValue') if record[3] and not record[3].get('isNull') else None,
                    'max_teams': record[4].get('longValue') if record[4] and not record[4].get('isNull') else None,
                    'scoring_system': record[5].get('stringValue') if record[5] and not record[5].get('isNull') else None,
                    'player_pool': record[6].get('stringValue') if record[6] and not record[6].get('isNull') else None,
                    'role': record[7].get('stringValue') if record[7] and not record[7].get('isNull') else None,
                    'created_at': record[8].get('stringValue') if record[8] and not record[8].get('isNull') else None
                }
                leagues.append(league)
        
        return {
            "success": True,
            "leagues": leagues,
            "count": len(leagues)
        }
        
    except Exception as e:
        logger.error(f"Error getting user leagues: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve leagues")

# =============================================================================
# STANDINGS & SCORING
# =============================================================================

@router.get("/{league_id}/standings")
async def get_league_standings(
    league_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get league standings based on scoring system"""
    try:
        # FIXED: Verify user is member of league with parameterized query
        user_id = current_user.get('sub')
        membership_sql = """
            SELECT role FROM league_memberships 
            WHERE league_id = :league_id::uuid AND user_id = :user_id AND is_active = true
        """
        
        membership_response = execute_sql(membership_sql, {
            'league_id': league_id,
            'user_id': user_id
        })
        
        if not membership_response.get('records'):
            raise HTTPException(status_code=403, detail="Access denied to this league")
        
        # Generate standings using the standings service
        standings_result = LeagueStandingsService.generate_league_standings(league_id)
        
        if not standings_result['success']:
            raise HTTPException(status_code=500, detail=standings_result.get('error', 'Failed to generate standings'))
        
        return standings_result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting league standings: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve standings")

@router.get("/{league_id}/team-stats")
async def get_league_team_stats(
    league_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get aggregated team statistics for all teams in league"""
    try:
        # FIXED: Verify membership with parameterized query
        user_id = current_user.get('sub')
        membership_sql = """
            SELECT role FROM league_memberships 
            WHERE league_id = :league_id::uuid AND user_id = :user_id AND is_active = true
        """
        
        membership_response = execute_sql(membership_sql, {
            'league_id': league_id,
            'user_id': user_id
        })
        
        if not membership_response.get('records'):
            raise HTTPException(status_code=403, detail="Access denied to this league")
        
        # Get team stats using scoring engine
        team_stats = ScoringEngineService.calculate_all_team_stats(league_id)
        
        return {
            "success": True,
            "league_id": league_id,
            "team_stats": team_stats
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting team stats: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve team stats")

# =============================================================================
# ROSTER MANAGEMENT
# =============================================================================

@router.get("/{league_id}/my-roster")
async def get_my_roster(
    league_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get current user's roster in the league"""
    try:
        user_id = current_user.get('sub')
        
        # FIXED: Get user's team in this league with parameterized query
        team_sql = """
            SELECT league_id FROM league_memberships 
            WHERE league_id = :league_id::uuid AND user_id = :user_id AND is_active = true
        """
        
        team_response = execute_sql(team_sql, {
            'league_id': league_id,
            'user_id': user_id
        })
        
        if not team_response.get('records'):
            raise HTTPException(status_code=403, detail="Not a member of this league")
        
        # For now, use user_id as team_id (can be enhanced later)
        team_id = user_id
        
        # Get roster using roster management service
        roster = RosterManagementService.get_team_roster(league_id, team_id)
        
        # Get roster validation
        validation = RosterManagementService.validate_roster_requirements(league_id, team_id)
        
        return {
            "success": True,
            "league_id": league_id,
            "team_id": team_id,
            "roster": roster,
            "validation": validation
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting roster: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve roster")

@router.get("/{league_id}/available-players")
async def get_available_players(
    league_id: str,
    current_user: dict = Depends(get_current_user),
    position: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0)
):
    """Get players available for pickup in the league"""
    try:
        # FIXED: Verify membership with parameterized query
        user_id = current_user.get('sub')
        membership_sql = """
            SELECT role FROM league_memberships 
            WHERE league_id = :league_id::uuid AND user_id = :user_id AND is_active = true
        """
        
        membership_response = execute_sql(membership_sql, {
            'league_id': league_id,
            'user_id': user_id
        })
        
        if not membership_response.get('records'):
            raise HTTPException(status_code=403, detail="Access denied to this league")
        
        # Get available players using league player service
        filters = {
            'status': 'available',
            'position': position,
            'search': search,
            'limit': limit,
            'offset': offset,
            'active_only': True
        }
        
        players = LeaguePlayerService.get_league_players(league_id, filters)
        
        return {
            "success": True,
            "league_id": league_id,
            "players": players,
            "count": len(players),
            "filters": filters
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting available players: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve available players")

# =============================================================================
# TRANSACTIONS
# =============================================================================

@router.post("/{league_id}/transactions")
async def process_transaction(
    league_id: str,
    transaction: TransactionRequest,
    current_user: dict = Depends(get_current_user)
):
    """Process a league transaction"""
    try:
        user_id = current_user.get('sub')
        team_id = user_id  # Simplified team assignment
        
        # FIXED: Verify membership and transaction deadlines with parameterized query
        membership_sql = """
            SELECT role FROM league_memberships 
            WHERE league_id = :league_id::uuid AND user_id = :user_id AND is_active = true
        """
        
        membership_response = execute_sql(membership_sql, {
            'league_id': league_id,
            'user_id': user_id
        })
        
        if not membership_response.get('records'):
            raise HTTPException(status_code=403, detail="Access denied to this league")
        
        # Check transaction deadlines
        deadline_check = TransactionService.validate_transaction_deadline(league_id)
        if not deadline_check['transactions_allowed']:
            raise HTTPException(status_code=400, detail=deadline_check['message'])
        
        # Process based on transaction type
        result = None
        
        if transaction.transaction_type == 'pickup':
            result = TransactionService.process_free_agent_pickup(
                league_id, team_id, transaction.player_id, 
                transaction.salary, transaction.contract_years
            )
        
        elif transaction.transaction_type == 'drop':
            result = TransactionService.process_player_drop(
                league_id, team_id, transaction.player_id
            )
        
        elif transaction.transaction_type == 'waiver_claim':
            # Get waiver priority (simplified)
            waiver_priority = 1
            result = TransactionService.process_waiver_claim(
                league_id, team_id, transaction.player_id, 
                waiver_priority, transaction.salary
            )
        
        else:
            raise HTTPException(status_code=400, detail=f"Unknown transaction type: {transaction.transaction_type}")
        
        if not result['success']:
            raise HTTPException(status_code=400, detail=result.get('message', 'Transaction failed'))
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing transaction: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to process transaction")

@router.post("/{league_id}/trades")
async def create_trade(
    league_id: str,
    trade: TradeProposal,
    current_user: dict = Depends(get_current_user)
):
    """Create a trade proposal"""
    try:
        user_id = current_user.get('sub')
        from_team_id = user_id  # Simplified team assignment
        
        # FIXED: Verify membership with parameterized query
        membership_sql = """
            SELECT role FROM league_memberships 
            WHERE league_id = :league_id::uuid AND user_id = :user_id AND is_active = true
        """
        
        membership_response = execute_sql(membership_sql, {
            'league_id': league_id,
            'user_id': user_id
        })
        
        if not membership_response.get('records'):
            raise HTTPException(status_code=403, detail="Access denied to this league")
        
        # Create trade proposal
        trade_details = {
            'from_players': trade.from_players,
            'to_players': trade.to_players,
            'notes': trade.notes
        }
        
        result = TransactionService.create_trade_proposal(
            league_id, from_team_id, trade.to_team_id, trade_details
        )
        
        if not result['success']:
            raise HTTPException(status_code=400, detail=result.get('message', 'Trade creation failed'))
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating trade: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create trade")

@router.get("/{league_id}/transactions")
async def get_transaction_history(
    league_id: str,
    current_user: dict = Depends(get_current_user),
    transaction_type: Optional[str] = Query(None),
    days_back: int = Query(30, ge=1, le=365),
    limit: int = Query(50, le=200)
):
    """Get league transaction history"""
    try:
        # FIXED: Verify membership with parameterized query
        user_id = current_user.get('sub')
        membership_sql = """
            SELECT role FROM league_memberships 
            WHERE league_id = :league_id::uuid AND user_id = :user_id AND is_active = true
        """
        
        membership_response = execute_sql(membership_sql, {
            'league_id': league_id,
            'user_id': user_id
        })
        
        if not membership_response.get('records'):
            raise HTTPException(status_code=403, detail="Access denied to this league")
        
        # Get transaction history
        filters = {
            'transaction_type': transaction_type,
            'days_back': days_back,
            'limit': limit
        }
        
        transactions = TransactionService.get_transaction_history(league_id, filters)
        
        return {
            "success": True,
            "league_id": league_id,
            "transactions": transactions,
            "count": len(transactions),
            "filters": filters
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting transaction history: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve transaction history")

# =============================================================================
# LEAGUE ADMINISTRATION
# =============================================================================

@router.post("/{league_id}/sync-players")
async def sync_league_players(
    league_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Sync league player pool with latest MLB data"""
    try:
        user_id = current_user.get('sub')
        
        # FIXED: Verify commissioner access with parameterized query
        membership_sql = """
            SELECT role FROM league_memberships 
            WHERE league_id = :league_id::uuid AND user_id = :user_id AND is_active = true
        """
        
        membership_response = execute_sql(membership_sql, {
            'league_id': league_id,
            'user_id': user_id
        })
        
        if not membership_response.get('records'):
            raise HTTPException(status_code=403, detail="Access denied to this league")
        
        role = membership_response['records'][0][0].get('stringValue')
        if role != 'commissioner':
            raise HTTPException(status_code=403, detail="Only commissioners can sync player data")
        
        # Sync with MLB updates
        sync_result = LeaguePlayerService.sync_with_mlb_updates(league_id)
        
        return {
            "success": True,
            "league_id": league_id,
            "sync_result": sync_result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error syncing league players: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to sync player data")

@router.get("/{league_id}/pool-stats")
async def get_league_pool_stats(
    league_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get statistics about the league's player pool"""
    try:
        # FIXED: Verify membership with parameterized query
        user_id = current_user.get('sub')
        membership_sql = """
            SELECT role FROM league_memberships 
            WHERE league_id = :league_id::uuid AND user_id = :user_id AND is_active = true
        """
        
        membership_response = execute_sql(membership_sql, {
            'league_id': league_id,
            'user_id': user_id
        })
        
        if not membership_response.get('records'):
            raise HTTPException(status_code=403, detail="Access denied to this league")
        
        # Get pool statistics
        pool_stats = LeaguePlayerService.get_league_pool_stats(league_id)
        
        return {
            "success": True,
            "pool_stats": pool_stats
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting pool stats: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve pool statistics")

# =============================================================================
# HEALTH & UTILITIES
# =============================================================================

@router.get("/health")
async def league_health_check():
    """Health check for league services"""
    try:
        # Test database connection
        sql = "SELECT COUNT(*) FROM mlb_players"
        response = execute_sql(sql)
        
        player_count = 0
        if response.get('records') and response['records'][0]:
            player_count = response['records'][0][0].get('longValue', 0)
        
        return {
            "status": "healthy",
            "service": "leagues",
            "mlb_players_available": player_count,
            "services": {
                "standings": "operational",
                "scoring_engine": "operational", 
                "roster_management": "operational",
                "league_players": "operational",
                "transactions": "operational"
            },
            "architecture": "league-specific player pools",
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"League health check failed: {str(e)}")
        return {
            "status": "unhealthy",
            "service": "leagues",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }

@router.delete("/{league_id}/cleanup")
async def cleanup_league(
    league_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete league and all associated data (DANGEROUS)"""
    try:
        user_id = current_user.get('sub')
        
        # FIXED: Verify commissioner access with parameterized query
        membership_sql = """
            SELECT role FROM league_memberships 
            WHERE league_id = :league_id::uuid AND user_id = :user_id AND is_active = true
        """
        
        membership_response = execute_sql(membership_sql, {
            'league_id': league_id,
            'user_id': user_id
        })
        
        if not membership_response.get('records'):
            raise HTTPException(status_code=403, detail="Access denied to this league")
        
        role = membership_response['records'][0][0].get('stringValue')
        if role != 'commissioner':
            raise HTTPException(status_code=403, detail="Only commissioners can delete leagues")
        
        # Cleanup league player pool
        cleanup_result = LeaguePlayerService.cleanup_league_player_pool(league_id)
        
        # FIXED: Delete league record with parameterized query
        delete_league_sql = "DELETE FROM user_leagues WHERE league_id = :league_id::uuid"
        execute_sql(delete_league_sql, {'league_id': league_id})
        
        # FIXED: Delete memberships with parameterized query
        delete_members_sql = "DELETE FROM league_memberships WHERE league_id = :league_id::uuid"
        execute_sql(delete_members_sql, {'league_id': league_id})
        
        logger.info(f"League {league_id} deleted by commissioner {user_id}")
        
        return {
            "success": True,
            "league_id": league_id,
            "cleanup_result": cleanup_result,
            "message": "League deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting league: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete league")# Date casting fix applied: Wed Jul 23 16:58:00 EDT 2025
