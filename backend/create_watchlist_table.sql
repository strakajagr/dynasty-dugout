-- Dynasty Dugout - Watch List Table
-- Database: Main postgres database (not league-specific)
-- Purpose: User-global watch list that shows player status across all leagues

-- Check if table exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_watchlist') THEN
        
        -- Create the table
        CREATE TABLE user_watchlist (
            watch_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id VARCHAR(255) NOT NULL, -- Cognito user ID (sub)
            player_id INTEGER NOT NULL REFERENCES mlb_players(player_id),
            added_at TIMESTAMP DEFAULT NOW(),
            notes TEXT, -- Optional user notes
            priority INTEGER DEFAULT 0, -- For sorting (0 = normal, higher = more important)
            CONSTRAINT unique_user_player UNIQUE(user_id, player_id)
        );

        -- Create indexes for performance
        CREATE INDEX idx_watchlist_user ON user_watchlist(user_id);
        CREATE INDEX idx_watchlist_player ON user_watchlist(player_id);
        CREATE INDEX idx_watchlist_priority ON user_watchlist(priority DESC);
        CREATE INDEX idx_watchlist_added_at ON user_watchlist(added_at DESC);

        RAISE NOTICE 'Table user_watchlist created successfully';
    ELSE
        RAISE NOTICE 'Table user_watchlist already exists';
    END IF;
END
$$;

-- Verify the table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_watchlist' 
ORDER BY ordinal_position;
