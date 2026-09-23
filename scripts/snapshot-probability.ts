#!/usr/bin/env node
/**
 * Snapshot de probabilidade — a previsao gravada ANTES do jogo.
 *
 * Diferenca que importa: o backtest (`npm run backtest:prob`) mede o modelo no
 * passado, reconstruindo os ratings com o codigo atual. Isso prova que a ideia
 * funciona, mas nao prova que o modelo publicado acertou o que ele mostrou na
 * tela naquele dia. Este arquivo prova: a probabilidade e gravada com data de
 * emissao, os ratings usados e o jogo ainda sem placar; o settle-probability
 * preenche o resultado depois. E o mesmo desenho do snapshot do score de hype.
 *
 * Regra de honestidade: os ratings sao reconstruidos SO com jogos anteriores a
 * data do snapshot — jogo de hoje nao entra na conta (senao o modelo espiaria o
 * proprio alvo). Jogo sem rating dos dois lados NAO e gravado: sem numero.
 *
 * Uso:
 *   npm run snapshot:prob               grava a rodada de hoje (modo live)
 *   npm run snapshot:prob -- 2026-09-20  grava uma data passada (modo replay)
 *
 * Modo `replay` inclui jogo já encerrado e NUNCA entra na metrica em producao do
 * settle: so o `live` (gravado antes do jogo) conta. Serve para ter historico e
 * para exercitar a liquidacao — nao para inflar o recorde.
 *
 * Saida: data/probability-snapshots/<YYYY-MM-DD>.json
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import {
  DEFAULT_HOME_ADVANTAGE,
  DEFAULT_K,
  buildRatings,
  predictFromRatings,
} from '../src/lib/matchProbability.ts'
import type { EspnMatch } from '../src/lib/espnParse.ts'
import {
  LEAGUES,
  MIN_PLAYED,
  applyResult,
  dayOf,
  fetchLeagueSeason,
  seasonFinished,
  type TeamState,
} from './lib/replay.ts'

const DIR = path.join(process.cwd(), 'data', 'probability-snapshots')

/** Modo historico: inclui jogo ja encerrado e fica fora do recorde em producao. */
const REPLAY = process.argv.includes('--replay')

/** Data do snapshot: argumento YYYY-MM-DD ou hoje no fuso de Sao Paulo. */
function alvo(): string {
  const arg = process.argv.slice(2).find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a))
  if (arg) return arg
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

interface LinhaSnapshot {
  league_id: string
  league_name: string
  home: string
  away: string
  kickoff: string | null
  prob: { home: number; draw: number; away: number }
  favorito: 'home' | 'draw' | 'away'
  rating_home: number
  rating_away: number
  jogos_home: number
  jogos_away: number
  /** Preenchidos pelo settle-probability. */
  score_home: number | null
  score_away: number | null
  outcome: 'home' | 'draw' | 'away' | null
  settled_at: string | null
}

async function main() {
  const date = alvo()
  console.log(`Snapshot de probabilidade para ${date} (ratings so com jogos anteriores)`)

  const linhas: LinhaSnapshot[] = []
  const problemas: string[] = []
  const seasons = new Set<number>()
  let ligasComJogo = 0

  for (const [leagueId, slug, leagueName] of LEAGUES) {
    let matches: EspnMatch[] = []
    try {
      matches = seasonFinished(await fetchLeagueSeason(slug, new Date(`${date}T12:00:00Z`).getFullYear()))
    } catch (error) {
      problemas.push(`${leagueId}: ${error instanceof Error ? error.message : String(error)}`)
      continue
    }

    // Estado de agora: so a temporada mais recente e NADA do jogo de hoje.
    const ultima = matches.reduce((max, m) => Math.max(max, m.season ?? 0), 0)
    const daTemporada = ultima ? matches.filter((m) => m.season === ultima) : matches
    const anteriores = daTemporada.filter((m) => dayOf(m.date) < date)
    if (ultima) seasons.add(ultima)

    const state = new Map<string, TeamState>()
    for (const m of anteriores) {
      applyResult(state, m.home, m.score_home as number, m.score_away as number)
      applyResult(state, m.away, m.score_away as number, m.score_home as number)
    }
    const ratings = buildRatings(anteriores, {})

    // Os jogos de hoje vem do scoreboard do dia, ainda sem placar.
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${date.replace(/-/g, '')}`,
      { headers: { Accept: 'application/json' } }
    )
    if (!res.ok) {
      problemas.push(`${leagueId}: scoreboard HTTP ${res.status}`)
      continue
    }
    const payload = (await res.json()) as { events?: unknown[] }
    let gravados = 0

    for (const bruto of payload.events || []) {
      const evento = bruto as {
        date?: string
        competitions?: Array<{
          status?: { type?: { name?: string } }
          competitors?: Array<{ homeAway?: string; team?: { displayName?: string } }>
        }>
        status?: { type?: { name?: string } }
      }
      const competition = (evento.competitions || [])[0] || {}
      const competitors = competition.competitors || []
      const home = competitors.find((c) => c.homeAway === 'home')?.team?.displayName
      const away = competitors.find((c) => c.homeAway === 'away')?.team?.displayName
      if (!home || !away) continue

      const statusName = (competition.status || evento.status || {}).type?.name
      // Jogo ja encerrado nao e previsao. No modo replay ele entra, mas marcado
      // como replay — nunca conta no recorde em producao.
      const encerrado = statusName === 'STATUS_FINAL' || statusName === 'STATUS_FULL_TIME'
      if (encerrado && !REPLAY) continue

      const jogosHome = state.get(home)?.played ?? 0
      const jogosAway = state.get(away)?.played ?? 0
      if (jogosHome < MIN_PLAYED || jogosAway < MIN_PLAYED) continue
      if (ratings.get(home) === undefined || ratings.get(away) === undefined) continue

      const prob = predictFromRatings(ratings, home, away, {
        homeAdvantage: DEFAULT_HOME_ADVANTAGE,
      })
      const favorito: 'home' | 'draw' | 'away' =
        prob.home >= prob.draw && prob.home >= prob.away ? 'home' : prob.away >= prob.draw ? 'away' : 'draw'

      linhas.push({
        league_id: leagueId,
        league_name: leagueName,
        home,
        away,
        kickoff: evento.date ?? null,
        prob: { home: prob.home, draw: prob.draw, away: prob.away },
        favorito,
        rating_home: Math.round((ratings.get(home) ?? 0) * 10) / 10,
        rating_away: Math.round((ratings.get(away) ?? 0) * 10) / 10,
        jogos_home: jogosHome,
        jogos_away: jogosAway,
        score_home: null,
        score_away: null,
        outcome: null,
        settled_at: null,
      })
      gravados += 1
    }

    if (gravados) ligasComJogo += 1
    console.log(`  ${leagueId.padEnd(4)} ${gravados} jogos com previsao gravada`)
  }

  if (!linhas.length) {
    console.log(`${date}: nenhum jogo elegivel — nada gravado (sem jogo, ou sem rating dos dois lados).`)
    return
  }

  mkdirSync(DIR, { recursive: true })
  const arquivo = path.join(DIR, `${date}.json`)
  const existia = existsSync(arquivo)
  const snapshot = {
    date,
    mode: REPLAY ? ('replay' as const) : ('live' as const),
    issued_at: new Date().toISOString(),
    model: { name: 'elo+poisson', k: DEFAULT_K, home_advantage: DEFAULT_HOME_ADVANTAGE },
    gate: `os dois times com >= ${MIN_PLAYED} jogos na temporada`,
    seasons: Array.from(seasons).sort(),
    leagues: ligasComJogo,
    matches: linhas,
  }
  writeFileSync(arquivo, `${JSON.stringify(snapshot, null, 2)}\n`)
  console.log(
    `${date}: ${linhas.length} previsoes em ${ligasComJogo} ligas ${existia ? '(arquivo REESCRITO — snapshot refeito)' : ''} → data/probability-snapshots/`
  )
  if (problemas.length) {
    console.log('sem dados em:')
    for (const p of problemas) console.log(`  - ${p}`)
  }
}

main().catch((error) => {
  console.error('snapshot de probabilidade falhou:', error)
  process.exit(1)
})
