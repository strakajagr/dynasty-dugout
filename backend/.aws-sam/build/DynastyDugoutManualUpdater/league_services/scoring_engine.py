"""
Dynasty Dugout - Scoring Engine Service
Aggregates MLB player stats into team totals and calculates derived statistics
UPDATED: Full PostgreSQL compatibility with database-per-league architecture
"""

import logging
from typing import Dict, List, Any, Optional
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, date
from core.database import execute_sql, get_league_database_name

logger = logging.getLogger(__name__)

class ScoringEngineService:
    """
    Core service for aggregating player statistics into team totals.
    PostgreSQL-compatible with separate databases per league.
    """
    
    @staticmethod
    def get_league_rosters(league_id: str) -> Dict[str, List[Dict[str, Any]]]:
        """Get all active rosters for teams in a league from league database"""
        try:
            db_name = get_league_database_name(league_id)
            
            # Query the league database for roster information
            sql = """
                SELECT 
                    team_id,
                    mlb_player_id,
                    salary,
                    contract_years,
                    roster_status,
                    first_name,
                    last_name,
                    position,
                    mlb_team
                FROM players
                WHERE team_id IS NOT NULL 
                AND roster_status IN ('rostered', 'active')
                ORDER BY team_id, position, last_name
            """
            
            # Execute on league database
            response = execute_sql(sql, database_name=db_name)
            
            rosters = {}
            if response.get('records'):
                for record in response['records']:
                    team_id_value = record[0]
                    if team_id_value and not team_id_value.get('isNull'):
                        team_id = team_id_value.get('stringValue')
                    else:
                        continue
                    
                    if team_id not in rosters:
                        rosters[team_id] = []
                    
                    # Safe value extraction
                    mlb_player_id = None
                    if record[1] and not record[1].get('isNull'):
                        mlb_player_id = record[1].get('longValue')
                    
                    salary = 1.0
                    if record[2] and not record[2].get('isNull'):
                        salary = record[2].get('doubleValue', 1.0)
                    
                    contract_years = 1
                    if record[3] and not record[3].get('isNull'):
                        contract_years = record[3].get('longValue', 1)
                    
                    roster_status = 'active'
                    if record[4] and not record[4].get('isNull'):
                        roster_status = record[4].get('stringValue', 'active')
                    
                    first_name = ''
                    if record[5] and not record[5].get('isNull'):
                        first_name = record[5].get('stringValue', '')
                    
                    last_name = ''
                    if record[6] and not record[6].get('isNull'):
                        last_name = record[6].get('stringValue', '')
                    
                    position = ''
                    if record[7] and not record[7].get('isNull'):
                        position = record[7].get('stringValue', '')
                    
                    mlb_team = ''
                    if record[8] and not record[8].get('isNull'):
                        mlb_team = record[8].get('stringValue', '')
                    
                    player = {
                        'mlb_player_id': mlb_player_id,
                        'salary': salary,
                        'contract_years': contract_years,
                        'roster_status': roster_status,
                        'first_name': first_name,
                        'last_name': last_name,
                        'position': position,
                        'mlb_team': mlb_team
                    }
                    rosters[team_id].append(player)
            
            return rosters
            
        except Exception as e:
            logger.error(f"Error getting league rosters: {str(e)}")
            raise

    @staticmethod
    def get_player_season_stats(player_id: int, season_year: int = None) -> Dict[str, Any]:
        """Get a player's current season statistics from main database"""
        try:
            if season_year is None:
                season_year = datetime.now().year
            
            # Get hitting stats from main database
            hitting_sql = """
                SELECT 
                    games_played, at_bats, runs, hits, doubles, triples, home_runs,
                    rbis, stolen_bases, caught_stealing, walks, hit_by_pitch, strikeouts,
                    grounded_into_double_plays, errors
                FROM player_stats 
                WHERE player_id = :player_id AND season_year = :season_year
                AND stat_type = 'hitting'
            """
            
            # Execute on main database
            hitting_response = execute_sql(hitting_sql, {
                'player_id': player_id,
                'season_year': season_year
            })
            
            # Get pitching stats from main database
            pitching_sql = """
                SELECT 
                    games_played, games_started, wins, losses, saves, blown_saves,
                    innings_pitched, hits_allowed, earned_runs, walks_allowed,
                    strikeouts_pitched, home_runs_allowed, complete_games, shutouts
                FROM player_stats 
                WHERE player_id = :player_id AND season_year = :season_year
                AND stat_type = 'pitching'
            """
            
            # Execute on main database
            pitching_response = execute_sql(pitching_sql, {
                'player_id': player_id,
                'season_year': season_year
            })
            
            stats = {
                'player_id': player_id,
                'season_year': season_year,
                # Initialize all stats to 0
                'G': 0, 'AB': 0, 'R': 0, 'H': 0, '2B': 0, '3B': 0, 'HR': 0,
                'RBI': 0, 'SB': 0, 'CS': 0, 'BB': 0, 'HBP': 0, 'SO': 0,
                'GIDP': 0, 'E': 0,
                # Pitching stats
                'G_P': 0, 'GS': 0, 'W': 0, 'L': 0, 'SV': 0, 'BS': 0,
                'IP': 0.0, 'H_A': 0, 'ER': 0, 'BB_A': 0, 'SO_P': 0,
                'HR_A': 0, 'CG': 0, 'SHO': 0,
                # Calculated stats (will be computed)
                'AVG': 0.000, 'OBP': 0.000, 'SLG': 0.000, 'OPS': 0.000,
                'ERA': 0.00, 'WHIP': 0.00, 'QS': 0
            }
            
            # Process hitting stats
            if hitting_response.get('records') and hitting_response['records']:
                hitting_record = hitting_response['records'][0]
                
                # Safe value extraction for hitting stats
                hitting_stats = ['G', 'AB', 'R', 'H', '2B', '3B', 'HR', 'RBI', 'SB', 'CS', 'BB', 'HBP', 'SO', 'GIDP', 'E']
                for i, stat in enumerate(hitting_stats):
                    if i < len(hitting_record) and hitting_record[i] and not hitting_record[i].get('isNull'):
                        stats[stat] = hitting_record[i].get('longValue', 0)
            
            # Process pitching stats
            if pitching_response.get('records') and pitching_response['records']:
                pitching_record = pitching_response['records'][0]
                
                # Safe value extraction for pitching stats
                pitching_stats = ['G_P', 'GS', 'W', 'L', 'SV', 'BS', 'IP', 'H_A', 'ER', 'BB_A', 'SO_P', 'HR_A', 'CG', 'SHO']
                for i, stat in enumerate(pitching_stats):
                    if i < len(pitching_record) and pitching_record[i] and not pitching_record[i].get('isNull'):
                        if stat == 'IP':  # Special handling for innings pitched (decimal)
                            stats[stat] = pitching_record[i].get('doubleValue', 0.0)
                        else:
                            stats[stat] = pitching_record[i].get('longValue', 0)
            
            return stats
            
        except Exception as e:
            logger.error(f"Error getting player stats: {str(e)}")
            return {}

    @staticmethod
    def calculate_quality_starts(player_id: int, season_year: int = None) -> int:
        """Calculate Quality Starts from game log data (6+ IP, ≤3 ER) from main database"""
        try:
            if season_year is None:
                season_year = datetime.now().year
            
            sql = """
                SELECT innings_pitched, earned_runs
                FROM player_game_logs 
                WHERE player_id = :player_id 
                AND season_year = :season_year
                AND innings_pitched IS NOT NULL
                AND earned_runs IS NOT NULL
            """
            
            # Execute on main database
            response = execute_sql(sql, {
                'player_id': player_id,
                'season_year': season_year
            })
            
            quality_starts = 0
            if response.get('records'):
                for record in response['records']:
                    innings = 0.0
                    if record[0] and not record[0].get('isNull'):
                        innings = record[0].get('doubleValue', 0.0)
                    
                    earned_runs = 0
                    if record[1] and not record[1].get('isNull'):
                        earned_runs = record[1].get('longValue', 0)
                    
                    # Quality Start: 6+ innings and 3 or fewer earned runs
                    if innings >= 6.0 and earned_runs <= 3:
                        quality_starts += 1
            
            return quality_starts
            
        except Exception as e:
            logger.error(f"Error calculating quality starts: {str(e)}")
            return 0

    @staticmethod
    def calculate_derived_stats(stats: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate derived statistics (AVG, OBP, SLG, OPS, ERA, WHIP)"""
        try:
            # Hitting derived stats
            ab = stats.get('AB', 0)
            h = stats.get('H', 0)
            bb = stats.get('BB', 0)
            hbp = stats.get('HBP', 0)
            doubles = stats.get('2B', 0)
            triples = stats.get('3B', 0)
            hr = stats.get('HR', 0)
            
            # Batting Average
            stats['AVG'] = round(h / ab, 3) if ab > 0 else 0.000
            
            # On-Base Percentage  
            plate_appearances = ab + bb + hbp
            stats['OBP'] = round((h + bb + hbp) / plate_appearances, 3) if plate_appearances > 0 else 0.000
            
            # Slugging Percentage
            total_bases = h + doubles + (triples * 2) + (hr * 3)
            stats['SLG'] = round(total_bases / ab, 3) if ab > 0 else 0.000
            
            # On-Base Plus Slugging
            stats['OPS'] = round(stats['OBP'] + stats['SLG'], 3)
            
            # Pitching derived stats
            ip = stats.get('IP', 0.0)
            er = stats.get('ER', 0)
            h_allowed = stats.get('H_A', 0)
            bb_allowed = stats.get('BB_A', 0)
            
            # ERA (Earned Run Average)
            stats['ERA'] = round((er * 9) / ip, 2) if ip > 0 else 0.00
            
            # WHIP (Walks + Hits per Innings Pitched)
            stats['WHIP'] = round((h_allowed + bb_allowed) / ip, 2) if ip > 0 else 0.00
            
            return stats
            
        except Exception as e:
            logger.error(f"Error calculating derived stats: {str(e)}")
            return stats

    @staticmethod
    def aggregate_team_stats(team_roster: List[Dict[str, Any]], season_year: int = None) -> Dict[str, Any]:
        """Aggregate individual player stats into team totals"""
        try:
            if season_year is None:
                season_year = datetime.now().year
            
            # Initialize team totals
            team_stats = {
                # Counting stats (sum across all players)
                'G': 0, 'AB': 0, 'R': 0, 'H': 0, '2B': 0, '3B': 0, 'HR': 0,
                'RBI': 0, 'SB': 0, 'CS': 0, 'BB': 0, 'HBP': 0, 'SO': 0,
                'GIDP': 0, 'E': 0,
                # Pitching counting stats
                'G_P': 0, 'GS': 0, 'W': 0, 'L': 0, 'SV': 0, 'BS': 0,
                'IP': 0.0, 'H_A': 0, 'ER': 0, 'BB_A': 0, 'SO_P': 0,
                'HR_A': 0, 'CG': 0, 'SHO': 0, 'QS': 0,
                # Derived stats (calculated from totals)
                'AVG': 0.000, 'OBP': 0.000, 'SLG': 0.000, 'OPS': 0.000,
                'ERA': 0.00, 'WHIP': 0.00
            }
            
            # Aggregate stats from all rostered players
            for player in team_roster:
                player_id = player['mlb_player_id']
                if not player_id:
                    continue
                
                # Get player's season stats from main database
                player_stats = ScoringEngineService.get_player_season_stats(player_id, season_year)
                
                if not player_stats:
                    continue
                
                # Calculate quality starts for pitchers
                if player_stats.get('GS', 0) > 0:  # Only for starting pitchers
                    player_stats['QS'] = ScoringEngineService.calculate_quality_starts(player_id, season_year)
                
                # Calculate derived stats for this player
                player_stats = ScoringEngineService.calculate_derived_stats(player_stats)
                
                # Add counting stats to team totals
                counting_stats = [
                    'G', 'AB', 'R', 'H', '2B', '3B', 'HR', 'RBI', 'SB', 'CS',
                    'BB', 'HBP', 'SO', 'GIDP', 'E', 'G_P', 'GS', 'W', 'L',
                    'SV', 'BS', 'H_A', 'ER', 'BB_A', 'SO_P', 'HR_A', 'CG', 'SHO', 'QS'
                ]
                
                for stat in counting_stats:
                    team_stats[stat] += player_stats.get(stat, 0)
                
                # Add innings pitched (decimal)
                team_stats['IP'] += player_stats.get('IP', 0.0)
            
            # Calculate team derived stats from aggregated totals
            team_stats = ScoringEngineService.calculate_derived_stats(team_stats)
            
            return team_stats
            
        except Exception as e:
            logger.error(f"Error aggregating team stats: {str(e)}")
            return {}

    @staticmethod
    def calculate_all_team_stats(league_id: str, season_year: int = None) -> Dict[str, Dict[str, Any]]:
        """Calculate aggregated stats for all teams in a league"""
        try:
            if season_year is None:
                season_year = datetime.now().year
            
            # Get all team rosters from league database
            rosters = ScoringEngineService.get_league_rosters(league_id)
            
            team_stats = {}
            
            for team_id, roster in rosters.items():
                logger.info(f"Calculating stats for team {team_id} with {len(roster)} players")
                
                # Aggregate this team's stats
                stats = ScoringEngineService.aggregate_team_stats(roster, season_year)
                
                # Add team metadata
                stats['team_id'] = team_id
                stats['roster_count'] = len(roster)
                stats['total_salary'] = sum(player.get('salary', 0) for player in roster)
                
                team_stats[team_id] = stats
            
            return team_stats
            
        except Exception as e:
            logger.error(f"Error calculating all team stats: {str(e)}")
            return {}

    @staticmethod
    def get_team_stats_summary(league_id: str, team_id: str, season_year: int = None) -> Dict[str, Any]:
        """Get detailed stats summary for a specific team"""
        try:
            if season_year is None:
                season_year = datetime.now().year
            
            # Get team roster from league database
            rosters = ScoringEngineService.get_league_rosters(league_id)
            
            if team_id not in rosters:
                return {'error': f'Team {team_id} not found in league {league_id}'}
            
            roster = rosters[team_id]
            
            # Aggregate team stats
            team_stats = ScoringEngineService.aggregate_team_stats(roster, season_year)
            
            # Get individual player contributions
            player_contributions = []
            for player in roster:
                player_id = player['mlb_player_id']
                if not player_id:
                    continue
                
                # Get stats from main database
                player_stats = ScoringEngineService.get_player_season_stats(player_id, season_year)
                
                if player_stats:
                    # Calculate QS for pitchers
                    if player_stats.get('GS', 0) > 0:
                        player_stats['QS'] = ScoringEngineService.calculate_quality_starts(player_id, season_year)
                    
                    player_stats = ScoringEngineService.calculate_derived_stats(player_stats)
                    
                    player_contributions.append({
                        'player_info': player,
                        'stats': player_stats
                    })
            
            return {
                'team_id': team_id,
                'season_year': season_year,
                'team_totals': team_stats,
                'roster_size': len(roster),
                'total_salary': sum(player.get('salary', 0) for player in roster),
                'player_contributions': player_contributions
            }
            
        except Exception as e:
            logger.error(f"Error getting team stats summary: {str(e)}")
            return {'error': str(e)}

    @staticmethod
    def get_league_stat_leaders(league_id: str, stat_category: str, limit: int = 10, season_year: int = None) -> List[Dict[str, Any]]:
        """Get top players in a specific stat category across the league"""
        try:
            if season_year is None:
                season_year = datetime.now().year
            
            # Get all team rosters
            rosters = ScoringEngineService.get_league_rosters(league_id)
            
            all_players = []
            for team_id, roster in rosters.items():
                for player in roster:
                    player_id = player['mlb_player_id']
                    if not player_id:
                        continue
                    
                    # Get player stats from main database
                    player_stats = ScoringEngineService.get_player_season_stats(player_id, season_year)
                    
                    if player_stats:
                        # Calculate derived stats and QS
                        if player_stats.get('GS', 0) > 0:
                            player_stats['QS'] = ScoringEngineService.calculate_quality_starts(player_id, season_year)
                        
                        player_stats = ScoringEngineService.calculate_derived_stats(player_stats)
                        
                        all_players.append({
                            'team_id': team_id,
                            'player_info': player,
                            'stats': player_stats
                        })
            
            # Sort by the requested stat category
            # Handle inverse stats (lower is better)
            inverse_stats = ['ERA', 'WHIP', 'L', 'BS', 'CS', 'E', 'GIDP']
            is_inverse = stat_category in inverse_stats
            
            # Filter out players with 0 in the stat (to avoid meaningless leaders)
            filtered_players = [p for p in all_players if p['stats'].get(stat_category, 0) > 0]
            
            sorted_players = sorted(
                filtered_players,
                key=lambda p: p['stats'].get(stat_category, 0),
                reverse=not is_inverse
            )
            
            # Format the results
            leaders = []
            for rank, player_data in enumerate(sorted_players[:limit], 1):
                leaders.append({
                    'rank': rank,
                    'team_id': player_data['team_id'],
                    'player_name': f"{player_data['player_info']['first_name']} {player_data['player_info']['last_name']}".strip(),
                    'position': player_data['player_info']['position'],
                    'mlb_team': player_data['player_info']['mlb_team'],
                    'stat_value': player_data['stats'].get(stat_category, 0),
                    'category': stat_category
                })
            
            return leaders
            
        except Exception as e:
            logger.error(f"Error getting league stat leaders: {str(e)}")
            return []