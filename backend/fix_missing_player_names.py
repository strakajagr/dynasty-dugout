"""
One-Time Fix: Backfill Missing Player Names in league_players
Fixes the search bug where players like Adam Frazier don't show up
when their player_name field is NULL or empty in league_players.

This script:
1. Finds all league_players with missing player_name
2. Fetches correct data from postgres.mlb_players
3. Updates league_players with correct name, position, mlb_team

Run this once to fix all existing data.
"""

import boto3
import os
import logging
from datetime import datetime

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

def get_value_safe(record, index, value_type='string'):
    """Safely extract value from RDS Data API record"""
    if index >= len(record):
        return None
    
    field = record[index]
    if not field or field.get('isNull'):
        return None
    
    if value_type == 'long':
        return field.get('longValue')
    elif value_type == 'string':
        return field.get('stringValue')
    else:
        return None

def fix_missing_player_names():
    """Main function to fix missing player names"""
    start_time = datetime.now()
    logger.info("=" * 80)
    logger.info("STARTING: Fix Missing Player Names in league_players")
    logger.info("=" * 80)
    
    try:
        # Step 1: Find all league_players with missing player_name
        logger.info("\n📋 Step 1: Finding league_players with missing names...")
        
        missing_names_query = """
            SELECT league_id, mlb_player_id, player_name, position, mlb_team
            FROM league_players
            WHERE player_name IS NULL 
               OR player_name = '' 
               OR player_name = 'Unknown' 
               OR player_name = 'Unknown Player'
            ORDER BY league_id, mlb_player_id
        """
        
        result = execute_sql(missing_names_query, database_name='leagues')
        
        if not result.get('records') or len(result['records']) == 0:
            logger.info("✅ No missing player names found! All data is clean.")
            return
        
        missing_count = len(result['records'])
        logger.info(f"⚠️  Found {missing_count} league_players with missing names")
        
        # Collect unique MLB player IDs that need lookup
        mlb_player_ids = set()
        for record in result['records']:
            mlb_id = get_value_safe(record, 1, 'long')
            if mlb_id:
                mlb_player_ids.add(mlb_id)
        
        logger.info(f"🔍 Need to lookup {len(mlb_player_ids)} unique MLB players")
        
        # Step 2: Fetch correct player info from mlb_players
        logger.info("\n📚 Step 2: Fetching correct player info from mlb_players...")
        
        if not mlb_player_ids:
            logger.error("No valid MLB player IDs found to lookup")
            return
        
        # Batch the lookups to avoid query size limits
        player_info_map = {}
        batch_size = 500
        mlb_ids_list = list(mlb_player_ids)
        
        for i in range(0, len(mlb_ids_list), batch_size):
            batch = mlb_ids_list[i:i+batch_size]
            ids_str = ','.join(str(id) for id in batch)
            
            lookup_query = f"""
                SELECT player_id, 
                       first_name || ' ' || last_name as player_name,
                       position,
                       mlb_team
                FROM mlb_players
                WHERE player_id IN ({ids_str})
            """
            
            lookup_result = execute_sql(lookup_query, database_name='postgres')
            
            if lookup_result.get('records'):
                for rec in lookup_result['records']:
                    player_id = get_value_safe(rec, 0, 'long')
                    player_name = get_value_safe(rec, 1, 'string')
                    position = get_value_safe(rec, 2, 'string')
                    mlb_team = get_value_safe(rec, 3, 'string')
                    
                    if player_id and player_name:
                        player_info_map[player_id] = {
                            'name': player_name.replace("'", "''"),  # Escape quotes
                            'position': position or 'UTIL',
                            'mlb_team': mlb_team or 'FA'
                        }
        
        logger.info(f"✅ Loaded info for {len(player_info_map)} players from mlb_players")
        
        if not player_info_map:
            logger.error("❌ No player info found in mlb_players table!")
            return
        
        # Step 3: Update league_players with correct info
        logger.info("\n🔧 Step 3: Updating league_players with correct names...")
        
        updated_count = 0
        not_found_count = 0
        error_count = 0
        
        for record in result['records']:
            league_id = get_value_safe(record, 0, 'string')
            mlb_id = get_value_safe(record, 1, 'long')
            current_name = get_value_safe(record, 2, 'string')
            
            if mlb_id in player_info_map:
                info = player_info_map[mlb_id]
                
                try:
                    update_sql = """
                        UPDATE league_players
                        SET player_name = :name,
                            position = :position,
                            mlb_team = :mlb_team
                        WHERE league_id = :league_id::uuid
                          AND mlb_player_id = :mlb_id
                    """
                    
                    execute_sql(
                        update_sql,
                        {
                            'league_id': league_id,
                            'mlb_id': mlb_id,
                            'name': info['name'],
                            'position': info['position'],
                            'mlb_team': info['mlb_team']
                        },
                        database_name='leagues'
                    )
                    
                    updated_count += 1
                    
                    if updated_count % 100 == 0:
                        logger.info(f"  Progress: Updated {updated_count}/{missing_count} players...")
                    
                except Exception as e:
                    logger.error(f"  ❌ Error updating player {mlb_id}: {e}")
                    error_count += 1
            else:
                logger.warning(f"  ⚠️  Player {mlb_id} not found in mlb_players table")
                not_found_count += 1
        
        # Step 4: Verify the fix
        logger.info("\n✔️  Step 4: Verifying fix...")
        
        verify_query = """
            SELECT COUNT(*) as still_missing
            FROM league_players
            WHERE player_name IS NULL 
               OR player_name = '' 
               OR player_name = 'Unknown' 
               OR player_name = 'Unknown Player'
        """
        
        verify_result = execute_sql(verify_query, database_name='leagues')
        
        still_missing = 0
        if verify_result.get('records'):
            still_missing = get_value_safe(verify_result['records'][0], 0, 'long') or 0
        
        # Final summary
        duration = (datetime.now() - start_time).total_seconds()
        
        logger.info("\n" + "=" * 80)
        logger.info("FIX COMPLETE!")
        logger.info("=" * 80)
        logger.info(f"✅ Successfully updated: {updated_count} players")
        logger.info(f"⚠️  Not found in mlb_players: {not_found_count} players")
        logger.info(f"❌ Errors: {error_count} players")
        logger.info(f"📊 Still missing names: {still_missing} players")
        logger.info(f"⏱️  Total time: {duration:.2f} seconds")
        logger.info("=" * 80)
        
        if still_missing > 0:
            logger.warning("\n⚠️  There are still players with missing names.")
            logger.warning("These players may not exist in the mlb_players table.")
            logger.warning("Consider running the MLB data import to add missing players.")
        else:
            logger.info("\n🎉 All player names have been successfully fixed!")
            logger.info("The search bug (e.g., Adam Frazier not showing up) should now be resolved.")
        
    except Exception as e:
        logger.error(f"\n❌ FATAL ERROR: {e}", exc_info=True)
        raise

def main():
    """Entry point"""
    logger.info("Dynasty Dugout - Player Name Fix Script")
    logger.info("This will fix missing player names in league_players table")
    logger.info("")
    
    try:
        fix_missing_player_names()
        logger.info("\n✅ Script completed successfully")
    except Exception as e:
        logger.error(f"\n❌ Script failed: {e}")
        raise

if __name__ == "__main__":
    main()
