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

      // Buscar standings para obter team_crest e posições
      const { data: standingsData, error: standingsError } = await supabaseAdmin
        .from('standings')
        .select('team_name, team_crest, position, league_id');

      if (standingsError) throw standingsError;

      // Criar mapa de team_name -> {crest, position, league_id}
      const teamDataMap = standingsData?.reduce((acc: any, standing: any) => {
        const key = `${standing.league_id}-${standing.team_name}`;
        acc[key] = {
          crest: standing.team_crest,
          position: standing.position,
          league_id: standing.league_id
        };
        return acc;
      }, {}) || {};

      // Formatar matches com league_name, team crests e posições, removendo duplicatas
      const uniqueMatchesMap = new Map();
      
      matchesData?.forEach((match: any) => {
        const homeKey = `${match.league_id}-${match.home_team}`;
        const awayKey = `${match.league_id}-${match.away_team}`;
        
        // Criar chave única para o jogo
        const matchKey = `${match.league_id}-${match.home_team}-${match.away_team}-${match.kickoff_time}`;
        
        // Só adicionar se não existir
        if (!uniqueMatchesMap.has(matchKey)) {
          uniqueMatchesMap.set(matchKey, {
            league_id: match.league_id,
            league_name: leagueMap[match.league_id] || match.league_id,
            home: match.home_team,
            home_crest: teamDataMap[homeKey]?.crest || null,
            home_position: teamDataMap[homeKey]?.position || null,
            away: match.away_team,
            away_crest: teamDataMap[awayKey]?.crest || null,
            away_position: teamDataMap[awayKey]?.position || null,
            time_local: (match.kickoff_time || '00:00').substring(0, 5) // Remover segundos
          });
        }
      });
      
      const matches = Array.from(uniqueMatchesMap.values());

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

      // Formatar hype flags com team_crest e position, removendo duplicatas
      const uniqueHypeMap = new Map();
      
      hypeData?.forEach((flag: any) => {
        const teamKey = `${flag.league_id}-${flag.team_name}`;
        const teamData = teamDataMap[teamKey];
        
        // Se já existe um time com prioridade menor (número menor = prioridade maior), manter o existente
        if (uniqueHypeMap.has(flag.team_name)) {
          const existing = uniqueHypeMap.get(flag.team_name);
          if (existing.priority <= flag.priority) {
            return; // Manter o existente
          }
        }
        
        uniqueHypeMap.set(flag.team_name, {
          team: flag.team_name,
          reason: flag.reason,
          priority: flag.priority,
          crest: teamData?.crest || null,
          position: teamData?.position || null,
          league_id: flag.league_id
        });
      });
      
      const hype = Array.from(uniqueHypeMap.values()).sort((a, b) => {
        if (a.priority !== b.priority) {
          return a.priority - b.priority; // Prioridade menor primeiro
        }
        return a.team.localeCompare(b.team); // Alfabético por nome do time
      });

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

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300'
      }
    });
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
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
