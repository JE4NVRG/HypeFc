#!/usr/bin/env node
/**
 * Liquidacao do recorde do hype.
 *
 *   npm run settle:hype
 *
 * Duas tarefas:
 *   1. preenche o placar dos cards de snapshots em modo "live" que ainda estao
 *      sem resultado (casa jogo por liga + data) e regrava o arquivo;
 *   2. agrega TODOS os snapshots em public/data/hype-record.json, que e o que a
 *      tela mostra.
 *
 * Idempotente: rodar duas vezes nao muda nada depois que tudo liquidou.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { buildRecord, type HypeSnapshot, type Outcome } from '../src/lib/hypeRecord.ts'
import { LEAGUES, dayOf, fetchLeagueSeason, seasonFinished } from './lib/replay.ts'
import type { EspnMatch } from '../src/lib/espnParse.ts'

const SNAPSHOT_DIR = path.join(process.cwd(), 'data', 'snapshots')
const OUT_FILE = path.join(process.cwd(), 'public', 'data', 'hype-record.json')

function readSnapshots(): HypeSnapshot[] {
  if (!existsSync(SNAPSHOT_DIR)) return []
  return readdirSync(SNAPSHOT_DIR)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => JSON.parse(readFileSync(path.join(SNAPSHOT_DIR, name), 'utf8')) as HypeSnapshot)
}

function outcomeOf(home: number, away: number): Outcome {
  if (home > away) return 'home'
  if (away > home) return 'away'
  return 'draw'
}

/** Casa o jogo do card no feed da temporada, tolerando fuso (mesmo dia ou +-1). */
function findResult(
  season: EspnMatch[],
  home: string,
  away: string,
  day: string
): EspnMatch | null {
  const candidates = season.filter((m) => m.home === home && m.away === away)
  if (!candidates.length) return null
  const exact = candidates.find((m) => dayOf(m.date) === day)
  if (exact) return exact
  // Fuso: um jogo de 22h em Sao Paulo pode cair no dia seguinte no UTC.
  for (const candidate of candidates) {
    const candidateDay = dayOf(candidate.date)
    const gap = Math.abs(
      new Date(`${candidateDay}T12:00:00Z`).getTime() - new Date(`${day}T12:00:00Z`).getTime()
    )
    if (gap <= 36 * 60 * 60 * 1000) return candidate
  }
  return null
}

async function main() {
  const snapshots = readSnapshots()
  console.log(`snapshots: ${snapshots.length}`)

  const pending = snapshots.filter((s) => s.cards.some((card) => card.hit === null))
  const seasonCache = new Map<string, EspnMatch[]>()
  let settledCards = 0
  let rewritten = 0

  for (const snapshot of pending) {
    const leagues = Array.from(new Set(snapshot.cards.map((card) => card.league_id)))
    let changed = false

    for (const leagueId of leagues) {
      const entry = LEAGUES.find(([id]) => id === leagueId)
      if (!entry) continue
      const [, slug] = entry

      let season = seasonCache.get(leagueId)
      if (!season) {
        try {
          const year = new Date().getFullYear()
          season = [
            ...seasonFinished(await fetchLeagueSeason(slug, year - 1)),
            ...seasonFinished(await fetchLeagueSeason(slug, year)),
          ]
          seasonCache.set(leagueId, season)
        } catch (error) {
          console.log(`  ${leagueId}: falhou (${error instanceof Error ? error.message : error})`)
          continue
        }
      }

      for (const card of snapshot.cards) {
        if (card.hit !== null || card.league_id !== leagueId) continue
        const match = findResult(season, card.home, card.away, snapshot.date)
        if (!match || match.score_home === null || match.score_away === null) continue
        const outcome = outcomeOf(match.score_home, match.score_away)
        card.outcome = outcome
        card.score_home = match.score_home
        card.score_away = match.score_away
        card.hit = outcome === card.venue
        settledCards += 1
        changed = true
      }

      for (const line of snapshot.matches) {
        if (line.outcome || line.league_id !== leagueId) continue
        const match = findResult(season, line.home, line.away, snapshot.date)
        if (!match || match.score_home === null || match.score_away === null) continue
        line.score_home = match.score_home
        line.score_away = match.score_away
        line.outcome = outcomeOf(match.score_home, match.score_away)
        changed = true
      }
    }

    if (changed) {
      writeFileSync(
        path.join(SNAPSHOT_DIR, `${snapshot.date}.json`),
        `${JSON.stringify(snapshot, null, 2)}\n`
      )
      rewritten += 1
    }
  }

  console.log(`liquidados agora: ${settledCards} cards (${rewritten} arquivos regravados)`)

  const record = buildRecord(snapshots, new Date().toISOString())
  mkdirSync(path.dirname(OUT_FILE), { recursive: true })
  writeFileSync(OUT_FILE, `${JSON.stringify(record, null, 2)}\n`)

  console.log(
    `\nrecorde: ${record.flagged.n} cards liquidados de ${record.cards_total} ` +
      `| acerto ${record.flagged.rate === null ? '--' : (record.flagged.rate * 100).toFixed(1) + '%'}` +
      ` | baseline esperado ${record.baseline.expected_for_flagged === null ? '--' : (record.baseline.expected_for_flagged * 100).toFixed(1) + '%'}` +
      ` | lift ${record.lift_pp === null ? '--' : (record.lift_pp > 0 ? '+' : '') + record.lift_pp + 'pp'}` +
      `\n         replay ${record.replay_cards} cards | live ${record.live_cards} cards` +
      `\n         ${record.cards_pending} cards ainda sem resultado` +
      `\npublicado em public/data/hype-record.json`
  )
}

main().catch((error) => {
  console.error('settle falhou:', error)
  process.exit(1)
})
