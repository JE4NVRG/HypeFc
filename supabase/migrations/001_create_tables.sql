-- Create leagues table
CREATE TABLE leagues (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    country TEXT NOT NULL,
    priority INTEGER DEFAULT 1
);

-- Insert initial data for leagues
INSERT INTO leagues (id, name, country, priority) VALUES
('BSA', 'Brasileirão Série A', 'Brazil', 1),
('PL', 'Premier League', 'England', 2),
('PD', 'La Liga', 'Spain', 3),
('SA', 'Serie A', 'Italy', 4),
('FL1', 'Ligue 1', 'France', 5),
('CL', 'Champions League', 'Europe', 6);

-- Create standings table
CREATE TABLE standings (
    id BIGSERIAL PRIMARY KEY,
    league_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    team_name TEXT NOT NULL,
    played INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    draws INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    points INTEGER DEFAULT 0,
    captured_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for standings
CREATE INDEX idx_standings_league_id ON standings(league_id);
CREATE INDEX idx_standings_position ON standings(position);
CREATE INDEX idx_standings_captured_at ON standings(captured_at DESC);

-- Create matches table
CREATE TABLE matches (
    id BIGSERIAL PRIMARY KEY,
    league_id TEXT NOT NULL,
    match_date DATE NOT NULL,
    kickoff_time TIME,
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    captured_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for matches
CREATE INDEX idx_matches_league_id ON matches(league_id);
CREATE INDEX idx_matches_date ON matches(match_date);
CREATE INDEX idx_matches_captured_at ON matches(captured_at DESC);

-- Create hype_flags table
CREATE TABLE hype_flags (
    id BIGSERIAL PRIMARY KEY,
    league_id TEXT NOT NULL,
    team_name TEXT NOT NULL,
    reason TEXT NOT NULL,
    priority INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for hype_flags
CREATE INDEX idx_hype_flags_league_id ON hype_flags(league_id);
CREATE INDEX idx_hype_flags_priority ON hype_flags(priority);
CREATE INDEX idx_hype_flags_created_at ON hype_flags(created_at DESC);

-- Set permissions for anon users (read-only)
GRANT SELECT ON leagues TO anon;
GRANT SELECT ON standings TO anon;
GRANT SELECT ON matches TO anon;
GRANT SELECT ON hype_flags TO anon;

-- Set permissions for authenticated users (full access)
GRANT ALL PRIVILEGES ON leagues TO authenticated;
GRANT ALL PRIVILEGES ON standings TO authenticated;
GRANT ALL PRIVILEGES ON matches TO authenticated;
GRANT ALL PRIVILEGES ON hype_flags TO authenticated;