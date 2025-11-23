import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { memoryCache, createCacheKey, withCache } from '@/lib/cache';

export async function GET(
  request: Request,
  { params }: { params: { league_id: string } }
) {
  const startTime = Date.now();
  
  try {
    const { league_id } = params;
    const cacheKey = createCacheKey('standings', league_id);

    // Usar cache com TTL de 10 minutos (standings mudam menos frequentemente)
    const result = await withCache(cacheKey, async () => {
      // Buscar a liga para pegar o nome (opcional, não falhar se não encontrar)
      const { data: leagueData } = await supabaseAdmin
        .from('leagues')
        .select('*')
        .eq('id', league_id)
        .single();

      // Buscar standings mais recentes para esta liga
      const { data: standingsData, error: standingsError } = await supabaseAdmin
        .from('standings')
        .select('*')
        .eq('league_id', league_id)
        .order('captured_at', { ascending: false })
        .order('position', { ascending: true });

      if (standingsError) throw standingsError;

      if (!standingsData || standingsData.length === 0) {
        return {
          league_id,
          league_name: leagueData?.name || league_id,
          table: [],
          captured_at: null
        };
      }

      // Pegar apenas os standings mais recentes (mesmo captured_at)
      const latestCapturedAt = standingsData[0].captured_at;
      const latestStandings = standingsData.filter(
        (standing: any) => standing.captured_at === latestCapturedAt
      );

      // Formatar dados para o frontend
      const table = latestStandings.map((standing: any) => ({
        pos: standing.position,
        team: standing.team_name,
        crest: standing.team_crest, // Adicionar URL do escudo
        pts: standing.points,
        played: standing.played,
        wins: standing.wins,
        draws: standing.draws,
        losses: standing.losses
      }));

      return {
        league_id,
        league_name: leagueData?.name || league_id,
        table,
        captured_at: latestCapturedAt
      };
    }, 10); // Cache por 10 minutos

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
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=900'
      }
    });
  } catch (error) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    console.error('Error fetching standings:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch standings',
        _meta: {
          responseTime: `${responseTime}ms`,
          timestamp: new Date().toISOString()
        }
      },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
