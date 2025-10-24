import { createClient } from '@supabase/supabase-js';

// Configuração do Supabase diretamente no arquivo
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Lista fixa de ligas conforme especificado
const LEAGUES = [
  { id: "BSA", name: "Brasileirão Série A" },
  { id: "PL", name: "Premier League" },
  { id: "PD", name: "La Liga" },
  { id: "SA", name: "Serie A" },
  { id: "FL1", name: "Ligue 1" },
  { id: "CL", name: "Champions League" }
];

// Helper para aguardar entre chamadas (rate limit)
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Função para buscar classificação de uma liga
async function fetchStandings(leagueId: string): Promise<any> {
  const response = await fetch(`https://api.football-data.org/v4/competitions/${leagueId}/standings`, {
    headers: {
      'X-Auth-Token': process.env.FOOTBALL_API_TOKEN!,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Erro ao buscar standings para ${leagueId}: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Função para buscar jogos de uma liga em um período
async function fetchMatches(leagueId: string, dateFrom: string, dateTo: string): Promise<any> {
  const response = await fetch(`https://api.football-data.org/v4/competitions/${leagueId}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`, {
    headers: {
      'X-Auth-Token': process.env.FOOTBALL_API_TOKEN!,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Erro ao buscar matches para ${leagueId}: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Função para obter datas no timezone America/Sao_Paulo
function getDatesInBrazilTimezone(): { hoje: string; amanha: string } {
  const now = new Date();
  
  // Converter para timezone America/Sao_Paulo
  const brasilTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  
  const hoje = brasilTime.toISOString().split('T')[0]; // YYYY-MM-DD
  
  const amanha = new Date(brasilTime);
  amanha.setDate(amanha.getDate() + 1);
  const amanhaStr = amanha.toISOString().split('T')[0]; // YYYY-MM-DD
  
  return { hoje, amanha: amanhaStr };
}

// Função para salvar standings no banco
async function saveStandings(leagueId: string, standingsData: any): Promise<void> {
  if (!standingsData.standings || standingsData.standings.length === 0) {
    console.warn(`Nenhuma classificação encontrada para ${leagueId}`);
    return;
  }

  // Pegar a tabela principal (geral) - primeiro item do array standings
  const table = standingsData.standings[0]?.table;
  if (!table || table.length === 0) {
    console.warn(`Tabela de classificação vazia para ${leagueId}`);
    return;
  }

  // Inserir SOMENTE as 10 primeiras posições
  const top10 = table.slice(0, 10);
  
  const standingsToInsert = top10.map((standing: any) => ({
    league_id: leagueId,
    position: standing.position,
    team_name: standing.team.name,
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
}

// Função para salvar matches no banco
async function saveMatches(leagueId: string, matchesData: any, hoje: string): Promise<void> {
  if (!matchesData.matches || matchesData.matches.length === 0) {
    console.log(`Nenhum jogo encontrado para ${leagueId} hoje`);
    return;
  }

  const matchesToInsert = matchesData.matches
    .filter((match: any) => {
      // Filtrar apenas jogos de hoje
      const matchDate = new Date(match.utcDate).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
      return matchDate === hoje;
    })
    .map((match: any) => {
      // Converter UTC para horário local do Brasil
      const utcDate = new Date(match.utcDate);
      const brasilDate = new Date(utcDate.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      
      return {
        league_id: leagueId,
        match_date: hoje,
        kickoff_time: brasilDate.toTimeString().slice(0, 5), // HH:MM
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
}

// Função para gerar hype_flags
async function generateHypeFlags(hoje: string): Promise<void> {
  // Primeiro, apagar hype_flags antigos do dia atual
  const { error: deleteError } = await supabaseAdmin
    .from('hype_flags')
    .delete()
    .gte('created_at', `${hoje}T00:00:00`)
    .lt('created_at', `${hoje}T23:59:59`);

  if (deleteError) {
    throw new Error(`Erro ao apagar hype_flags antigos: ${deleteError.message}`);
  }

  const hypeFlags: any[] = [];
  const teamHypeMap = new Map<string, { reason: string; priority: number; league_id: string }>();

  for (const league of LEAGUES) {
    try {
      // Buscar classificação atual para regras de hype
      const { data: standings } = await supabaseAdmin
        .from('standings')
        .select('*')
        .eq('league_id', league.id)
        .order('captured_at', { ascending: false })
        .order('position', { ascending: true })
        .limit(10);

      // Buscar jogos de hoje para regras de hype
      const { data: matches } = await supabaseAdmin
        .from('matches')
        .select('*')
        .eq('league_id', league.id)
        .eq('match_date', hoje);

      if (standings && standings.length > 0) {
        // Regra C: time está em 1º lugar → "Líder da liga", priority 1
        const leader = standings.find(s => s.position === 1);
        if (leader) {
          const key = `${league.id}-${leader.team_name}`;
          teamHypeMap.set(key, {
            reason: "Líder da liga",
            priority: 1,
            league_id: league.id
          });
        }

        // Regra B: time está no top 3 da liga → "Top 3 da liga", priority 2
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
        // Regra A: time joga hoje → "Joga hoje", priority 2
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

          // Regra D: clássico hoje → ambos times no top 5 → "Clássico hoje", priority 1
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

  // Converter Map para array de hype_flags
  teamHypeMap.forEach((hype, key) => {
    const teamName = key.split('-').slice(1).join('-'); // Remove league_id do início
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
      throw new Error(`Erro ao inserir hype_flags: ${error.message}`);
    }
  }
}

// Função principal do job diário
async function runDailySync(): Promise<void> {
  console.log('🚀 Iniciando sincronização diária...');
  
  const { hoje, amanha } = getDatesInBrazilTimezone();
  console.log(`📅 Processando dados para: ${hoje} (hoje) até ${amanha} (amanhã)`);

  const results: Record<string, { standings: boolean; matches: boolean; hype: boolean }> = {};

  for (const league of LEAGUES) {
    console.log(`\n🔄 Processando liga: ${league.name} (${league.id})`);
    
    const result = { standings: false, matches: false, hype: false };
    
    try {
      // 1. Buscar e salvar standings
      try {
        console.log(`  📊 Buscando classificação...`);
        const standingsData = await fetchStandings(league.id);
        await saveStandings(league.id, standingsData);
        result.standings = true;
        console.log(`  ✅ Classificação salva`);
      } catch (error) {
        console.error(`  ❌ Erro na classificação:`, error);
      }

      // Aguardar 3 segundos entre chamadas (rate limit)
      await delay(3000);

      // 2. Buscar e salvar matches
      try {
        console.log(`  ⚽ Buscando jogos...`);
        const matchesData = await fetchMatches(league.id, hoje, amanha);
        await saveMatches(league.id, matchesData, hoje);
        result.matches = true;
        console.log(`  ✅ Jogos salvos`);
      } catch (error) {
        console.error(`  ❌ Erro nos jogos:`, error);
      }

      // Aguardar 3 segundos entre chamadas (rate limit)
      await delay(3000);

      results[league.id] = result;

    } catch (error) {
      console.error(`❌ Erro geral para ${league.id}:`, error);
      results[league.id] = result;
    }
  }

  // 3. Gerar hype_flags (uma vez para todas as ligas)
  try {
    console.log(`\n🔥 Gerando hype flags...`);
    await generateHypeFlags(hoje);
    
    // Marcar hype como ok para todas as ligas processadas
    for (const leagueId of Object.keys(results)) {
      results[leagueId].hype = true;
    }
    console.log(`✅ Hype flags gerados`);
  } catch (error) {
    console.error(`❌ Erro ao gerar hype flags:`, error);
  }

  // 4. Resumo final
  console.log('\n📋 RESUMO DA SINCRONIZAÇÃO:');
  for (const [leagueId, result] of Object.entries(results)) {
    const standingsStatus = result.standings ? 'ok' : 'erro';
    const matchesStatus = result.matches ? 'ok' : 'erro';
    const hypeStatus = result.hype ? 'ok' : 'erro';
    
    console.log(`[${leagueId}] standings ${standingsStatus} / matches ${matchesStatus} / hype ${hypeStatus}`);
  }

  console.log('\n🎉 Sincronização diária concluída!');
}

// Executar se chamado diretamente
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Verificar se o arquivo está sendo executado diretamente
const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  runDailySync()
    .then(() => {
      console.log('✅ Sincronização manual concluída com sucesso');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Erro na sincronização manual:', error);
      process.exit(1);
    });
}

export default runDailySync;