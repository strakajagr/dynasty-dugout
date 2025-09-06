"""
Dynasty Dugout - Transaction Models
All Pydantic models for the transactions module
"""
from pydantic import BaseModel
from typing import List, Optional

class TransactionRequest(BaseModel):
    """Transaction request model"""
    transaction_type: str  # 'add', 'drop', 'trade', 'waiver_claim'
    league_player_id: str  # UUID
    salary: float = 1.0
    contract_years: int = 1

class AddPlayerRequest(BaseModel):
    """Add player to team request"""
    league_player_id: str  # UUID from league database
    salary: float = 1.0
    contract_years: int = 1
    roster_status: str = 'active'  # 'active', 'bench', 'injured', 'minors'
    roster_position: Optional[str] = None  # 'C_0', 'C_1', '1B_0', etc.
    commissioner_action: Optional[bool] = False
    target_team_id: Optional[str] = None

class DropPlayerRequest(BaseModel):
    """Drop player from team request"""
    league_player_id: str
    commissioner_action: Optional[bool] = False
    target_team_id: Optional[str] = None

class RosterMoveRequest(BaseModel):
    """Move player between roster statuses"""
    league_player_id: str
    new_status: str  # 'active', 'bench', 'injured', 'minors'
    reason: Optional[str] = None

class TradeProposal(BaseModel):
    """Trade proposal model"""
    to_team_id: str
    from_players: List[str] = []  # league_player_ids
    to_players: List[str] = []    # league_player_ids
    notes: str = ""