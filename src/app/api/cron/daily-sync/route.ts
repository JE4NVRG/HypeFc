import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { footballDataService } from '@/services/footballDataService';
import { supabaseService } from '@/services/supabaseService';

// Configuração completa das ligas
const LEAGUES = [
  // Ligas Europeias Principais
  { id: 'PL', name: 'Premier League' },
  { id: 'PD', name: 'La Liga' },
  { id: 'SA', name: 'Serie A' },
  { id: 'FL1', name: 'Ligue 1' },
  { id: 'BL1', name: 'Bundesliga' },
  { id: 'DED', name: 'Eredivisie' },
  { id: 'PPL', name: 'Primeira Liga' },
  { id: 'ELC', name: 'Championship' },
  
  // Competições Internacionais
  { id: 'CL', name: 'Champions League' },
  { id: 'EC', name: 'European Championship' },
  { id: 'WC', name: 'FIFA World Cup' },
  
  // Liga Sul-Americana
  { id: 'BSA', name: 'Brasileirão' }
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

  const now = new Date().toISOString();
  const standings = table.map((s: any) => ({
    ...supabaseService.transformFootballDataStanding(s, leagueId),
    captured_at: now,
  }));

  const { error } = await supabaseAdmin
    .from('standings')
    .upsert(standings as any, { onConflict: 'league_id,captured_at,team_name' });

  if (error) {
    throw new Error(`Erro ao salvar standings para ${leagueId}: ${error.message}`);
  }

  console.log(`✅ Standings salvos para ${leagueId}: ${standings.length} times`);
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
    .upsert(matchesToInsert, { onConflict: 'league_id,match_date,home_team,away_team' });

  if (error) {
    throw new Error(`Erro ao salvar matches para ${leagueId}: ${error.message}`);
  }

  console.log(`✅ Matches salvos para ${leagueId}: ${matchesToInsert.length} jogos`);
}

// Função para gerar hype_flags
async function generateHypeFlags(): Promise<void> {
  await supabaseService.generateHypeFlags();
}

export async function GET(request: Request) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const headerAuth = request.headers.get('authorization') || '';
    const bearer = headerAuth.startsWith('Bearer ') ? headerAuth.replace('Bearer ', '').trim() : null;
    const queryToken = searchParams.get('token');
    const expected = process.env.CRON_SECRET_TOKEN;
    if (expected && bearer !== expected && queryToken !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
        
        // Usar Football-Data.org para todas as ligas, incluindo o Brasileirão
        const standingsData = await footballDataService.getStandings(league.id);
        await saveStandings(league.id, standingsData);
        
        const matchesData = await footballDataService.getMatches(league.id);
        await saveMatches(league.id, matchesData, hoje);
        
        results.push({
          league_id: league.id,
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
          league_id: league.id,
          league: league.name,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // 3. Gerar hype flags
    await generateHypeFlags();

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
