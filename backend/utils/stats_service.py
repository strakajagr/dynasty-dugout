#!/usr/bin/env python3
"""
MLB Stats Service
Professional service for fetching and updating MLB player statistics
"""

import boto3
import json
import requests
import logging
from datetime import datetime, timedelta
import time
from typing import List, Dict, Any, Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class MLBStatsService:
    """Service for managing MLB player statistics"""
    
    def __init__(self):
        """Initialize the stats service"""
        self.rds_client = boto3.client('rds-data', region_name='us-east-1')
        self.database_config = {
            'resourceArn': 'arn:aws:rds:us-east-1:584812014683:cluster:fantasy-baseball',
            'secretArn': 'arn:aws:secretsmanager:us-east-1:584812014683:secret:fantasy-db-credentials-MoEtfC',
            'database': 'postgres'
        }
        
    def execute_sql(self, sql: str, parameters: Optional[List] = None) -> Dict:
        """Execute SQL query using RDS Data API"""
        try:
            params = {
                'resourceArn': self.database_config['resourceArn'],
                'secretArn': self.database_config['secretArn'],
                'database': self.database_config['database'],
                'sql': sql
            }
            
            if parameters:
                params['parameters'] = parameters
                
            response = self.rds_client.execute_statement(**params)
            return response
            
        except Exception as e:
            logger.error(f"Database error: {str(e)}")
            raise
    
    def get_players_needing_stats(self, limit: int = 50) -> List[Dict]:
        """Get players that need stats updates"""
        sql = """
        SELECT p.player_id, p.mlb_id, p.first_name, p.last_name, p.position
        FROM mlb_players p
        LEFT JOIN player_stats s ON p.player_id = s.player_id 
            AND s.season_year = :season_year
        WHERE p.is_active = true 
            AND p.mlb_id IS NOT NULL 
            AND s.player_id IS NULL
        ORDER BY p.last_name, p.first_name
        LIMIT :limit
        """
        
        parameters = [
            {'name': 'season_year', 'value': {'longValue': 2025}},
            {'name': 'limit', 'value': {'longValue': limit}}
        ]
        
        response = self.execute_sql(sql, parameters)
        
        players = []
        for record in response.get('records', []):
            players.append({
                'player_id': record[0]['longValue'],
                'mlb_id': record[1]['longValue'] if record[1].get('longValue') else None,
                'first_name': record[2]['stringValue'] if record[2].get('stringValue') else '',
                'last_name': record[3]['stringValue'] if record[3].get('stringValue') else '',
                'position': record[4]['stringValue'] if record[4].get('stringValue') else ''
            })
        
        return players
    
    def fetch_mlb_stats(self, mlb_id: int) -> Optional[Dict]:
        """Fetch stats from MLB Stats API"""
        try:
            url = f"https://statsapi.mlb.com/api/v1/people/{mlb_id}/stats"
            params = {
                'stats': 'season',
                'season': '2025'
            }
            
            logger.info(f"Fetching stats for MLB ID {mlb_id}")
            response = requests.get(url, params=params, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                return data
            else:
                logger.warning(f"MLB API returned status {response.status_code} for player {mlb_id}")
                return None
                
        except requests.RequestException as e:
            logger.error(f"Error fetching stats for MLB ID {mlb_id}: {e}")
            return None
    
    def process_hitting_stats(self, stats_data: Dict, player_id: int, mlb_id: int) -> bool:
        """Process and insert hitting statistics"""
        try:
            hitting_stats = None
            
            # Find hitting stats in the response
            for stat_group in stats_data.get('stats', []):
                for split in stat_group.get('splits', []):
                    stat = split.get('stat', {})
                    if 'atBats' in stat:  # This indicates hitting stats
                        hitting_stats = stat
                        break
                if hitting_stats:
                    break
            
            if not hitting_stats:
                logger.warning(f"No hitting stats found for player {mlb_id}")
                return False
            
            # Insert hitting stats
            sql = """
            INSERT INTO player_stats (
                player_id, week_number, season_year, games_played, at_bats, hits, runs, rbis,
                home_runs, doubles, triples, stolen_bases, walks, strikeouts, hit_by_pitch,
                avg, obp, slg, ops, fantasy_points
            ) VALUES (
                :player_id, 1, 2025, :games_played, :at_bats, :hits, :runs, :rbis,
                :home_runs, :doubles, :triples, :stolen_bases, :walks, :strikeouts, :hit_by_pitch,
                :avg, :obp, :slg, :ops, :fantasy_points
            )
            """
            
            # Calculate fantasy points (basic scoring)
            fantasy_points = (
                hitting_stats.get('hits', 0) * 1 +
                hitting_stats.get('homeRuns', 0) * 4 +
                hitting_stats.get('rbi', 0) * 1 +
                hitting_stats.get('runs', 0) * 1 +
                hitting_stats.get('stolenBases', 0) * 2
            )
            
            parameters = [
                {'name': 'player_id', 'value': {'longValue': player_id}},
                {'name': 'games_played', 'value': {'longValue': hitting_stats.get('gamesPlayed', 0)}},
                {'name': 'at_bats', 'value': {'longValue': hitting_stats.get('atBats', 0)}},
                {'name': 'hits', 'value': {'longValue': hitting_stats.get('hits', 0)}},
                {'name': 'runs', 'value': {'longValue': hitting_stats.get('runs', 0)}},
                {'name': 'rbis', 'value': {'longValue': hitting_stats.get('rbi', 0)}},
                {'name': 'home_runs', 'value': {'longValue': hitting_stats.get('homeRuns', 0)}},
                {'name': 'doubles', 'value': {'longValue': hitting_stats.get('doubles', 0)}},
                {'name': 'triples', 'value': {'longValue': hitting_stats.get('triples', 0)}},
                {'name': 'stolen_bases', 'value': {'longValue': hitting_stats.get('stolenBases', 0)}},
                {'name': 'walks', 'value': {'longValue': hitting_stats.get('baseOnBalls', 0)}},
                {'name': 'strikeouts', 'value': {'longValue': hitting_stats.get('strikeOuts', 0)}},
                {'name': 'hit_by_pitch', 'value': {'longValue': hitting_stats.get('hitByPitch', 0)}},
                {'name': 'avg', 'value': {'doubleValue': float(hitting_stats.get('avg', '0'))}},
                {'name': 'obp', 'value': {'doubleValue': float(hitting_stats.get('obp', '0'))}},
                {'name': 'slg', 'value': {'doubleValue': float(hitting_stats.get('slg', '0'))}},
                {'name': 'ops', 'value': {'doubleValue': float(hitting_stats.get('ops', '0'))}},
                {'name': 'fantasy_points', 'value': {'doubleValue': fantasy_points}}
            ]
            
            self.execute_sql(sql, parameters)
            logger.info(f"✅ HITTER: {hitting_stats.get('gamesPlayed', 0)}G, {hitting_stats.get('avg', '0')} AVG, {hitting_stats.get('homeRuns', 0)}HR, {hitting_stats.get('rbi', 0)}RBI")
            return True
            
        except Exception as e:
            logger.error(f"Error processing hitting stats for player {player_id}: {e}")
            return False
    
    def process_pitching_stats(self, stats_data: Dict, player_id: int, mlb_id: int) -> bool:
        """Process and insert pitching statistics"""
        try:
            pitching_stats = None
            
            # Find pitching stats in the response
            for stat_group in stats_data.get('stats', []):
                for split in stat_group.get('splits', []):
                    stat = split.get('stat', {})
                    if 'inningsPitched' in stat:  # This indicates pitching stats
                        pitching_stats = stat
                        break
                if pitching_stats:
                    break
            
            if not pitching_stats:
                logger.warning(f"No pitching stats found for player {mlb_id}")
                return False
            
            # Insert pitching stats
            sql = """
            INSERT INTO player_stats (
                player_id, week_number, season_year, games_played, innings_pitched, wins, losses,
                saves, earned_runs, hits_allowed, walks_allowed, strikeouts_pitched, era, whip, fantasy_points
            ) VALUES (
                :player_id, 1, 2025, :games_played, :innings_pitched, :wins, :losses,
                :saves, :earned_runs, :hits_allowed, :walks_allowed, :strikeouts_pitched, :era, :whip, :fantasy_points
            )
            """
            
            # Calculate fantasy points (basic pitching scoring)
            fantasy_points = (
                pitching_stats.get('wins', 0) * 5 +
                pitching_stats.get('saves', 0) * 3 +
                pitching_stats.get('strikeOuts', 0) * 1 +
                float(pitching_stats.get('inningsPitched', '0')) * 1
            )
            
            parameters = [
                {'name': 'player_id', 'value': {'longValue': player_id}},
                {'name': 'games_played', 'value': {'longValue': pitching_stats.get('gamesPlayed', 0)}},
                {'name': 'innings_pitched', 'value': {'doubleValue': float(pitching_stats.get('inningsPitched', '0'))}},
                {'name': 'wins', 'value': {'longValue': pitching_stats.get('wins', 0)}},
                {'name': 'losses', 'value': {'longValue': pitching_stats.get('losses', 0)}},
                {'name': 'saves', 'value': {'longValue': pitching_stats.get('saves', 0)}},
                {'name': 'earned_runs', 'value': {'longValue': pitching_stats.get('earnedRuns', 0)}},
                {'name': 'hits_allowed', 'value': {'longValue': pitching_stats.get('hits', 0)}},
                {'name': 'walks_allowed', 'value': {'longValue': pitching_stats.get('baseOnBalls', 0)}},
                {'name': 'strikeouts_pitched', 'value': {'longValue': pitching_stats.get('strikeOuts', 0)}},
                {'name': 'era', 'value': {'doubleValue': float(pitching_stats.get('era', '0'))}},
                {'name': 'whip', 'value': {'doubleValue': float(pitching_stats.get('whip', '0'))}},
                {'name': 'fantasy_points', 'value': {'doubleValue': fantasy_points}}
            ]
            
            self.execute_sql(sql, parameters)
            logger.info(f"✅ PITCHER: {pitching_stats.get('gamesPlayed', 0)}G, {pitching_stats.get('inningsPitched', '0')}IP, {pitching_stats.get('era', '0')}ERA, {pitching_stats.get('wins', 0)}W")
            return True
            
        except Exception as e:
            logger.error(f"Error processing pitching stats for player {player_id}: {e}")
            return False
    
    def update_player_stats(self, player: Dict) -> bool:
        """Update stats for a single player"""
        try:
            mlb_id = player['mlb_id']
            if not mlb_id:
                logger.warning(f"No MLB ID for player {player['first_name']} {player['last_name']}")
                return False
            
            logger.info(f"[{player['player_id']}] {player['first_name']} {player['last_name']} ({player['position']}) - MLB ID: {mlb_id}")
            
            # Fetch stats from MLB API
            stats_data = self.fetch_mlb_stats(mlb_id)
            if not stats_data:
                return False
            
            # Determine if player is pitcher or hitter
            position = player['position'].upper()
            is_pitcher = position in ['P', 'SP', 'RP', 'CL']
            
            success = False
            if is_pitcher:
                success = self.process_pitching_stats(stats_data, player['player_id'], mlb_id)
            else:
                success = self.process_hitting_stats(stats_data, player['player_id'], mlb_id)
            
            return success
            
        except Exception as e:
            logger.error(f"Error updating stats for player {player.get('player_id', 'unknown')}: {e}")
            return False
    
    def run_daily_update(self, max_players: int = 50) -> Dict[str, Any]:
        """Run the daily stats update process"""
        start_time = datetime.now()
        logger.info("🚀 Starting daily MLB stats update...")
        
        try:
            # Get players needing updates
            players = self.get_players_needing_stats(max_players)
            logger.info(f"📊 Found {len(players)} players needing stats updates")
            
            if not players:
                logger.info("✅ All players already have current stats")
                return {
                    'success': True,
                    'processed': 0,
                    'errors': 0,
                    'message': 'All players up to date'
                }
            
            processed = 0
            errors = 0
            
            for i, player in enumerate(players):
                try:
                    logger.info(f"[{i+1}/{len(players)}] Processing {player['first_name']} {player['last_name']}")
                    
                    success = self.update_player_stats(player)
                    if success:
                        processed += 1
                    else:
                        errors += 1
                    
                    # Rate limiting - be respectful to MLB API
                    if i < len(players) - 1:  # Don't sleep after last player
                        time.sleep(1)
                        
                except Exception as e:
                    logger.error(f"Error processing player {player.get('first_name', '')} {player.get('last_name', '')}: {e}")
                    errors += 1
            
            duration = datetime.now() - start_time
            logger.info(f"🎉 Daily update complete! Processed: {processed}, Errors: {errors}, Duration: {duration}")
            
            return {
                'success': True,
                'processed': processed,
                'errors': errors,
                'duration_seconds': duration.total_seconds(),
                'timestamp': start_time.isoformat()
            }
            
        except Exception as e:
            logger.error(f"Daily update failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'timestamp': start_time.isoformat()
            }

def main():
    """Main function for command line execution"""
    service = MLBStatsService()
    result = service.run_daily_update(max_players=100)
    
    if result['success']:
        print(f"✅ Successfully processed {result['processed']} players")
    else:
        print(f"❌ Update failed: {result['error']}")
    
    return result

if __name__ == "__main__":
    main()