"""
Migration Script - Add player info columns to existing leagues
Run this once to update all existing leagues with player_name, position, mlb_team data
"""

import boto3
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database configuration
DB_CLUSTER_ARN = os.environ.get('DB_CLUSTER_ARN', 'arn:aws:rds:us-east-1:584812014683:cluster:fantasy-baseball-serverless')
DB_SECRET_ARN = os.environ.get('DB_SECRET_ARN', 'arn:aws:secretsmanager:us-east-1:584812014683:secret:fantasy-baseball-serverless-secret-RBoJdb')

rds_client = boto3.client('rds-data', region_name='us-east-1')

def execute_sql(sql, parameters=None, database_name='postgres'):
    """Execute SQL with RDS Data API"""
    try:
        params = {
            'resourceArn': DB_CLUSTER_ARN,
            'secretArn': DB_SECRET_ARN,
            'database': database_name,
            'sql': sql
        }
        
        if parameters:
            rds_params = []
            for key, value in parameters.items():
                param = {'name': key}
                if value is None:
                    param['value'] = {'isNull': True}
                elif isinstance(value, str):
                    param['value'] = {'stringValue': value}
                elif isinstance(value, bool):
                    param['value'] = {'booleanValue': value}
                elif isinstance(value, int):
                    param['value'] = {'longValue': value}
                elif isinstance(value, float):
                    param['value'] = {'doubleValue': value}
                else:
                    param['value'] = {'stringValue': str(value)}
                rds_params.append(param)
            
            if rds_params:
                params['parameters'] = rds_params
        
        response = rds_client.execute_statement(**params)
        return response
        
    except Exception as e:
        logger.error(f"Database error on '{database_name}': {str(e)}")
        raise

def add_missing_columns():
    """Add missing columns to league_players table if they don't exist"""
    logger.info("Step 1: Adding missing columns to league_players table...")
    
    columns_to_add = [
        ('player_name', 'VARCHAR(255)'),
        ('position', 'VARCHAR(50)'),
        ('mlb_team', 'VARCHAR(50)')
    ]
    
    for column_name, column_type in columns_to_add:
        try:
            # Check if column exists
            result = execute_sql(
                """SELECT column_name FROM information_schema.columns 
                   WHERE table_name = 'league_players' 
                   AND table_schema = 'public' 
                   AND column_name = :column_name""",
                {'column_name': column_name},
                database_name='leagues'
            )
            
            if not result.get('records'):
                logger.info(f"  Adding {column_name} column...")
                execute_sql(
                    f"ALTER TABLE league_players ADD COLUMN {column_name} {column_type}",
                    database_name='leagues'
                )
                logger.info(f"  ✅ Added {column_name} column")
            else:
                logger.info(f"  ✓ {column_name} column already exists")
                
        except Exception as e:
            logger.error(f"  ❌ Error adding {column_name}: {e}")
            return False
    
    return True

def populate_player_info():
    """Populate player_name, position, mlb_team for all existing leagues"""
    logger.info("Step 2: Populating player info for all existing leagues...")
    
    try:
        # Get all unique league_ids
        leagues_result = execute_sql(
            "SELECT DISTINCT league_id FROM league_players",
            database_name='leagues'
        )
        
        if not leagues_result.get('records'):
            logger.info("  No leagues found to update")
            return True
        
        league_ids = [rec[0].get('stringValue') for rec in leagues_result['records']]
        logger.info(f"  Found {len(league_ids)} leagues to update")
        
        # Get all player info from postgres
        logger.info("  Fetching player info from postgres...")
        players_result = execute_sql(
            """SELECT player_id, 
                      first_name || ' ' || last_name as player_name,
                      position,
                      mlb_team
               FROM mlb_players
               WHERE is_active = true""",
            database_name='postgres'
        )
        
        if not players_result.get('records'):
            logger.error("  No players found in postgres")
            return False
        
        # Create a map of player_id -> info
        player_map = {}
        for rec in players_result['records']:
            player_id = rec[0].get('longValue')
            player_name = rec[1].get('stringValue', 'Unknown')
            position = rec[2].get('stringValue', 'UTIL')
            mlb_team = rec[3].get('stringValue', 'FA')
            
            player_map[player_id] = {
                'name': player_name.replace("'", "''"),  # Escape quotes
                'position': position,
                'mlb_team': mlb_team
            }
        
        logger.info(f"  Loaded info for {len(player_map)} players")
        
        # Update each league
        total_updated = 0
        for league_id in league_ids:
            try:
                # Get all players in this league
                league_players = execute_sql(
                    """SELECT mlb_player_id FROM league_players 
                       WHERE league_id = :league_id::uuid
                       AND (player_name IS NULL OR position IS NULL OR mlb_team IS NULL)""",
                    {'league_id': league_id},
                    database_name='leagues'
                )
                
                if not league_players.get('records'):
                    logger.info(f"    League {league_id[:8]}... already has complete data")
                    continue
                
                # Update in batches
                update_count = 0
                for rec in league_players['records']:
                    player_id = rec[0].get('longValue')
                    if player_id in player_map:
                        info = player_map[player_id]
                        execute_sql(
                            """UPDATE league_players 
                               SET player_name = :name,
                                   position = :position,
                                   mlb_team = :mlb_team
                               WHERE league_id = :league_id::uuid 
                               AND mlb_player_id = :player_id""",
                            {
                                'league_id': league_id,
                                'player_id': player_id,
                                'name': info['name'],
                                'position': info['position'],
                                'mlb_team': info['mlb_team']
                            },
                            database_name='leagues'
                        )
                        update_count += 1
                
                logger.info(f"    League {league_id[:8]}... updated {update_count} players")
                total_updated += update_count
                
            except Exception as e:
                logger.error(f"    Error updating league {league_id}: {e}")
                continue
        
        logger.info(f"  ✅ Updated {total_updated} total player records across all leagues")
        return True
        
    except Exception as e:
        logger.error(f"  ❌ Error populating player info: {e}")
        return False

def verify_migration():
    """Verify the migration was successful"""
    logger.info("Step 3: Verifying migration...")
    
    try:
        # Check for any null values
        result = execute_sql(
            """SELECT COUNT(*) as null_count
               FROM league_players
               WHERE player_name IS NULL 
                  OR position IS NULL 
                  OR mlb_team IS NULL""",
            database_name='leagues'
        )
        
        if result and result.get('records'):
            null_count = result['records'][0][0].get('longValue', 0)
            if null_count > 0:
                logger.warning(f"  ⚠️ Found {null_count} records with null values")
            else:
                logger.info("  ✅ All records have complete player info")
        
        # Get sample data
        sample = execute_sql(
            """SELECT mlb_player_id, player_name, position, mlb_team
               FROM league_players
               LIMIT 5""",
            database_name='leagues'
        )
        
        if sample and sample.get('records'):
            logger.info("  Sample data:")
            for rec in sample['records']:
                player_id = rec[0].get('longValue')
                name = rec[1].get('stringValue', 'NULL')
                pos = rec[2].get('stringValue', 'NULL')
                team = rec[3].get('stringValue', 'NULL')
                logger.info(f"    Player {player_id}: {name} ({pos}, {team})")
        
        return True
        
    except Exception as e:
        logger.error(f"  ❌ Error verifying migration: {e}")
        return False

def main():
    """Main migration function"""
    logger.info("=== Starting League Players Migration ===")
    logger.info("This will add player_name, position, mlb_team to all existing leagues")
    
    # Step 1: Add columns
    if not add_missing_columns():
        logger.error("Failed to add columns. Aborting migration.")
        return
    
    # Step 2: Populate data
    if not populate_player_info():
        logger.error("Failed to populate player info. Migration incomplete.")
        return
    
    # Step 3: Verify
    verify_migration()
    
    logger.info("=== Migration Complete ===")

if __name__ == "__main__":
    main()