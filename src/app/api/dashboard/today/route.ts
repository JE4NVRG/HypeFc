import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { memoryCache, createCacheKey, withCache } from '@/lib/cache';

export async function GET() {
  const startTime = Date.now();
  
  try {
    // Pegar hoje (YYYY-MM-DD no fuso America/Sao_Paulo)
    const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const cacheKey = createCacheKey('dashboard', 'today', hoje);

    // Usar cache com TTL de 5 minutos
    const result = await withCache(cacheKey, async () => {
      // Buscar matches de hoje
      const { data: matchesData, error: matchesError } = await supabaseAdmin
        .from('matches')
        .select('*')
        .eq('match_date', hoje)
        .order('kickoff_time', { ascending: true });

      if (matchesError) throw matchesError;

      // Buscar todas as leagues para fazer o mapeamento
      const { data: leaguesData, error: leaguesError } = await supabaseAdmin
        .from('leagues')
        .select('*');

      if (leaguesError) throw leaguesError;

      // Criar um mapa de league_id -> league_name
      const leagueMap = leaguesData?.reduce((acc: any, league: any) => {
        acc[league.id] = league.name;
        return acc;
      }, {}) || {};

      // Formatar matches com league_name
      const matches = matchesData?.map((match: any) => ({
        league_id: match.league_id,
        league_name: leagueMap[match.league_id] || match.league_id,
        home: match.home_team,
        away: match.away_team,
        time_local: match.kickoff_time || '00:00'
      })) || [];

      // Ordenar matches por league_name e depois por time_local
      matches.sort((a, b) => {
        if (a.league_name !== b.league_name) {
          return a.league_name.localeCompare(b.league_name);
        }
        return a.time_local.localeCompare(b.time_local);
      });

      // Buscar hype_flags de hoje, ordenar por priority ASC depois por team_name ASC
      const { data: hypeData, error: hypeError } = await supabaseAdmin
        .from('hype_flags')
        .select('*')
        .gte('created_at', `${hoje}T00:00:00`)
        .lt('created_at', `${hoje}T23:59:59`)
        .order('priority', { ascending: true })
        .order('team_name', { ascending: true });

      if (hypeError) throw hypeError;

      // Formatar hype flags
      const hype = hypeData?.map((flag: any) => ({
        team: flag.team_name,
        reason: flag.reason,
        priority: flag.priority
      })) || [];

      return {
        date: hoje,
        matches,
        hype
      };
    }, 5); // Cache por 5 minutos

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    // Adicionar métricas de performance
    const response = {
      ...result,
      _meta: {
        responseTime: `${responseTime}ms`,
        cached: memoryCache.get(cacheKey) !== null,
        timestamp: new Date().toISOString()
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    console.error('Error fetching dashboard today data:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch dashboard data',
        _meta: {
          responseTime: `${responseTime}ms`,
          timestamp: new Date().toISOString()
        }
      },
      { status: 500 }
    );
  }
}