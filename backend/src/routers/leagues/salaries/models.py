"""
Dynasty Dugout - Salary Models
All Pydantic models for the salaries module
"""

from pydantic import BaseModel
from typing import Optional, List, Dict

class SalarySettings(BaseModel):
    use_dual_cap: bool = True
    draft_cap: float = 600.0
    season_cap: float = 200.0
    total_cap: float = 800.0
    salary_cap: float = 800.0
    min_salary: float = 2.0
    salary_increment: float = 2.0
    rookie_price: float = 20.0
    standard_contract_length: int = 2
    draft_cap_usage: float = 0.75
    extension_rules: List[Dict] = []
    pricing_method: Optional[str] = "adaptive"

class PlayerPrice(BaseModel):
    player_id: int
    price: float  # The calculated/generated price
    salary: Optional[float] = None  # The actual contract amount (can differ from price)
    tier: Optional[str] = None
    manual_override: Optional[bool] = False
    contract_years: Optional[int] = None  # How many years left on contract

class SavePricesRequest(BaseModel):
    settings: SalarySettings
    prices: List[PlayerPrice]
    method: str = "adaptive"

class SavePricesAsyncRequest(BaseModel):
    settings: SalarySettings
    prices: List[PlayerPrice]
    method: str = "adaptive"
    job_id: Optional[str] = None

class PriceSaveJobStatus(BaseModel):
    job_id: str
    status: str  # 'pending', 'processing', 'completed', 'failed'
    progress: int  # 0-100
    total_players: int
    processed_players: int
    message: Optional[str] = None
    error: Optional[str] = None
    created_at: str
    updated_at: str

class TeamSalaryInfo(BaseModel):
    team_id: str
    team_name: str
    total_salary: float
    salary_cap_used: float
    draft_cap_used: float
    season_cap_used: float
    cap_space_available: float
    player_count: int
    average_salary: float

class PlayerContract(BaseModel):
    league_player_id: str
    player_id: int
    player_name: str
    position: str
    team_id: Optional[str] = None
    team_name: Optional[str] = None
    salary: float
    contract_years: int
    acquisition_method: Optional[str] = None
    acquisition_date: Optional[str] = None

class ContractExtension(BaseModel):
    league_player_id: str
    new_salary: float
    new_years: int
    extension_type: str  # 'standard', 'franchise', 'rookie'

class BulkContractUpdate(BaseModel):
    contracts: List[PlayerContract]
    update_type: str  # 'salary', 'years', 'both'