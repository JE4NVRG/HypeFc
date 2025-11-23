-- Unique constraints to enable upserts and prevent duplicates

-- Matches: one record per league/date/home/away
ALTER TABLE matches
ADD CONSTRAINT matches_unique_league_date_teams
UNIQUE (league_id, match_date, home_team, away_team);

-- Standings: one record per league/captured_at/team
ALTER TABLE standings
ADD CONSTRAINT standings_unique_league_capture_team
UNIQUE (league_id, captured_at, team_name);
