import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { footballDataService } from '@/services/footballDataService';

// Configuração das ligas
const LEAGUES = [
  { id: 'BSA', name: 'Brasileirão' },
  { id: 'PL', name: 'Premier League' },
  { id: 'PD', name: 'La Liga' },
  { id: 'SA', name: 'Serie A' },
  { id: 'FL1', name: 'Ligue 1' },
  { id: 'CL', name: 'Champions League' }
];

// Função para limpar dados antigos
async function cleanOldData(hoje: string): Promise<void> {
  console.log('🧹 Limpando dados antigos...');
  
  // Limpar standings antigos (manter apenas os mais recentes)
  const { error: standingsError } = await supabaseAdmin
    .from('standings')
    .delete()
    .lt('captured_at', `${hoje}T00:00:00`);

  if (standingsError) {
    console.error('Erro ao limpar standings antigos:', standingsError);
  }

  // Limpar matches antigos (manter apenas de hoje)
  const { error: matchesError } = await supabaseAdmin
    .from('matches')
    .delete()
    .neq('match_date', hoje);

  if (matchesError) {
    console.error('Erro ao limpar matches antigos:', matchesError);
  }

  // Limpar hype_flags antigos (manter apenas de hoje)
  const { error: hypeError } = await supabaseAdmin
    .from('hype_flags')
    .delete()
    .lt('created_at', `${hoje}T00:00:00`);

  if (hypeError) {
    console.error('Erro ao limpar hype_flags antigos:', hypeError);
  }

  console.log('✅ Limpeza de dados antigos concluída');
}

// Função para salvar standings no banco
async function saveStandings(leagueId: string, standingsData: any): Promise<void> {
  if (!standingsData.standings || standingsData.standings.length === 0) {
    console.warn(`Nenhuma classificação encontrada para ${leagueId}`);
    return;
  }

  const table = standingsData.standings[0]?.table;
  if (!table || table.length === 0) {
    console.warn(`Tabela de classificação vazia para ${leagueId}`);
    return;
  }

  const standingsToInsert = table.map((standing: any) => ({
    league_id: leagueId,
    position: standing.position,
    team_name: standing.team.name,
    team_crest: standing.team.crest,
    played: standing.playedGames,
    wins: standing.won,
    draws: standing.draw,
    losses: standing.lost,
    points: standing.points,
    captured_at: new Date().toISOString()
  }));

  const { error } = await supabaseAdmin
    .from('standings')
    .insert(standingsToInsert);

  if (error) {
    throw new Error(`Erro ao salvar standings para ${leagueId}: ${error.message}`);
  }

  console.log(`✅ Standings salvos para ${leagueId}: ${standingsToInsert.length} times`);
}

// Função para salvar matches no banco
async function saveMatches(leagueId: string, matchesData: any, hoje: string): Promise<void> {
  if (!matchesData.matches || matchesData.matches.length === 0) {
    console.log(`Nenhum jogo encontrado para ${leagueId} hoje`);
    return;
  }

  const matchesToInsert = matchesData.matches
    .filter((match: any) => {
      const matchDate = new Date(match.utcDate).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
      return matchDate === hoje;
    })
    .map((match: any) => {
      const utcDate = new Date(match.utcDate);
      const brasilDate = new Date(utcDate.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      
      return {
        league_id: leagueId,
        match_date: hoje,
        kickoff_time: brasilDate.toTimeString().slice(0, 5),
        home_team: match.homeTeam.name,
        away_team: match.awayTeam.name,
        captured_at: new Date().toISOString()
      };
    });

  if (matchesToInsert.length === 0) {
    console.log(`Nenhum jogo válido para inserir para ${leagueId} hoje`);
    return;
  }

  const { error } = await supabaseAdmin
    .from('matches')
    .insert(matchesToInsert);

  if (error) {
    throw new Error(`Erro ao salvar matches para ${leagueId}: ${error.message}`);
  }

  console.log(`✅ Matches salvos para ${leagueId}: ${matchesToInsert.length} jogos`);
}

// Função para gerar hype_flags
async function generateHypeFlags(hoje: string): Promise<void> {
  console.log('🔥 Gerando hype flags...');
  
  const hypeFlags: any[] = [];
  const teamHypeMap = new Map<string, { reason: string; priority: number; league_id: string }>();

  for (const league of LEAGUES) {
    try {
      const { data: standings } = await supabaseAdmin
        .from('standings')
        .select('*')
        .eq('league_id', league.id)
        .order('captured_at', { ascending: false })
        .order('position', { ascending: true })
        .limit(10);

      const { data: matches } = await supabaseAdmin
        .from('matches')
        .select('*')
        .eq('league_id', league.id)
        .eq('match_date', hoje);

      if (standings && standings.length > 0) {
        // Líder da liga
        const leader = standings.find(s => s.position === 1);
        if (leader) {
          const key = `${league.id}-${leader.team_name}`;
          teamHypeMap.set(key, {
            reason: "Líder da liga",
            priority: 1,
            league_id: league.id
          });
        }

        // Top 3 da liga
        const top3 = standings.filter(s => s.position <= 3);
        for (const team of top3) {
          const key = `${league.id}-${team.team_name}`;
          if (!teamHypeMap.has(key) || teamHypeMap.get(key)!.priority > 2) {
            teamHypeMap.set(key, {
              reason: "Top 3 da liga",
              priority: 2,
              league_id: league.id
            });
          }
        }
      }

      if (matches && matches.length > 0) {
        // Times que jogam hoje
        for (const match of matches) {
          const homeKey = `${league.id}-${match.home_team}`;
          const awayKey = `${league.id}-${match.away_team}`;

          if (!teamHypeMap.has(homeKey) || teamHypeMap.get(homeKey)!.priority > 2) {
            teamHypeMap.set(homeKey, {
              reason: "Joga hoje",
              priority: 2,
              league_id: league.id
            });
          }

          if (!teamHypeMap.has(awayKey) || teamHypeMap.get(awayKey)!.priority > 2) {
            teamHypeMap.set(awayKey, {
              reason: "Joga hoje",
              priority: 2,
              league_id: league.id
            });
          }

          // Clássico hoje (ambos no top 5)
          if (standings) {
            const top5 = standings.filter(s => s.position <= 5);
            const homeInTop5 = top5.find(s => s.team_name === match.home_team);
            const awayInTop5 = top5.find(s => s.team_name === match.away_team);

            if (homeInTop5 && awayInTop5) {
              teamHypeMap.set(homeKey, {
                reason: "Clássico hoje",
                priority: 1,
                league_id: league.id
              });
              teamHypeMap.set(awayKey, {
                reason: "Clássico hoje",
                priority: 1,
                league_id: league.id
              });
            }
          }
        }
      }
    } catch (error) {
      console.error(`Erro ao processar hype flags para ${league.id}:`, error);
    }
  }

  // Converter Map para array
  teamHypeMap.forEach((hype, key) => {
    const teamName = key.split('-').slice(1).join('-');
    hypeFlags.push({
      league_id: hype.league_id,
      team_name: teamName,
      reason: hype.reason,
      priority: hype.priority,
      created_at: new Date().toISOString()
    });
  });

  if (hypeFlags.length > 0) {
    const { error } = await supabaseAdmin
      .from('hype_flags')
      .insert(hypeFlags);

    if (error) {
      throw new Error(`Erro ao salvar hype flags: ${error.message}`);
    }

    console.log(`✅ Hype flags gerados: ${hypeFlags.length} flags`);
  }
}

export async function GET(request: Request) {
  const startTime = Date.now();
  
  try {
    // Verificar autorização (opcional - para segurança)
    const { searchParams } = new URL(request.url);
    const authToken = searchParams.get('token');
    
    // Se você quiser adicionar um token de segurança
    // if (authToken !== process.env.CRON_SECRET_TOKEN) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    console.log('🚀 Iniciando sincronização diária...');
    
    const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    console.log(`📅 Data de hoje: ${hoje}`);

    // 1. Limpar dados antigos
    await cleanOldData(hoje);

    // 2. Sincronizar dados para cada liga
    const results = [];
    
    for (const league of LEAGUES) {
      try {
        console.log(`🏆 Processando ${league.name} (${league.id})...`);
        
        // Buscar standings
        const standingsData = await footballDataService.getStandings(league.id);
        await saveStandings(league.id, standingsData);
        
        // Buscar matches de hoje
        const matchesData = await footballDataService.getMatches(league.id);
        await saveMatches(league.id, matchesData, hoje);
        
        results.push({
          league: league.name,
          status: 'success',
          standings: standingsData.standings?.[0]?.table?.length || 0,
          matches: matchesData.matches?.filter((m: any) => {
            const matchDate = new Date(m.utcDate).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
            return matchDate === hoje;
          }).length || 0
        });
        
      } catch (error) {
        console.error(`❌ Erro ao processar ${league.name}:`, error);
        results.push({
          league: league.name,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // 3. Gerar hype flags
    await generateHypeFlags(hoje);

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`✅ Sincronização concluída em ${duration}ms`);

    return NextResponse.json({
      success: true,
      date: hoje,
      duration: `${duration}ms`,
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.error('❌ Erro na sincronização:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  // Permitir também POST para compatibilidade com diferentes cron services
  return GET(request);
}