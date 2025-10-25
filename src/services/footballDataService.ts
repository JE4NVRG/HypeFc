import { 
  FootballDataMatch, 
  FootballDataStandingsResponse, 
  LEAGUE_MAPPING,
  COMPETITION_ID_TO_LEAGUE 
} from '@/types';

const FOOTBALL_API_BASE_URL = process.env.FOOTBALL_API_BASE_URL || 'https://api.football-data.org/v4';
const FOOTBALL_API_TOKEN = process.env.FOOTBALL_API_TOKEN;

class FootballDataService {
  private async makeRequest(endpoint: string): Promise<any> {
    if (!FOOTBALL_API_TOKEN) {
      throw new Error('Football API token not configured');
    }

    const response = await fetch(`${FOOTBALL_API_BASE_URL}${endpoint}`, {
      headers: {
        'X-Auth-Token': FOOTBALL_API_TOKEN,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Football API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getMatchesToday(): Promise<FootballDataMatch[]> {
    const today = new Date().toISOString().split('T')[0];
    const competitions = Object.values(LEAGUE_MAPPING).join(',');
    
    const data = await this.makeRequest(
      `/matches?dateFrom=${today}&dateTo=${today}&competitions=${competitions}`
    );
    
    return data.matches || [];
  }

  async getStandings(leagueId: string): Promise<FootballDataStandingsResponse> {
    const competitionId = LEAGUE_MAPPING[leagueId];
    
    if (!competitionId) {
      throw new Error(`League ${leagueId} not supported`);
    }

    return this.makeRequest(`/competitions/${competitionId}/standings`);
  }

  async getMatches(leagueId: string): Promise<any> {
    const competitionId = LEAGUE_MAPPING[leagueId];
    
    if (!competitionId) {
      throw new Error(`League ${leagueId} not supported`);
    }

    const today = new Date().toISOString().split('T')[0];
    return this.makeRequest(`/competitions/${competitionId}/matches?dateFrom=${today}&dateTo=${today}`);
  }

  async getAllStandings(): Promise<Record<string, FootballDataStandingsResponse>> {
    const results: Record<string, FootballDataStandingsResponse> = {};
    
    for (const [leagueId, competitionId] of Object.entries(LEAGUE_MAPPING)) {
      try {
        results[leagueId] = await this.makeRequest(`/competitions/${competitionId}/standings`);
        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Error fetching standings for ${leagueId}:`, error);
      }
    }
    
    return results;
  }

  // Helper method to convert competition ID back to league ID
  getLeagueIdFromCompetition(competitionId: number): string | undefined {
    return COMPETITION_ID_TO_LEAGUE[competitionId];
  }
}

export const footballDataService = new FootballDataService();
export default footballDataService;