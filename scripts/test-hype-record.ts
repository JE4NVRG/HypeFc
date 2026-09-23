import assert from 'node:assert/strict'
import {
  buildRecord,
  bandOf,
  edgeOf,
  MIN_BUCKET_SAMPLE,
  type HypeCard,
  type HypeMatchLine,
  type HypeSnapshot,
} from '../src/lib/hypeRecord.ts'

/**
 * Fixture gerada: 40 cards liquidados + 5 pendentes, em dois snapshots (um
 * replay, um live). Numeros escolhidos para dar conta redonda:
 *   baseline: 20 casa / 12 fora / 8 empate em 40 jogos -> 0.5 e 0.3
 *   cards:    24 acertos em 40 -> 0.6
 *   esperado pelo mando: (20*0.5 + 20*0.3)/40 = 0.4  ->  lift +20pp
 */
const matches: HypeMatchLine[] = []
for (let i = 0; i < 20; i += 1) {
  matches.push({ league_id: 'BSA', home: `H${i}`, away: `A${i}`, home_pos: 1, away_pos: 10, score_home: 2, score_away: 0, outcome: 'home' })
}
for (let i = 0; i < 12; i += 1) {
  matches.push({ league_id: 'PL', home: `H${i}`, away: `A${i}`, home_pos: 12, away_pos: 2, score_home: 0, score_away: 1, outcome: 'away' })
}
for (let i = 0; i < 8; i += 1) {
  matches.push({ league_id: 'PD', home: `H${i}`, away: `A${i}`, home_pos: 5, away_pos: 9, score_home: 1, score_away: 1, outcome: 'draw' })
}

function card(index: number, overrides: Partial<HypeCard> = {}): HypeCard {
  return {
    league_id: 'BSA',
    league_name: 'Brasileirao',
    home: `H${index}`,
    away: `A${index}`,
    team: `H${index}`,
    venue: 'home',
    score: 60,
    flags: ['forma'],
    pos: 1,
    opp_pos: 10,
    outcome: 'home',
    score_home: 2,
    score_away: 0,
    hit: true,
    ...overrides,
  }
}

// 20 cards em casa (14 acertos, score 60 -> faixa 55+) + 20 fora (10 acertos,
// score 45 -> faixa 40-54) = 24 acertos
const cards: HypeCard[] = []
for (let i = 0; i < 20; i += 1) {
  cards.push(card(i, { venue: 'home', score: 60, hit: i < 14, outcome: i < 14 ? 'home' : 'away' }))
}
for (let i = 0; i < 20; i += 1) {
  cards.push(
    card(100 + i, {
      league_id: i < 3 ? 'XX' : 'PL',
      venue: 'away',
      score: 45,
      team: `A${i}`,
      hit: i < 10,
      outcome: i < 10 ? 'away' : 'draw',
      pos: i < 6 ? 15 : 2,
      opp_pos: 5,
    })
  )
}

const pendentes: HypeCard[] = []
for (let i = 0; i < 5; i += 1) {
  pendentes.push(card(200 + i, { hit: null, outcome: null, score_home: null, score_away: null }))
}

const replay: HypeSnapshot = {
  date: '2026-09-01',
  mode: 'replay',
  cutoff: 44,
  min_played: 5,
  captured_at: '2026-09-01T00:00:00-03:00',
  matches,
  cards,
}
const live: HypeSnapshot = {
  date: '2026-09-02',
  mode: 'live',
  cutoff: 44,
  min_played: 5,
  captured_at: '2026-09-02T10:00:00-03:00',
  matches: [],
  cards: pendentes,
}

const record = buildRecord([live, replay], '2026-09-03T00:00:00.000Z')

assert.equal(record.snapshots, 2)
assert.equal(record.cards_total, 45)
assert.equal(record.cards_settled, 40)
assert.equal(record.cards_pending, 5)
assert.equal(record.replay_cards, 40)
assert.equal(record.live_cards, 5)

// Taxa do marcado: 24/40
assert.equal(record.flagged.n, 40)
assert.equal(record.flagged.wins, 24)
assert.equal(record.flagged.rate, 0.6)

// Baseline e do mesmo conjunto de jogos
assert.equal(record.baseline.n, 40)
assert.equal(record.baseline.home_rate, 0.5)
assert.equal(record.baseline.away_rate, 0.3)
assert.equal(record.baseline.draw_rate, 0.2)

// Esperado ponderado pelo lado em que cada card estava
assert.equal(record.baseline.expected_for_flagged, 0.4)
assert.equal(record.lift_pp, 20)

// Ancora dura: o melhor colocado venceu 32 de 40 (20 em casa + 12 fora); o
// empate deu errado para o melhor colocado → 32/40
assert.equal(record.anchor.n, 40)
assert.equal(record.anchor.wins, 32)
assert.equal(record.anchor.rate, 0.8)
assert.equal(record.anchor.home_rate, 0.714)
assert.equal(record.anchor.away_rate, 1)
// (20*0.714 + 20*1)/40 = 0.857 e o que a ancora preveria para este conjunto
assert.equal(record.anchor.expected_for_flagged, 0.857)
assert.equal(record.anchor_lift_pp, -25.7)

// Por mando
const casa = record.by_venue.find((row) => row.key === 'casa')
const fora = record.by_venue.find((row) => row.key === 'fora')
assert.equal(casa?.n, 20)
assert.equal(casa?.wins, 14)
assert.equal(fora?.n, 20)
assert.equal(fora?.wins, 10)

// Amostra pequena nao vira taxa: a liga com 3 cards sai com rate null
const pouca = record.by_league.find((row) => row.key === 'XX')
assert.equal(pouca?.n, 3)
assert.equal(pouca?.rate, null)

// Controle de vies: melhor e pior colocado caem em baldes separados
// (20 em casa com pos 1 vs 10 + 14 fora com pos 2 vs 5 = 34 melhores; 6 piores)
const melhor = record.by_edge.find((row) => row.key === 'marcado MELHOR colocado')
const pior = record.by_edge.find((row) => row.key === 'marcado PIOR colocado')
assert.equal(melhor?.n, 34)
assert.equal(pior?.n, 6)

// Faixas de score
assert.equal(bandOf(39), '28-39')
assert.equal(bandOf(40), '40-54')
assert.equal(bandOf(55), '55+')
const faixa = record.by_band.find((row) => row.key === '40-54')
assert.equal(faixa?.n, 20)
const faixaAlta = record.by_band.find((row) => row.key === '55+')
assert.equal(faixaAlta?.n, 20)
assert.equal(record.by_band.find((row) => row.key === '28-39'), undefined)

// Edge: so mesmo time, posicao define o balde
assert.equal(edgeOf(card(1, { pos: 1, opp_pos: 9 })), 'marcado MELHOR colocado')
assert.equal(edgeOf(card(1, { pos: 9, opp_pos: 1 })), 'marcado PIOR colocado')
assert.equal(edgeOf(card(1, { pos: 5, opp_pos: 5 })), 'mesma posicao')
assert.equal(edgeOf(card(1, { pos: null, opp_pos: 5 })), null)

// Pendente nao entra em balde
assert.equal(record.by_round.find((row) => row.key === '2026-09-02'), undefined)
assert.equal(record.by_round.find((row) => row.key === '2026-09-01')?.n, 40)

// Recentes: so liquidados, mais novos primeiro, teto de 24
assert.equal(record.recent.length, 24)
assert.equal(record.recent.every((entry) => entry.hit !== null), true)

// Amostra insuficiente em balde menor que o piso
assert.equal(MIN_BUCKET_SAMPLE, 30)
assert.equal(record.by_round.find((row) => row.key === '2026-09-01')?.rate, 0.6)

console.log('hype record tests ok')
