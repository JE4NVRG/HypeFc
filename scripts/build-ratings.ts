/**
 * Publica os ratings do modelo de probabilidade como arquivo estatico.
 *
 * Por que existe: o site e estatico (GitHub Pages, sem backend). O modelo Elo
 * precisa da temporada inteira para saber a forca de cada time, e baixar isso no
 * navegador seria absurdo. Entao os ratings sao reconstruidos aqui, no build, e
 * servidos como public/data/ratings.json — o cliente so consulta a tabela.
 *
 * Regra de honestidade: so a temporada CORRENTE entra. Carregar Elo de um
 * campeonato para o outro inflaria o rating (o backtest zera na virada).
 *
 * Uso: node --experimental-strip-types scripts/build-ratings.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { EspnMatch } from '../src/lib/espnParse.ts'
import {
  DEFAULT_HOME_ADVANTAGE,
  DEFAULT_K,
  buildRatings,
} from '../src/lib/matchProbability.ts'
import { LEAGUES, fetchLeagueSeason, seasonFinished } from './lib/replay.ts'

const SEASON = 2026

interface LeagueRatings {
  league_id: string
  league_name: string
  slug: string
  season: number | null
  matches: number
  teams: number
  ratings: Record<string, number>
}

async function main() {
  const root = process.cwd()
  const leagues: Record<string, LeagueRatings> = {}
  const problemas: string[] = []

  for (const [leagueId, slug, leagueName] of LEAGUES) {
    let finished: EspnMatch[] = []
    try {
      finished = seasonFinished(await fetchLeagueSeason(slug, SEASON))
    } catch (error) {
      problemas.push(`${leagueId}: ${error instanceof Error ? error.message : String(error)}`)
      continue
    }
    if (finished.length === 0) {
      problemas.push(`${leagueId}: nenhum jogo encerrado`)
      continue
    }

    // Só a temporada mais recente presente no payload. Em liga europeia o
    // dates=<ano> traz dois campeonatos e misturar os dois distorce o rating.
    const seasonAtual = finished.reduce<number | null>((max, m) => {
      const s = m.season ?? null
      if (s === null) return max
      return max === null || s > max ? s : max
    }, null)
    const daTemporada = seasonAtual === null ? finished : finished.filter((m) => (m.season ?? seasonAtual) === seasonAtual)

    const ratings = buildRatings(daTemporada, {})
    const tabela: Record<string, number> = {}
    for (const [team, rating] of ratings) tabela[team] = Math.round(rating * 10) / 10

    leagues[leagueId] = {
      league_id: leagueId,
      league_name: leagueName,
      slug,
      season: seasonAtual,
      matches: daTemporada.length,
      teams: Object.keys(tabela).length,
      ratings: tabela,
    }
  }

  const payload = {
    generated_at: new Date().toISOString(),
    season: SEASON,
    model: { name: 'elo+poisson', k: DEFAULT_K, home_advantage: DEFAULT_HOME_ADVANTAGE },
    note: 'Rating Elo reconstruido so com a temporada corrente. Nao e palpite: o acerto medido esta em /data/probability-record.json',
    leagues,
  }

  const dir = resolve(root, 'public/data')
  mkdirSync(dir, { recursive: true })
  writeFileSync(resolve(dir, 'ratings.json'), `${JSON.stringify(payload, null, 2)}\n`)

  const totalTimes = Object.values(leagues).reduce((sum, l) => sum + l.teams, 0)
  const totalJogos = Object.values(leagues).reduce((sum, l) => sum + l.matches, 0)
  console.log(`[ratings] ${Object.keys(leagues).length} ligas · ${totalTimes} times · ${totalJogos} jogos de base`)
  for (const l of Object.values(leagues)) {
    const top = Object.entries(l.ratings)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([t, r]) => `${t} ${r}`)
      .join(' · ')
    console.log(`  ${l.league_name.padEnd(22)} temporada ${l.season ?? '--'} · ${l.matches} jogos → ${top}`)
  }
  if (problemas.length) {
    console.log('[ratings] sem dados em:')
    for (const p of problemas) console.log(`  - ${p}`)
  }
  console.log('[ratings] public/data/ratings.json escrito')
}

main().catch((error) => {
  console.error('[ratings] falhou:', error)
  process.exit(1)
})
