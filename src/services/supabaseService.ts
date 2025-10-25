import { supabaseAdmin } from '@/lib/supabase';
import { 
  League, 
  Standing, 
  Match, 
  HypeFlag,
  FootballDataMatch,
  FootballDataStanding,
  COMPETITION_ID_TO_LEAGUE,
  HypePriority,
  HYPE_REASONS
} from '@/types';

class SupabaseService {
  // Leagues
  async getLeagues(): Promise<League[]> {
    const { data, error } = await supabaseAdmin
      .from('leagues')
      .select('*')
      .order('priority');

    if (error) throw error;
    return data || [];
  }

  // Standings
  async getStandings(leagueId: string, limit: number = 10): Promise<Standing[]> {
    const { data, error } = await supabaseAdmin
      .from('standings')
      .select('*')
      .eq('league_id', leagueId)
      .order('position')
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  async upsertStandings(standings: Standing[]): Promise<void> {
    // Clear existing standings for the leagues being updated
    const leagueIds = Array.from(new Set(standings.map(s => s.league_id)));
    
    for (const leagueId of leagueIds) {
      await supabaseAdmin
        .from('standings')
        .delete()
        .eq('league_id', leagueId);
    }

    // Insert new standings
    const { error } = await supabaseAdmin
      .from('standings')
      .insert(standings);

    if (error) throw error;
  }

  // Matches
  async getMatchesToday(): Promise<Match[]> {
    const today = new Date().toISOString().split('T')[0];
    
    const { data, error } = await supabaseAdmin
      .from('matches')
      .select('*')
      .eq('match_date', today)
      .order('kickoff_time');

    if (error) throw error;
    return data || [];
  }

  async upsertMatches(matches: Match[]): Promise<void> {
    // Clear existing matches for today
    const today = new Date().toISOString().split('T')[0];
    
    await supabaseAdmin
      .from('matches')
      .delete()
      .eq('match_date', today);

    if (matches.length > 0) {
      const { error } = await supabaseAdmin
        .from('matches')
        .insert(matches);

      if (error) throw error;
    }
  }

  // Hype Flags
  async getHypeFlags(): Promise<HypeFlag[]> {
    const { data, error } = await supabaseAdmin
      .from('hype_flags')
      .select('*')
      .order('priority')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async clearHypeFlags(): Promise<void> {
    const { error } = await supabaseAdmin
      .from('hype_flags')
      .delete()
      .neq('id', 0); // Delete all records

    if (error) throw error;
  }

  async insertHypeFlags(hypeFlags: Omit<HypeFlag, 'id' | 'created_at'>[]): Promise<void> {
    if (hypeFlags.length > 0) {
      const { error } = await supabaseAdmin
        .from('hype_flags')
        .insert(hypeFlags);

      if (error) throw error;
    }
  }

  // Data transformation helpers
  transformFootballDataMatch(match: FootballDataMatch): Omit<Match, 'id' | 'captured_at'> {
    const leagueId = COMPETITION_ID_TO_LEAGUE[match.competition.id];
    if (!leagueId) {
      throw new Error(`Unsupported competition: ${match.competition.id}`);
    }

    const matchDate = new Date(match.utcDate);
    const utcDate = matchDate.toISOString().split('T')[0];
    const utcTime = matchDate.toTimeString().split(' ')[0];

    return {
      league_id: leagueId,
      match_date: utcDate,
      kickoff_time: utcTime,
      home_team: match.homeTeam.name,
      away_team: match.awayTeam.name,
    };
  }

  transformFootballDataStanding(
    standing: FootballDataStanding, 
    leagueId: string
  ): Omit<Standing, 'id' | 'captured_at'> {
    return {
      league_id: leagueId,
      position: standing.position,
      team_name: standing.team.name,
      played: standing.playedGames,
      wins: standing.won,
      draws: standing.draw,
      losses: standing.lost,
      points: standing.points,
    };
  }

  // Hype generation logic
  async generateHypeFlags(): Promise<void> {
    await this.clearHypeFlags();
    
    const hypeFlags: Omit<HypeFlag, 'id' | 'created_at'>[] = [];
    const leagues = await this.getLeagues();
    const todayMatches = await this.getMatchesToday();

    for (const league of leagues) {
      const standings = await this.getStandings(league.id, 10);
      
      // Leader of the league (Priority 1)
      if (standings.length > 0) {
        const leader = standings[0];
        hypeFlags.push({
          league_id: league.id,
          team_name: leader.team_name,
          reason: HYPE_REASONS.LEADER,
          priority: HypePriority.LEADER,
        });
      }

      // Top 3 teams (Priority 2)
      const top3 = standings.slice(1, 3); // Exclude leader (already added)
      for (const team of top3) {
        hypeFlags.push({
          league_id: league.id,
          team_name: team.team_name,
          reason: HYPE_REASONS.TOP_3,
          priority: HypePriority.TOP_3,
        });
      }

      // Teams playing today (Priority 3)
      const leagueMatches = todayMatches.filter(m => m.league_id === league.id);
      for (const match of leagueMatches) {
        // Add home team
        if (!hypeFlags.some(h => h.team_name === match.home_team && h.league_id === league.id)) {
          hypeFlags.push({
            league_id: league.id,
            team_name: match.home_team,
            reason: HYPE_REASONS.PLAYING_TODAY,
            priority: HypePriority.PLAYING_TODAY,
          });
        }

        // Add away team
        if (!hypeFlags.some(h => h.team_name === match.away_team && h.league_id === league.id)) {
          hypeFlags.push({
            league_id: league.id,
            team_name: match.away_team,
            reason: HYPE_REASONS.PLAYING_TODAY,
            priority: HypePriority.PLAYING_TODAY,
          });
        }
      }
    }

    await this.insertHypeFlags(hypeFlags);
  }
}

export const supabaseService = new SupabaseService();
export default supabaseService;