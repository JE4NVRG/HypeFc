/**
 * Recorde publico do hype score.
 *
 * O score diz "olha esse time" — e sem historico isso nao passa de heuristica
 * com peso escolhido a mao. Aqui ficam os dois lados: o que o painel marcou e o
 * que aconteceu depois, agregado com tamanho de amostra a vista.
 *
 * Regras que valem para o site publicado:
 *
 * - **Sem lookahead.** Cada card e capturado antes do jogo acontecer; o replay
 *   reconstroi a tabela apenas com jogos anteriores aquela rodada.
 * - **Replay e registro ao vivo nao se misturam.** O modo "replay" foi
 *   reconstruido depois (mesma funcao do produto, sem espiar), o modo "live" foi
 *   gravado antes do jogo. Os dois aparecem no recorde com a contagem separada.
 * - **Baseline e da mesma partida, nao um numero global.** Esperado = media do
 *   mando considerando em que lado cada card estava.
 * - **Amostra pequena nao vira taxa.** Bucket abaixo de MIN_BUCKET_SAMPLE sai
 *   com `rate: null`; a tela mostra o n e nao inventa porcentagem.
 */

export const MIN_BUCKET_SAMPLE = 30

export type Outcome = 'home' | 'draw' | 'away'
export type SnapshotMode = 'replay' | 'live'

export interface HypeMatchLine {
  league_id: string
  home: string
  away: string
  /** Posicoes na tabela daquele momento: permitem a ancora "melhor colocado". */
  home_pos?: number | null
  away_pos?: number | null
  score_home: number | null
  score_away: number | null
  outcome: Outcome | null
}

export interface HypeCard {
  league_id: string
  league_name: string
  home: string
  away: string
  /** Time marcado pelo painel. */
  team: string
  venue: 'home' | 'away'
  score: number
  flags: string[]
  /** Posicao do marcado e do adversario na tabela daquele momento. */
  pos: number | null
  opp_pos: number | null
  outcome: Outcome | null
  score_home: number | null
  score_away: number | null
  hit: boolean | null
}

export interface HypeSnapshot {
  date: string
  /**
   * Temporadas presentes na rodada. Nao e um numero so: em janeiro o Brasil ja
   * esta na temporada 2026 enquanto a Europa ainda joga a de 2025.
   */
  seasons?: number[]
  mode: SnapshotMode
  cutoff: number
  min_played: number
  captured_at: string
  matches: HypeMatchLine[]
  cards: HypeCard[]
}

export interface Tally {
  n: number
  wins: number
  rate: number | null
}

export interface Bucket extends Tally {
  key: string
  /** Presente apenas no controle de vies: o que o mando sozinho ja explicava. */
  expected?: number | null
  lift_pp?: number | null
}

export interface HypeRecord {
  generated_at: string
  cutoff: number
  method: string
  snapshots: number
  completed_rounds: number
  cards_total: number
  cards_settled: number
  cards_pending: number
  live_cards: number
  replay_cards: number
  flagged: Tally
  baseline: {
    n: number
    home_rate: number | null
    away_rate: number | null
    draw_rate: number | null
    expected_for_flagged: number | null
  }
  lift_pp: number | null
  /**
   * Ancora dura: com que frequencia vence o time MELHOR colocado, sem olhar
   * hype nenhum. E contra isso que o marcado tem que se comparar — comparar com
   * a media crua do mando infla o ganho porque o marcado quase sempre e o
   * melhor colocado da tabela.
   */
  anchor: {
    n: number
    wins: number
    rate: number | null
    home_rate: number | null
    away_rate: number | null
    expected_for_flagged: number | null
  }
  anchor_lift_pp: number | null
  by_venue: Bucket[]
  by_band: Bucket[]
  by_league: Bucket[]
  by_round: Bucket[]
  by_edge: Bucket[]
  recent: HypeCard[]
  notes: string[]
}

function rate(wins: number, n: number): number | null {
  if (n < MIN_BUCKET_SAMPLE) return null
  return Math.round((wins / n) * 1000) / 1000
}

function tally(wins: number, n: number): Tally {
  return { n, wins, rate: rate(wins, n) }
}

export function bandOf(score: number): string {
  if (score < 40) return '28-39'
  if (score < 55) return '40-54'
  return '55+'
}

export function edgeOf(card: HypeCard): string | null {
  if (card.pos === null || card.opp_pos === null) return null
  if (card.pos < card.opp_pos) return 'marcado MELHOR colocado'
  if (card.pos > card.opp_pos) return 'marcado PIOR colocado'
  return 'mesma posicao'
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000
}

/**
 * Agrega snapshots no recorde publico. Puro: mesma entrada, mesma saida — por
 * isso da para prender o comportamento em teste em vez de conferir na tela.
 */
export function buildRecord(snapshots: HypeSnapshot[], generatedAt: string): HypeRecord {
  const ordered = [...snapshots].sort((a, b) => a.date.localeCompare(b.date))

  const allCards: HypeCard[] = []
  let homeOutcomes = 0
  let awayOutcomes = 0
  let drawOutcomes = 0
  let matchLines = 0
  let completedRounds = 0
  let liveCards = 0
  let replayCards = 0

  const anchor = { n: 0, wins: 0, homeN: 0, winsHome: 0, awayN: 0, winsAway: 0 }

  const byVenue = new Map<string, { n: number; wins: number }>()
  const byBand = new Map<string, { n: number; wins: number }>()
  const byLeague = new Map<string, { n: number; wins: number }>()
  const byRound = new Map<string, { n: number; wins: number; homeN: number; awayN: number }>()
  const byEdge = new Map<string, { n: number; wins: number; homeN: number; awayN: number }>()

  for (const snapshot of ordered) {
    let roundSettled = 0
    let roundMatchesSettled = 0

    if (snapshot.mode === 'live') liveCards += snapshot.cards.length
    else replayCards += snapshot.cards.length

    for (const line of snapshot.matches) {
      matchLines += 1
      if (line.outcome === 'home') homeOutcomes += 1
      else if (line.outcome === 'away') awayOutcomes += 1
      else if (line.outcome === 'draw') drawOutcomes += 1
      if (line.outcome) roundMatchesSettled += 1

      // Ancora: o melhor colocado venceu? (sem saber de hype nenhum)
      const homePos = line.home_pos ?? null
      const awayPos = line.away_pos ?? null
      if (line.outcome && homePos && awayPos && homePos !== awayPos) {
        const betterIsHome = homePos < awayPos
        const betterWon = line.outcome === (betterIsHome ? 'home' : 'away')
        anchor.n += 1
        if (betterWon) anchor.wins += 1
        if (betterIsHome) {
          anchor.homeN += 1
          if (betterWon) anchor.winsHome += 1
        } else {
          anchor.awayN += 1
          if (betterWon) anchor.winsAway += 1
        }
      }
    }

    for (const card of snapshot.cards) {
      allCards.push(card)
      if (card.hit === null) continue
      roundSettled += 1

      const won = card.hit ? 1 : 0

      const venueKey = card.venue === 'home' ? 'casa' : 'fora'
      const venueRow = byVenue.get(venueKey) ?? { n: 0, wins: 0 }
      venueRow.n += 1
      venueRow.wins += won
      byVenue.set(venueKey, venueRow)

      const bandRow = byBand.get(bandOf(card.score)) ?? { n: 0, wins: 0 }
      bandRow.n += 1
      bandRow.wins += won
      byBand.set(bandOf(card.score), bandRow)

      const leagueRow = byLeague.get(card.league_id) ?? { n: 0, wins: 0 }
      leagueRow.n += 1
      leagueRow.wins += won
      byLeague.set(card.league_id, leagueRow)

      const roundRow = byRound.get(snapshot.date) ?? { n: 0, wins: 0, homeN: 0, awayN: 0 }
      roundRow.n += 1
      roundRow.wins += won
      if (card.venue === 'home') roundRow.homeN += 1
      else roundRow.awayN += 1
      byRound.set(snapshot.date, roundRow)

      const edgeKey = edgeOf(card)
      if (edgeKey) {
        const edgeRow = byEdge.get(edgeKey) ?? { n: 0, wins: 0, homeN: 0, awayN: 0 }
        edgeRow.n += 1
        edgeRow.wins += won
        if (card.venue === 'home') edgeRow.homeN += 1
        else edgeRow.awayN += 1
        byEdge.set(edgeKey, edgeRow)
      }
    }

    if (roundSettled > 0 && roundSettled === snapshot.cards.length) completedRounds += 1
  }

  const settledCards = allCards.filter((card) => card.hit !== null)
  const wins = settledCards.filter((card) => card.hit).length
  const flagged = tally(wins, settledCards.length)

  const homeRate = matchLines ? homeOutcomes / matchLines : 0
  const awayRate = matchLines ? awayOutcomes / matchLines : 0
  const drawRate = matchLines ? drawOutcomes / matchLines : 0

  const homeOnHome = settledCards.filter((card) => card.venue === 'home').length
  const awayOnAway = settledCards.filter((card) => card.venue === 'away').length
  const expectedForFlagged = settledCards.length
    ? round3((homeOnHome * homeRate + awayOnAway * awayRate) / settledCards.length)
    : null

  const anchorHomeRate = anchor.homeN ? anchor.winsHome / anchor.homeN : 0
  const anchorAwayRate = anchor.awayN ? anchor.winsAway / anchor.awayN : 0
  const anchorExpectedForFlagged =
    settledCards.length && anchor.n
      ? round3((homeOnHome * anchorHomeRate + awayOnAway * anchorAwayRate) / settledCards.length)
      : null

  const byRoundBuckets: Bucket[] = Array.from(byRound.entries()).map(([key, row]) => {
    const expected = (row.homeN * homeRate + row.awayN * awayRate) / row.n
    const actual = row.wins / row.n
    return {
      key,
      n: row.n,
      wins: row.wins,
      rate: rate(row.wins, row.n),
      expected: round3(expected),
      lift_pp: Math.round((actual - expected) * 1000) / 10,
    }
  })

  const byEdgeBuckets: Bucket[] = Array.from(byEdge.entries()).map(([key, row]) => {
    const expected = round3((row.homeN * homeRate + row.awayN * awayRate) / row.n)
    const actual = row.wins / row.n
    return {
      key,
      n: row.n,
      wins: row.wins,
      rate: rate(row.wins, row.n),
      expected,
      lift_pp: Math.round((actual - expected) * 1000) / 10,
    }
  })

  return {
    generated_at: generatedAt,
    cutoff: ordered.length ? ordered[ordered.length - 1].cutoff : 0,
    method:
      'Rodada a rodada: a tabela e reconstruida apenas com jogos anteriores a rodada ' +
      '(sem lookahead) e o buildHypeBoard do produto marca os times. Cards em modo ' +
      'replay foram reconstruidos; cards em modo live foram gravados antes do jogo.',
    snapshots: ordered.length,
    completed_rounds: completedRounds,
    cards_total: allCards.length,
    cards_settled: settledCards.length,
    cards_pending: allCards.length - settledCards.length,
    live_cards: liveCards,
    replay_cards: replayCards,
    flagged,
    baseline: {
      n: matchLines,
      home_rate: matchLines ? round3(homeRate) : null,
      away_rate: matchLines ? round3(awayRate) : null,
      draw_rate: matchLines ? round3(drawRate) : null,
      expected_for_flagged: expectedForFlagged,
    },
    lift_pp:
      expectedForFlagged !== null && flagged.rate !== null
        ? Math.round((flagged.rate - expectedForFlagged) * 1000) / 10
        : null,
    anchor: {
      n: anchor.n,
      wins: anchor.wins,
      rate: rate(anchor.wins, anchor.n),
      home_rate: anchor.homeN ? round3(anchorHomeRate) : null,
      away_rate: anchor.awayN ? round3(anchorAwayRate) : null,
      expected_for_flagged: anchorExpectedForFlagged,
    },
    anchor_lift_pp:
      anchorExpectedForFlagged !== null && flagged.rate !== null
        ? Math.round((flagged.rate - anchorExpectedForFlagged) * 1000) / 10
        : null,
    by_venue: Array.from(byVenue.entries()).map(([key, row]) => ({
      key,
      n: row.n,
      wins: row.wins,
      rate: rate(row.wins, row.n),
    })),
    by_band: Array.from(byBand.entries())
      .map(([key, row]) => ({ key, n: row.n, wins: row.wins, rate: rate(row.wins, row.n) }))
      .sort((a, b) => a.key.localeCompare(b.key)),
    by_league: Array.from(byLeague.entries())
      .map(([key, row]) => ({ key, n: row.n, wins: row.wins, rate: rate(row.wins, row.n) }))
      .sort((a, b) => b.n - a.n),
    by_round: byRoundBuckets.slice(-20),
    by_edge: byEdgeBuckets.sort((a, b) => b.n - a.n),
    recent: settledCards.slice(-24).reverse(),
    notes: [
      'Acerto = o time marcado venceu a partida. Empate conta como erro.',
      `Bucket com menos de ${MIN_BUCKET_SAMPLE} cards sai sem taxa: amostra pequena nao vira numero.`,
      'O marcado quase sempre e o melhor colocado da tabela, entao o lift sobre a media do ' +
        'mando exagera. A comparacao honesta e com a ancora: quanto vence um melhor colocado ' +
        'qualquer (sem hype nenhum) nesses mesmos jogos.',
      'Nao e palpite nem sinal de aposta: o score mede atencao/embalo, nao valor de mercado.',
    ],
  }
}
