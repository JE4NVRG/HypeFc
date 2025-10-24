// Database entities
export interface League {
  id: string;
  name: string;
  country: string;
  priority: number;
}

export interface Standing {
  id: number;
  league_id: string;
  position: number;
  team_name: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  captured_at: string;
}

export interface Match {
  id: number;
  league_id: string;
  match_date: string;
  kickoff_time: string | null;
  home_team: string;
  away_team: string;
  captured_at: string;
}

export interface HypeFlag {
  id: number;
  league_id: string;
  team_name: string;
  reason: string;
  priority: number;
  created_at: string;
}

// API Response types
export interface DashboardTodayResponse {
  matches: Match[];
  hypeFlags: HypeFlag[];
}

export interface StandingsResponse {
  standings: Standing[];
}

// Football Data API types
export interface FootballDataMatch {
  id: number;
  competition: {
    id: number;
    name: string;
    code: string;
  };
  utcDate: string;
  status: string;
  homeTeam: {
    id: number;
    name: string;
    crest?: string;
  };
  awayTeam: {
    id: number;
    name: string;
    crest?: string;
  };
  score: {
    fullTime: {
      home: number | null;
      away: number | null;
    };
  };
}

export interface FootballDataStanding {
  position: number;
  team: {
    id: number;
    name: string;
    crest?: string;
  };
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

export interface FootballDataStandingsResponse {
  standings: Array<{
    table: FootballDataStanding[];
  }>;
}

// League mapping for Football Data API
export const LEAGUE_MAPPING: Record<string, number> = {
  'PL': 2021,    // Premier League
  'PD': 2014,    // La Liga
  'SA': 2019,    // Serie A
  'FL1': 2015,   // Ligue 1
  'BSA': 2013,   // Brasileirão
  'CL': 2001,    // Champions League
};

// Reverse mapping for API responses
export const COMPETITION_ID_TO_LEAGUE: Record<number, string> = {
  2021: 'PL',
  2014: 'PD',
  2019: 'SA',
  2015: 'FL1',
  2013: 'BSA',
  2001: 'CL',
};

// Hype generation priorities
export enum HypePriority {
  LEADER = 1,
  TOP_3 = 2,
  PLAYING_TODAY = 3,
  CLASSIC_MATCH = 4,
}

// Hype reasons
export const HYPE_REASONS = {
  LEADER: 'Líder da liga',
  TOP_3: 'Top 3 da liga',
  PLAYING_TODAY: 'Joga hoje',
  CLASSIC_MATCH: 'Clássico',
} as const;