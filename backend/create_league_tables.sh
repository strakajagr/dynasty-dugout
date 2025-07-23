#!/bin/bash

# Dynasty Dugout League Management Database Setup
# Run each SQL statement individually for AWS RDS Data API

RESOURCE_ARN="arn:aws:rds:us-east-1:584812014683:cluster:fantasy-baseball"
SECRET_ARN="arn:aws:secretsmanager:us-east-1:584812014683:secret:fantasy-db-credentials-MoEtfC"
DATABASE="postgres"

echo "Creating Dynasty Dugout league management tables..."

# Create leagues table
echo "Creating leagues table..."
aws rds-data execute-statement \
  --resource-arn "$RESOURCE_ARN" \
  --secret-arn "$SECRET_ARN" \
  --database "$DATABASE" \
  --sql "CREATE TABLE leagues (
    league_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_name VARCHAR(255) NOT NULL,
    commissioner_user_id VARCHAR(255) NOT NULL,
    player_pool VARCHAR(50) DEFAULT 'all_mlb',
    same_player_multiple_teams BOOLEAN DEFAULT FALSE,
    use_divisions BOOLEAN DEFAULT FALSE,
    number_of_divisions INTEGER DEFAULT 1,
    scoring_system VARCHAR(100) NOT NULL,
    scoring_categories JSONB DEFAULT '{}',
    non_h2h_past_week_standings BOOLEAN DEFAULT TRUE,
    split_season_standings BOOLEAN DEFAULT FALSE,
    max_players_total INTEGER DEFAULT 23,
    min_hitters_starting INTEGER DEFAULT 13,
    max_pitchers_starting INTEGER DEFAULT 10,
    min_pitchers_starting INTEGER DEFAULT 10,
    hitter_positions JSONB DEFAULT '{}',
    pitcher_positions JSONB DEFAULT '{}',
    current_year_games_for_eligibility INTEGER DEFAULT 10,
    previous_year_games_for_eligibility INTEGER DEFAULT 10,
    rookie_keeps_default_position BOOLEAN DEFAULT FALSE,
    force_exact_position_counts BOOLEAN DEFAULT TRUE,
    stat_start_date DATE,
    stat_end_date DATE,
    first_transaction_date DATE,
    weekly_transaction_deadline VARCHAR(20) DEFAULT 'monday',
    draft_date DATE,
    use_salaries BOOLEAN DEFAULT TRUE,
    salary_cap DECIMAL(10,2),
    salary_floor DECIMAL(10,2),
    use_contract_years BOOLEAN DEFAULT TRUE,
    max_contract_years INTEGER DEFAULT 5,
    use_waivers BOOLEAN DEFAULT FALSE,
    waiver_system VARCHAR(50) DEFAULT 'free_agent_only',
    daily_roster_updates BOOLEAN DEFAULT FALSE,
    treat_family_leave_as_dl BOOLEAN DEFAULT FALSE,
    exclude_dl_from_draft BOOLEAN DEFAULT FALSE,
    ohtani_treatment VARCHAR(50) DEFAULT 'one_player_one_team',
    ohtani_usage VARCHAR(50) DEFAULT 'either_not_both',
    ohtani_roster_slots INTEGER DEFAULT 1,
    ohtani_pitcher_active_from_start BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'setup',
    season_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);"

# Create teams table
echo "Creating teams table..."
aws rds-data execute-statement \
  --resource-arn "$RESOURCE_ARN" \
  --secret-arn "$SECRET_ARN" \
  --database "$DATABASE" \
  --sql "CREATE TABLE teams (
    team_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL,
    team_name VARCHAR(255) NOT NULL,
    team_key VARCHAR(10),
    primary_owner_user_id VARCHAR(255) NOT NULL,
    co_owner_user_id VARCHAR(255),
    division_id INTEGER,
    division_name VARCHAR(100),
    current_salary_total DECIMAL(10,2) DEFAULT 0.00,
    salary_cap DECIMAL(10,2),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_team_league FOREIGN KEY (league_id) REFERENCES leagues(league_id) ON DELETE CASCADE,
    CONSTRAINT unique_team_name_per_league UNIQUE (league_id, team_name)
);"

# Create rosters table
echo "Creating rosters table..."
aws rds-data execute-statement \
  --resource-arn "$RESOURCE_ARN" \
  --secret-arn "$SECRET_ARN" \
  --database "$DATABASE" \
  --sql "CREATE TABLE rosters (
    roster_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL,
    team_id UUID NOT NULL,
    player_id INTEGER NOT NULL,
    roster_status VARCHAR(20) DEFAULT 'active',
    lineup_position VARCHAR(10),
    salary DECIMAL(8,2) DEFAULT 0.00,
    contract_years_remaining INTEGER DEFAULT 1,
    contract_year_signed INTEGER,
    keeper_eligible BOOLEAN DEFAULT TRUE,
    acquisition_type VARCHAR(50) DEFAULT 'draft',
    acquisition_date DATE DEFAULT CURRENT_DATE,
    acquisition_cost DECIMAL(8,2),
    is_locked BOOLEAN DEFAULT FALSE,
    lock_reason VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_roster_league FOREIGN KEY (league_id) REFERENCES leagues(league_id) ON DELETE CASCADE,
    CONSTRAINT fk_roster_team FOREIGN KEY (team_id) REFERENCES teams(team_id) ON DELETE CASCADE,
    CONSTRAINT fk_roster_player FOREIGN KEY (player_id) REFERENCES players(player_id),
    CONSTRAINT unique_player_per_league UNIQUE (league_id, player_id)
);"

# Create league_memberships table
echo "Creating league_memberships table..."
aws rds-data execute-statement \
  --resource-arn "$RESOURCE_ARN" \
  --secret-arn "$SECRET_ARN" \
  --database "$DATABASE" \
  --sql "CREATE TABLE league_memberships (
    membership_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'owner',
    team_id UUID,
    can_make_trades BOOLEAN DEFAULT TRUE,
    can_add_drop_players BOOLEAN DEFAULT TRUE,
    can_set_lineups BOOLEAN DEFAULT TRUE,
    commissioner_privileges BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    invite_status VARCHAR(20) DEFAULT 'active',
    joined_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_membership_league FOREIGN KEY (league_id) REFERENCES leagues(league_id) ON DELETE CASCADE,
    CONSTRAINT fk_membership_team FOREIGN KEY (team_id) REFERENCES teams(team_id),
    CONSTRAINT unique_user_per_league UNIQUE (league_id, user_id)
);"

# Create league_scoring_categories table
echo "Creating league_scoring_categories table..."
aws rds-data execute-statement \
  --resource-arn "$RESOURCE_ARN" \
  --secret-arn "$SECRET_ARN" \
  --database "$DATABASE" \
  --sql "CREATE TABLE league_scoring_categories (
    category_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL,
    category_type VARCHAR(20) NOT NULL,
    category_name VARCHAR(50) NOT NULL,
    category_display_name VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    point_value DECIMAL(5,2),
    weight DECIMAL(3,2) DEFAULT 1.0,
    is_inverse BOOLEAN DEFAULT FALSE,
    decimal_places INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    CONSTRAINT fk_scoring_league FOREIGN KEY (league_id) REFERENCES leagues(league_id) ON DELETE CASCADE,
    CONSTRAINT unique_category_per_league UNIQUE (league_id, category_name)
);"

# Create transactions table
echo "Creating transactions table..."
aws rds-data execute-statement \
  --resource-arn "$RESOURCE_ARN" \
  --secret-arn "$SECRET_ARN" \
  --database "$DATABASE" \
  --sql "CREATE TABLE transactions (
    transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    transaction_date TIMESTAMP DEFAULT NOW(),
    effective_date DATE DEFAULT CURRENT_DATE,
    players_data JSONB NOT NULL,
    teams_involved UUID[],
    salary_changes JSONB,
    status VARCHAR(20) DEFAULT 'pending',
    processed_by VARCHAR(255),
    description TEXT,
    commissioner_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_transaction_league FOREIGN KEY (league_id) REFERENCES leagues(league_id) ON DELETE CASCADE
);"

# Create draft_picks table
echo "Creating draft_picks table..."
aws rds-data execute-statement \
  --resource-arn "$RESOURCE_ARN" \
  --secret-arn "$SECRET_ARN" \
  --database "$DATABASE" \
  --sql "CREATE TABLE draft_picks (
    pick_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL,
    team_id UUID NOT NULL,
    player_id INTEGER NOT NULL,
    draft_round INTEGER NOT NULL,
    pick_number INTEGER NOT NULL,
    round_pick INTEGER NOT NULL,
    bid_amount DECIMAL(8,2),
    final_salary DECIMAL(8,2),
    draft_date TIMESTAMP DEFAULT NOW(),
    pick_time_seconds INTEGER,
    CONSTRAINT fk_draft_league FOREIGN KEY (league_id) REFERENCES leagues(league_id) ON DELETE CASCADE,
    CONSTRAINT fk_draft_team FOREIGN KEY (team_id) REFERENCES teams(team_id) ON DELETE CASCADE,
    CONSTRAINT fk_draft_player FOREIGN KEY (player_id) REFERENCES players(player_id),
    CONSTRAINT unique_pick_per_draft UNIQUE (league_id, pick_number)
);"

# Create league_messages table
echo "Creating league_messages table..."
aws rds-data execute-statement \
  --resource-arn "$RESOURCE_ARN" \
  --secret-arn "$SECRET_ARN" \
  --database "$DATABASE" \
  --sql "CREATE TABLE league_messages (
    message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL,
    sender_user_id VARCHAR(255) NOT NULL,
    message_type VARCHAR(50) DEFAULT 'general',
    subject VARCHAR(255),
    message_content TEXT NOT NULL,
    recipient_type VARCHAR(20) DEFAULT 'all',
    recipient_user_ids VARCHAR(255)[],
    is_pinned BOOLEAN DEFAULT FALSE,
    is_urgent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_message_league FOREIGN KEY (league_id) REFERENCES leagues(league_id) ON DELETE CASCADE
);"

# Create indexes
echo "Creating indexes..."

aws rds-data execute-statement --resource-arn "$RESOURCE_ARN" --secret-arn "$SECRET_ARN" --database "$DATABASE" --sql "CREATE INDEX idx_leagues_commissioner ON leagues(commissioner_user_id);"

aws rds-data execute-statement --resource-arn "$RESOURCE_ARN" --secret-arn "$SECRET_ARN" --database "$DATABASE" --sql "CREATE INDEX idx_leagues_status ON leagues(status);"

aws rds-data execute-statement --resource-arn "$RESOURCE_ARN" --secret-arn "$SECRET_ARN" --database "$DATABASE" --sql "CREATE INDEX idx_leagues_season ON leagues(season_year);"

aws rds-data execute-statement --resource-arn "$RESOURCE_ARN" --secret-arn "$SECRET_ARN" --database "$DATABASE" --sql "CREATE INDEX idx_teams_league ON teams(league_id);"

aws rds-data execute-statement --resource-arn "$RESOURCE_ARN" --secret-arn "$SECRET_ARN" --database "$DATABASE" --sql "CREATE INDEX idx_teams_owner ON teams(primary_owner_user_id);"

aws rds-data execute-statement --resource-arn "$RESOURCE_ARN" --secret-arn "$SECRET_ARN" --database "$DATABASE" --sql "CREATE INDEX idx_rosters_league ON rosters(league_id);"

aws rds-data execute-statement --resource-arn "$RESOURCE_ARN" --secret-arn "$SECRET_ARN" --database "$DATABASE" --sql "CREATE INDEX idx_rosters_team ON rosters(team_id);"

aws rds-data execute-statement --resource-arn "$RESOURCE_ARN" --secret-arn "$SECRET_ARN" --database "$DATABASE" --sql "CREATE INDEX idx_rosters_player ON rosters(player_id);"

aws rds-data execute-statement --resource-arn "$RESOURCE_ARN" --secret-arn "$SECRET_ARN" --database "$DATABASE" --sql "CREATE INDEX idx_rosters_status ON rosters(roster_status);"

aws rds-data execute-statement --resource-arn "$RESOURCE_ARN" --secret-arn "$SECRET_ARN" --database "$DATABASE" --sql "CREATE INDEX idx_memberships_league ON league_memberships(league_id);"

aws rds-data execute-statement --resource-arn "$RESOURCE_ARN" --secret-arn "$SECRET_ARN" --database "$DATABASE" --sql "CREATE INDEX idx_memberships_user ON league_memberships(user_id);"

aws rds-data execute-statement --resource-arn "$RESOURCE_ARN" --secret-arn "$SECRET_ARN" --database "$DATABASE" --sql "CREATE INDEX idx_memberships_status ON league_memberships(is_active);"

aws rds-data execute-statement --resource-arn "$RESOURCE_ARN" --secret-arn "$SECRET_ARN" --database "$DATABASE" --sql "CREATE INDEX idx_transactions_league ON transactions(league_id);"

aws rds-data execute-statement --resource-arn "$RESOURCE_ARN" --secret-arn "$SECRET_ARN" --database "$DATABASE" --sql "CREATE INDEX idx_transactions_date ON transactions(transaction_date);"

aws rds-data execute-statement --resource-arn "$RESOURCE_ARN" --secret-arn "$SECRET_ARN" --database "$DATABASE" --sql "CREATE INDEX idx_transactions_status ON transactions(status);"

aws rds-data execute-statement --resource-arn "$RESOURCE_ARN" --secret-arn "$SECRET_ARN" --database "$DATABASE" --sql "CREATE INDEX idx_draft_league ON draft_picks(league_id);"

aws rds-data execute-statement --resource-arn "$RESOURCE_ARN" --secret-arn "$SECRET_ARN" --database "$DATABASE" --sql "CREATE INDEX idx_draft_team ON draft_picks(team_id);"

aws rds-data execute-statement --resource-arn "$RESOURCE_ARN" --secret-arn "$SECRET_ARN" --database "$DATABASE" --sql "CREATE INDEX idx_draft_pick_order ON draft_picks(league_id, pick_number);"

aws rds-data execute-statement --resource-arn "$RESOURCE_ARN" --secret-arn "$SECRET_ARN" --database "$DATABASE" --sql "CREATE INDEX idx_messages_league ON league_messages(league_id);"

aws rds-data execute-statement --resource-arn "$RESOURCE_ARN" --secret-arn "$SECRET_ARN" --database "$DATABASE" --sql "CREATE INDEX idx_messages_sender ON league_messages(sender_user_id);"

aws rds-data execute-statement --resource-arn "$RESOURCE_ARN" --secret-arn "$SECRET_ARN" --database "$DATABASE" --sql "CREATE INDEX idx_messages_created ON league_messages(created_at);"

# Create views
echo "Creating views..."

aws rds-data execute-statement \
  --resource-arn "$RESOURCE_ARN" \
  --secret-arn "$SECRET_ARN" \
  --database "$DATABASE" \
  --sql "CREATE VIEW league_team_summary AS
SELECT 
    l.league_id,
    l.league_name,
    l.commissioner_user_id,
    l.status as league_status,
    l.season_year,
    COUNT(t.team_id) as team_count,
    COUNT(lm.membership_id) as member_count
FROM leagues l
LEFT JOIN teams t ON l.league_id = t.league_id AND t.is_active = true
LEFT JOIN league_memberships lm ON l.league_id = lm.league_id AND lm.is_active = true
GROUP BY l.league_id, l.league_name, l.commissioner_user_id, l.status, l.season_year;"

aws rds-data execute-statement \
  --resource-arn "$RESOURCE_ARN" \
  --secret-arn "$SECRET_ARN" \
  --database "$DATABASE" \
  --sql "CREATE VIEW user_league_summary AS
SELECT 
    lm.user_id,
    lm.league_id,
    l.league_name,
    l.status as league_status,
    lm.role,
    lm.team_id,
    t.team_name,
    lm.commissioner_privileges,
    lm.joined_at
FROM league_memberships lm
JOIN leagues l ON lm.league_id = l.league_id
LEFT JOIN teams t ON lm.team_id = t.team_id
WHERE lm.is_active = true
ORDER BY lm.joined_at DESC;"

echo "League management database setup complete!"
echo "Tables created: leagues, teams, rosters, league_memberships, league_scoring_categories, transactions, draft_picks, league_messages"
echo "Indexes and views created successfully."