#!/usr/bin/env node
/**
 * Liquida os snapshots de probabilidade e publica o recorde EM PRODUCAO.
 *
 * O que este numero e, e o que nao e:
 *   - E out-of-sample de verdade: cada probabilidade foi gravada antes do jogo,
 *     com data de emissao, sem chance de ajuste retroativo.
 *   - NAO e o backtest. O backtest mede o modelo no passado; este arquivo mede o
 *     que o produto publicou. Os dois numeros ficam separados justamente porque
 *     sao coisas diferentes — juntar inflaria a amostra de um com a do outro.
 *   - Divide por modo: `live` (gravado antes do jogo) conta no recorde;
 *     `replay` aparece na contagem mas nao entra na metrica.
 *
 * Uso: npm run settle:prob
 * Saida: public/data/probability-forward.json (+ data/probability-snapshots/*.json liquidados)
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { brierScore, calibration, logLoss, type ProbOutcome } from '../src/lib/matchProbability.ts'
import { LEAGUES } from './lib/replay.ts'

const DIR = path.join(process.cwd(), 'data', 'probability-snapshots')
const OUT = path.join(process.cwd(), 'public', 'data', 'probability-forward.json')
const SLUG_POR_LIGA = new Map(LEAGUES.map(([id, slug]) => [id, slug]))

type Outcome = 'home' | 'draw' | 'away'

interface Linha {
  league_id: string
  home: string
  away: string
  prob: { home: number; draw: number; away: number }
  score_home: number | null
  score_away: number | null
  outcome: Outcome | null
  settled_at: string | null
}

interface Snapshot {
  date: string
  mode: 'live' | 'replay'
  issued_at: string
  model?: { name: string; k: number; home_advantage: number }
  matches: Linha[]
}

function outcomeOf(home: number, away: number): Outcome {
  if (home > away) return 'home'
  if (away > home) return 'away'
  return 'draw'
}

/** Resultado do dia na ESPN, por liga, casado por id do evento quando der. */
async function resultadosDoDia(date: string): Promise<Map<string, { home: string; away: string; gh: number; ga: number }>> {
  const mapa = new Map<string, { home: string; away: string; gh: number; ga: number }>()
  for (const [leagueId, slug] of SLUG_POR_LIGA) {
    try {
      const res = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${date.replace(/-/g, '')}`,
        { headers: { Accept: 'application/json' } }
      )
      if (!res.ok) continue
      const payload = (await res.json()) as { events?: unknown[] }
      for (const bruto of payload.events || []) {
        const evento = bruto as {
          competitions?: Array<{
            status?: { type?: { name?: string } }
            competitors?: Array<{ homeAway?: string; score?: string; team?: { displayName?: string } }>
          }>
          status?: { type?: { name?: string } }
        }
        const competition = (evento.competitions || [])[0] || {}
        const statusName = (competition.status || evento.status || {}).type?.name
        if (statusName !== 'STATUS_FINAL' && statusName !== 'STATUS_FULL_TIME') continue
        const competitors = competition.competitors || []
        const casa = competitors.find((c) => c.homeAway === 'home')
        const fora = competitors.find((c) => c.homeAway === 'away')
        const home = casa?.team?.displayName
        const away = fora?.team?.displayName
        if (!home || !away || casa?.score === undefined || fora?.score === undefined) continue
        mapa.set(`${leagueId}|${home}|${away}`, {
          home,
          away,
          gh: Number(casa.score),
          ga: Number(fora.score),
        })
      }
    } catch {
      // liga sem resposta nao invalida as outras: segue
    }
  }
  return mapa
}

async function main() {
  if (!existsSync(DIR)) {
    console.log('sem data/probability-snapshots — rode npm run snapshot:prob primeiro.')
    return
  }

  const arquivos = readdirSync(DIR).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort()
  const porData: Array<{ date: string; mode: string; total: number; settled: number }> = []
  let liquidadasAgora = 0

  for (const arquivo of arquivos) {
    const caminho = path.join(DIR, arquivo)
    const snapshot = JSON.parse(readFileSync(caminho, 'utf8')) as Snapshot
    const pendentes = snapshot.matches.filter((m) => m.outcome === null)
    const resultados = pendentes.length ? await resultadosDoDia(snapshot.date) : new Map()
    let mudou = false

    for (const linha of snapshot.matches) {
      if (linha.outcome !== null) continue
      const achado = resultados.get(`${linha.league_id}|${linha.home}|${linha.away}`)
      if (!achado) continue
      linha.score_home = achado.gh
      linha.score_away = achado.ga
      linha.outcome = outcomeOf(achado.gh, achado.ga)
      linha.settled_at = new Date().toISOString()
      mudou = true
      liquidadasAgora += 1
    }

    if (mudou) writeFileSync(caminho, `${JSON.stringify(snapshot, null, 2)}\n`)
    porData.push({
      date: snapshot.date,
      mode: snapshot.mode,
      total: snapshot.matches.length,
      settled: snapshot.matches.filter((m) => m.outcome !== null).length,
    })
  }

  // Metricas SO do modo live liquidado (o registro que o produto publicou).
  const linhasLive: Array<{ prob: { home: number; draw: number; away: number }; outcome: Outcome }> = []
  for (const arquivo of arquivos) {
    const snapshot = JSON.parse(readFileSync(path.join(DIR, arquivo), 'utf8')) as Snapshot
    if (snapshot.mode !== 'live') continue
    for (const linha of snapshot.matches) {
      if (linha.outcome === null) continue
      linhasLive.push({ prob: linha.prob, outcome: linha.outcome })
    }
  }

  const rows: ProbOutcome[] = linhasLive.map((l) => ({ probs: l.prob, outcome: l.outcome }))
  const n = linhasLive.length
  const acertos = linhasLive.filter((l) => {
    const p = l.prob
    const favorito = p.home >= p.draw && p.home >= p.away ? 'home' : p.away >= p.draw ? 'away' : 'draw'
    return favorito === l.outcome
  }).length
  const brier = n ? brierScore(rows) : null
  const bits = n ? logLoss(rows) : null
  const buckets = n ? calibration(rows, 5) : []
  const calibradas = buckets.filter((b) => b.n >= 30)
  const desvio = calibradas.length
    ? calibradas.reduce((s, b) => s + Math.abs(b.observed - b.predicted), 0) / calibradas.length
    : null

  const payload = {
    generated_at: new Date().toISOString(),
    kind: 'forward' as const,
    definition:
      'Registro EM PRODUCAO: cada probabilidade foi gravada antes do jogo (data de emissao no snapshot) e liquidada depois. Nao confundir com o backtest, que mede o modelo no passado.',
    source: 'ESPN (site.api.espn.com)',
    counts: {
      dias_gravados: porData.length,
      partidas_gravadas: porData.reduce((s, d) => s + d.total, 0),
      partidas_liquidadas: n,
      pendentes: porData.reduce((s, d) => s + (d.total - d.settled), 0),
    },
    metrics: n
      ? {
          n,
          brier: Number(brier!.toFixed(4)),
          log_loss: Number(bits!.toFixed(4)),
          top_pick_hit_rate: Number((acertos / n).toFixed(4)),
          calibration: buckets.map((b) => ({
            bucket: b.bucket,
            n: b.n,
            predicted: Number(b.predicted.toFixed(4)),
            observed: Number(b.observed.toFixed(4)),
          })),
          mean_abs_error_pp: desvio === null ? null : Number((desvio * 100).toFixed(2)),
        }
      : null,
    days: porData,
    honest_notes: [
      'Amostra em producao comeca em zero: numero pequeno no inicio e esperado, e nao vira conclusao antes de algumas centenas de partidas.',
      'Favorito do modelo acerta na mesma faixa da ancora "melhor colocado da tabela" no backtest — probabilidade calibrada, nao vantagem de palpite.',
      'Nao e sinal de aposta nem recomendacao.',
    ],
  }

  mkdirSync(path.dirname(OUT), { recursive: true })
  writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`)

  console.log(`settle:prob — ${liquidadasAgora} partida(s) liquidada(s) agora`)
  console.log(
    `  gravadas: ${payload.counts.partidas_gravadas} | no recorde em producao (modo live): ${n} | pendentes: ${payload.counts.pendentes}`
  )
  if (liquidadasAgora > n) {
    console.log('  (as demais sao modo replay: entram no historico e na contagem, fora da metrica)')
  }
  if (n) {
    console.log(`  EM PRODUCAO: Brier ${payload.metrics!.brier} · log loss ${payload.metrics!.log_loss} · acerto ${(payload.metrics!.top_pick_hit_rate * 100).toFixed(1)}% (n=${n})`)
  } else {
    console.log('  EM PRODUCAO: nenhuma partida liquidada ainda — sem metrica ate o primeiro jogo terminar.')
  }
  console.log('  public/data/probability-forward.json atualizado')
}

main().catch((error) => {
  console.error('settle de probabilidade falhou:', error)
  process.exit(1)
})
