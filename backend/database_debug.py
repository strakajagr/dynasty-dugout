# database_debug.py - Run this in your backend folder to check email verification setup

import sys
import os
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'src'))

import boto3
import json

# Import from the correct path now that we know the structure
try:
    from core.database import execute_sql
    print("✅ Successfully imported execute_sql")
except ImportError as e:
    print(f"❌ Could not import execute_sql: {e}")
    # Fallback implementation
    def execute_sql(sql, parameters=None):
        rds_data = boto3.client('rds-data', region_name='us-east-1')
        
        cluster_arn = 'arn:aws:rds:us-east-1:584812014683:cluster:fantasy-baseball'
        secret_arn = 'arn:aws:secretsmanager:us-east-1:584812014683:secret:rds!cluster-a4ca625a-7cb4-484a-8707-80f27e403c70-pwORGg'
        database = 'postgres'
        
        kwargs = {
            'resourceArn': cluster_arn,
            'secretArn': secret_arn,
            'database': database,
            'sql': sql
        }
        
        if parameters:
            kwargs['parameters'] = parameters
            
        return rds_data.execute_statement(**kwargs)

def check_email_verification_setup():
    """Debug email verification system"""
    print("🔍 DEBUGGING EMAIL VERIFICATION SYSTEM")
    print("=" * 50)
    
    # 1. Check if email verification tables exist
    print("\n1. Checking database tables...")
    
    tables_to_check = [
        'user_profiles',
        'email_verifications', 
        'verification_codes',
        'users'
    ]
    
    for table in tables_to_check:
        try:
            result = execute_sql(
                sql="SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = :table_name)",
                parameters=[{"name": "table_name", "value": {"stringValue": table}}]
            )
            exists = result['records'][0][0]['booleanValue'] if result['records'] else False
            status = "✅ EXISTS" if exists else "❌ MISSING"
            print(f"   {table}: {status}")
            
            if exists:
                # Get column info
                column_result = execute_sql(
                    sql="SELECT column_name, data_type FROM information_schema.columns WHERE table_name = :table_name",
                    parameters=[{"name": "table_name", "value": {"stringValue": table}}]
                )
                columns = [f"{col[0]['stringValue']}({col[1]['stringValue']})" for col in column_result['records']]
                print(f"     Columns: {', '.join(columns)}")
                
        except Exception as e:
            print(f"   {table}: ❌ ERROR - {str(e)}")
    
    # 2. Check AWS SES configuration
    print("\n2. Checking AWS SES configuration...")
    try:
        ses_client = boto3.client('ses', region_name='us-east-1')
        
        # Check SES sending quota
        quota = ses_client.get_send_quota()
        print(f"   SES Send Quota: {quota['Max24HourSend']} emails/24hrs")
        print(f"   SES Sent Today: {quota['SentLast24Hours']}")
        
        # Check verified email addresses
        verified = ses_client.list_verified_email_addresses()
        print(f"   Verified Email Addresses: {verified['VerifiedEmailAddresses']}")
        
        # Check SES sending statistics
        stats = ses_client.get_send_statistics()
        if stats['SendDataPoints']:
            latest = stats['SendDataPoints'][-1]
            print(f"   Recent Bounces: {latest.get('Bounces', 0)}")
            print(f"   Recent Complaints: {latest.get('Complaints', 0)}")
            print(f"   Recent Rejects: {latest.get('Rejects', 0)}")
        
    except Exception as e:
        print(f"   ❌ SES Error: {str(e)}")
    
    # 3. Test database connection
    print("\n3. Testing database connection...")
    try:
        result = execute_sql(
            sql="SELECT NOW() as current_time, version() as db_version"
        )
        if result['records']:
            current_time = result['records'][0][0]['stringValue']
            db_version = result['records'][0][1]['stringValue'] 
            print(f"   ✅ Connected to PostgreSQL")
            print(f"   Current Time: {current_time}")
            print(f"   Version: {db_version}")
    except Exception as e:
        print(f"   ❌ Database connection failed: {str(e)}")
    
    # 4. Check for recent verification attempts
    print("\n4. Checking recent verification attempts...")
    try:
        result = execute_sql(
            sql="""
            SELECT table_name FROM information_schema.tables 
            WHERE table_name IN ('email_verifications', 'verification_codes', 'user_profiles')
            """
        )
        
        for record in result['records']:
            table_name = record[0]['stringValue']
            count_result = execute_sql(
                sql=f"SELECT COUNT(*) FROM {table_name}"
            )
            count = count_result['records'][0][0]['longValue'] if count_result['records'] else 0
            print(f"   {table_name}: {count} records")
            
    except Exception as e:
        print(f"   ❌ Error checking verification attempts: {str(e)}")

if __name__ == "__main__":
    check_email_verification_setup()