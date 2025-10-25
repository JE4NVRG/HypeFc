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
// Mapeamento completo de todas as ligas disponíveis na API Football-Data.org
export const LEAGUE_MAPPING: Record<string, number> = {
  // Ligas Europeias Principais
  'PL': 2021,    // Premier League (Inglaterra)
  'PD': 2014,    // La Liga (Espanha)
  'SA': 2019,    // Serie A (Itália)
  'FL1': 2015,   // Ligue 1 (França)
  'BL1': 2002,   // Bundesliga (Alemanha)
  'DED': 2003,   // Eredivisie (Holanda)
  'PPL': 2017,   // Primeira Liga (Portugal)
  'ELC': 2016,   // Championship (Inglaterra)
  
  // Competições Internacionais
  'CL': 2001,    // UEFA Champions League
  'EC': 2018,    // European Championship (Eurocopa)
  'WC': 2000,    // FIFA World Cup
  
  // Liga Sul-Americana
  'BSA': 2013,   // Brasileirão Série A
};

// Mapeamento reverso: ID da competição para código da liga
export const COMPETITION_ID_TO_LEAGUE: Record<number, string> = {
  // Ligas Europeias Principais
  2021: 'PL',    // Premier League
  2014: 'PD',    // La Liga
  2019: 'SA',    // Serie A
  2015: 'FL1',   // Ligue 1
  2002: 'BL1',   // Bundesliga
  2003: 'DED',   // Eredivisie
  2017: 'PPL',   // Primeira Liga
  2016: 'ELC',   // Championship
  
  // Competições Internacionais
  2001: 'CL',    // Champions League
  2018: 'EC',    // European Championship
  2000: 'WC',    // FIFA World Cup
  
  // Liga Sul-Americana
  2013: 'BSA',   // Brasileirão
};

// Nomes completos das ligas para exibição
export const LEAGUE_NAMES: Record<string, string> = {
  'PL': 'Premier League',
  'PD': 'La Liga',
  'SA': 'Serie A',
  'FL1': 'Ligue 1',
  'BL1': 'Bundesliga',
  'DED': 'Eredivisie',
  'PPL': 'Primeira Liga',
  'ELC': 'Championship',
  'CL': 'Champions League',
  'EC': 'European Championship',
  'WC': 'FIFA World Cup',
  'BSA': 'Brasileirão Série A',
};

// Países das ligas
export const LEAGUE_COUNTRIES: Record<string, string> = {
  'PL': 'Inglaterra',
  'PD': 'Espanha',
  'SA': 'Itália',
  'FL1': 'França',
  'BL1': 'Alemanha',
  'DED': 'Holanda',
  'PPL': 'Portugal',
  'ELC': 'Inglaterra',
  'CL': 'Europa',
  'EC': 'Europa',
  'WC': 'Mundial',
  'BSA': 'Brasil',
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