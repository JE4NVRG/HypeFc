#!/usr/bin/env node
/**
 * Snapshot do painel de hype — o que o site marcou, guardado com data.
 *
 * Dois modos:
 *
 *   npm run snapshot:hype            reconstroi a temporada (modo "replay")
 *   npm run snapshot:hype -- --today grava a rodada de hoje (modo "live")
 *
 * No modo replay a tabela de cada rodada e reconstruida com os jogos ANTERIORES
 * a ela, usando o buildHypeBoard() real do produto — o mesmo codigo da tela, sem
 * espiar o futuro. No modo live a captura acontece antes do jogo e entra sem
 * placar; o settle-hype preenche depois. Os dois modos ficam marcados no arquivo
 * e o recorde publico mostra a contagem de cada um separada: replay e registro
 * ao vivo nao sao a mesma coisa e nao devem ser confundidos.
 *
 * Saida: data/snapshots/<YYYY-MM-DD>.json
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { buildHypeBoard, MIN_HYPE_SCORE } from '../src/lib/hypeScore.ts'
import type { HypeCard, HypeMatchLine, HypeSnapshot, Outcome } from '../src/lib/hypeRecord.ts'
import {
  LEAGUES,
  MIN_PLAYED,
  applyResult,
  buildTable,
  dayOf,
  fetchLeagueSeason,
  seasonFinished,
  type TeamState,
} from './lib/replay.ts'

const SNAPSHOT_DIR = path.join(process.cwd(), 'data', 'snapshots')
const TODAY = process.argv.includes('--today')

function outcomeOf(home: number, away: number): Outcome {
  if (home > away) return 'home'
  if (away > home) return 'away'
  return 'draw'
}

function snapshotPath(date: string): string {
  return path.join(SNAPSHOT_DIR, `${date}.json`)
}

interface DayBucket {
  matches: HypeMatchLine[]
  cards: HypeCard[]
  seasons: Set<number>
}

async function backfill() {
  const buckets = new Map<string, DayBucket>()
  let leagues = 0
  let roundsWithCards = 0

  for (const [leagueId, slug, leagueName] of LEAGUES) {
    let matches
    try {
      // Ano atual e anterior: temporada europeia em curso atravessa o calendario.
      const year = new Date().getFullYear()
      matches = [
        ...seasonFinished(await fetchLeagueSeason(slug, year - 1)),
        ...seasonFinished(await fetchLeagueSeason(slug, year)),
      ]
    } catch (error) {
      console.log(`  ${leagueId}: falhou (${error instanceof Error ? error.message : error})`)
      continue
    }
    leagues += 1

    const byDay = new Map<string, typeof matches>()
    for (const match of matches) {
      const day = dayOf(match.date)
      if (!day) continue
      const list = byDay.get(day)
      if (list) list.push(match)
      else byDay.set(day, [match])
    }

    const state = new Map<string, TeamState>()
    let seasonAtual: number | null = null
    const days = Array.from(byDay.keys()).sort()

    for (const day of days) {
      const dayMatches = byDay.get(day) as typeof matches

      // Virada de temporada: a tabela recomeca do zero. Sem isso a Europa
      // carrega pontos e saldo da temporada anterior depois de agosto, e a
      // posicao/form dos primeiros jogos sai de duas temporadas somadas.
      const daySeason = dayMatches.find((m) => m.season != null)?.season ?? null
      if (daySeason !== null && seasonAtual !== null && daySeason !== seasonAtual) {
        state.clear()
      }
      if (daySeason !== null) seasonAtual = daySeason

      // Elegivel = os dois times ja com forma minima ANTES desta rodada.
      const eligible = dayMatches.filter(
        (m) =>
          (state.get(m.home)?.played ?? 0) >= MIN_PLAYED &&
          (state.get(m.away)?.played ?? 0) >= MIN_PLAYED
      )

      if (eligible.length) {
        const table = buildTable(state)
        const posOf = new Map(table.map((row) => [row.team, row.pos]))
        const board = buildHypeBoard(
          eligible.map((m) => ({
            league_id: leagueId,
            league_name: leagueName,
            home: m.home,
            away: m.away,
            status: 'TIMED',
          })),
          { [leagueId]: table },
          { [leagueId]: leagueName }
        )

        const bucket = buckets.get(day) ?? { matches: [], cards: [], seasons: new Set<number>() }
        if (daySeason !== null) bucket.seasons.add(daySeason)

        for (const m of eligible) {
          const outcome = outcomeOf(m.score_home as number, m.score_away as number)
          bucket.matches.push({
            league_id: leagueId,
            home: m.home,
            away: m.away,
            home_pos: posOf.get(m.home) ?? null,
            away_pos: posOf.get(m.away) ?? null,
            score_home: m.score_home,
            score_away: m.score_away,
            outcome,
          })
        }

        for (const item of board) {
          const match = eligible.find((m) => m.home === item.team || m.away === item.team)
          if (!match) continue
          const venue: 'home' | 'away' = match.home === item.team ? 'home' : 'away'
          const outcome = outcomeOf(match.score_home as number, match.score_away as number)
          const opponent = venue === 'home' ? match.away : match.home

          bucket.cards.push({
            league_id: leagueId,
            league_name: leagueName,
            home: match.home,
            away: match.away,
            team: item.team,
            venue,
            score: item.score,
            flags: item.signals,
            pos: posOf.get(item.team) ?? null,
            opp_pos: posOf.get(opponent) ?? null,
            outcome,
            score_home: match.score_home,
            score_away: match.score_away,
            hit: outcome === venue,
          })
        }

        if (bucket.cards.length) buckets.set(day, bucket)
      }

      // O estado acumula TODOS os jogos do dia, marcados ou nao.
      for (const m of dayMatches) {
        applyResult(state, m.home, m.score_home as number, m.score_away as number)
        applyResult(state, m.away, m.score_away as number, m.score_home as number)
      }
    }
  }

  mkdirSync(SNAPSHOT_DIR, { recursive: true })

  for (const [day, bucket] of Array.from(buckets.entries())) {
    const file = snapshotPath(day)
    if (existsSync(file)) {
      console.log(`  ${day}: ja existe, nao sobrescrevo (${bucket.cards.length} cards reconstruidos)`)
      continue
    }
    const snapshot: HypeSnapshot = {
      date: day,
      seasons: Array.from(bucket.seasons).sort(),
      mode: 'replay',
      cutoff: MIN_HYPE_SCORE,
      min_played: MIN_PLAYED,
      captured_at: `${day}T00:00:00-03:00`,
      matches: bucket.matches,
      cards: bucket.cards,
    }
    writeFileSync(file, `${JSON.stringify(snapshot, null, 2)}\n`)
    roundsWithCards += 1
  }

  const cards = Array.from(buckets.values()).reduce((sum, b) => sum + b.cards.length, 0)
  console.log(
    `\nreplay: ${leagues} ligas | ${roundsWithCards} rodadas gravadas | ${cards} cards\n` +
      `destino: data/snapshots/`
  )
}

async function today() {
  const date = dayOf(new Date().toISOString())
  const file = snapshotPath(date)
  if (existsSync(file)) {
    console.log(`${date}: snapshot ja existe — nao sobrescrevo (evita misturar live com replay).`)
    return
  }

  const cards: HypeCard[] = []
  const lines: HypeMatchLine[] = []
  const seasons = new Set<number>()
  let rounds = 0

  for (const [leagueId, slug, leagueName] of LEAGUES) {
    let matches
    try {
      matches = seasonFinished(await fetchLeagueSeason(slug, new Date().getFullYear()))
    } catch (error) {
      console.log(`  ${leagueId}: falhou (${error instanceof Error ? error.message : error})`)
      continue
    }

    // Estado de agora: so a temporada mais recente, e nada do jogo de hoje.
    const lastSeason = matches.reduce((max, m) => Math.max(max, m.season ?? 0), 0)
    const state = new Map<string, TeamState>()
    for (const m of matches) {
      if (lastSeason && m.season !== lastSeason) continue
      applyResult(state, m.home, m.score_home as number, m.score_away as number)
      applyResult(state, m.away, m.score_away as number, m.score_home as number)
    }
    if (lastSeason) seasons.add(lastSeason)

    // Jogos de hoje ainda sem placar: a fonte de verdade e o scoreboard do dia.
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${date.replace(/-/g, '')}`,
      { headers: { Accept: 'application/json' } }
    )
    if (!res.ok) continue
    const payload = await res.json()
    const events: Array<{
      status?: string
      home?: string
      away?: string
    }> = []
    for (const event of payload.events || []) {
      const competition = (event.competitions || [])[0] || {}
      const competitors = competition.competitors || []
      const home = competitors.find(
        (c: { homeAway?: string }) => c.homeAway === 'home'
      )?.team
      const away = competitors.find(
        (c: { homeAway?: string }) => c.homeAway === 'away'
      )?.team
      const statusName = (competition.status || event.status || {}).type?.name
      if (!home?.displayName || !away?.displayName) continue
      if (statusName === 'STATUS_FINAL' || statusName === 'STATUS_FULL_TIME') continue
      events.push({ status: statusName, home: home.displayName, away: away.displayName })
    }

    const eligible = events.filter(
      (e) =>
        (state.get(e.home as string)?.played ?? 0) >= MIN_PLAYED &&
        (state.get(e.away as string)?.played ?? 0) >= MIN_PLAYED
    )
    if (!eligible.length) continue
    rounds += 1

    const table = buildTable(state)
    const posOf = new Map(table.map((row) => [row.team, row.pos]))
    const board = buildHypeBoard(
      eligible.map((e) => ({
        league_id: leagueId,
        league_name: leagueName,
        home: e.home as string,
        away: e.away as string,
        status: 'TIMED',
      })),
      { [leagueId]: table },
      { [leagueId]: leagueName }
    )

    for (const e of eligible) {
      lines.push({
        league_id: leagueId,
        home: e.home as string,
        away: e.away as string,
        score_home: null,
        score_away: null,
        outcome: null,
      })
    }

    for (const item of board) {
      const event = eligible.find((e) => e.home === item.team || e.away === item.team)
      if (!event) continue
      const venue: 'home' | 'away' = event.home === item.team ? 'home' : 'away'
      cards.push({
        league_id: leagueId,
        league_name: leagueName,
        home: event.home as string,
        away: event.away as string,
        team: item.team,
        venue,
        score: item.score,
        flags: item.signals,
        pos: posOf.get(item.team) ?? null,
        opp_pos: posOf.get(venue === 'home' ? (event.away as string) : (event.home as string)) ?? null,
        outcome: null,
        score_home: null,
        score_away: null,
        hit: null,
      })
    }
  }

  if (!cards.length) {
    console.log(`${date}: nenhum jogo elegivel hoje — nada gravado.`)
    return
  }

  mkdirSync(SNAPSHOT_DIR, { recursive: true })
  const snapshot: HypeSnapshot = {
    date,
    seasons: Array.from(seasons).sort(),
    mode: 'live',
    cutoff: MIN_HYPE_SCORE,
    min_played: MIN_PLAYED,
    captured_at: new Date().toISOString(),
    matches: lines,
    cards,
  }
  writeFileSync(file, `${JSON.stringify(snapshot, null, 2)}\n`)
  console.log(`${date}: ${cards.length} cards gravados (${rounds} ligas) em data/snapshots/`)
}

async function main() {
  if (TODAY) {
    console.log('Snapshot ao vivo (antes dos jogos de hoje)\n')
    await today()
  } else {
    console.log('Snapshot por replay da temporada\n')
    await backfill()
  }
}

main().catch((error) => {
  console.error('snapshot falhou:', error)
  process.exit(1)
})
