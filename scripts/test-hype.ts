import assert from 'node:assert/strict'
import { buildHypeBoard, computeDayStats, isClassicMatch } from '../src/lib/hypeScore.ts'

assert.equal(isClassicMatch('CR Flamengo', 'Fluminense FC'), true)
assert.equal(isClassicMatch('FC Internazionale Milano', 'AC Milan'), true)
assert.equal(isClassicMatch('FC Porto', 'SL Benfica'), true)
assert.equal(isClassicMatch('SC Internacional', 'AC Milan'), false)
assert.equal(isClassicMatch('Associação Portuguesa de Desportos', 'FC Porto'), false)

const cold = buildHypeBoard(
  [{
    league_id: 'PL',
    league_name: 'Premier League',
    home: 'Cold FC',
    away: 'Other FC',
    status: 'TIMED',
    time_local: '16:00',
  }],
  {
    PL: [
      { team: 'Hot United', pos: 1, played: 20, form: 'W,W,W,W,W', goalDifference: 30, crest: null },
      { team: 'Cold FC', pos: 14, played: 20, form: 'L,L,L,L,L', goalDifference: -12, crest: null },
    ],
  },
  { PL: 'Premier League' }
)

assert.equal(cold.some((item) => item.team === 'Cold FC'), false)
assert.equal(cold[0]?.team, 'Hot United')
assert.equal(cold[0]?.score, 67)
assert.ok(cold[0]?.signals.includes('Líder'))
assert.ok(cold[0]?.signals.some((signal) => signal.startsWith('Forma')))

const classic = buildHypeBoard(
  [{
    league_id: 'BSA',
    league_name: 'Brasileirão Série A',
    home: 'CR Flamengo',
    away: 'Fluminense FC',
    status: 'IN_PLAY',
    time_local: '16:00',
    home_position: 2,
    away_position: 11,
  }],
  {
    BSA: [
      { team: 'CR Flamengo', pos: 2, played: 18, form: 'W,W,D,W,W', goalDifference: 16, crest: 'crest' },
      { team: 'Fluminense FC', pos: 11, played: 18, form: 'L,D,L,W,L', goalDifference: -4, crest: null },
    ],
  }
)

const flamengo = classic.find((item) => item.team === 'CR Flamengo')
assert.ok(flamengo)
assert.equal(flamengo?.opponent, 'Fluminense FC')
assert.ok(flamengo?.signals.includes('Clássico'))
assert.ok(flamengo?.signals.includes('Ao vivo'))
const fluminense = classic.find((item) => item.team === 'Fluminense FC')
assert.ok(fluminense)
assert.equal(fluminense?.score, 50)
assert.ok((flamengo?.score || 0) > (fluminense?.score || 0))

const stats = computeDayStats([
  { status: 'FINISHED', score_home: 2, score_away: 1, league_id: 'BSA' },
  { status: 'TIMED', score_home: null, score_away: null, league_id: 'BSA' },
  { status: 'IN_PLAY', score_home: 1, score_away: 0, league_id: 'PL' },
])
assert.equal(stats.totalGoals, 4)
assert.equal(stats.avgGoals, 2)
assert.equal(stats.scheduledMatches, 1)
assert.equal(stats.liveMatches, 1)

// Corte calibrado: um time mediano em boa fase NAO entra mais (score 37), e um
// do podio em boa fase entra (47). Prende os dois lados da fronteira de 44 para
// mudanca de peso ou de corte nao passar despercebida.
const boundary = buildHypeBoard(
  [
    {
      league_id: 'PL',
      league_name: 'Premier League',
      home: 'Mid Table FC',
      away: 'Podium FC',
      status: 'TIMED',
      time_local: '16:00',
    },
  ],
  {
    PL: [
      { team: 'Mid Table FC', pos: 4, played: 20, form: 'W,W,W,L,L', goalDifference: 4, crest: null },
      { team: 'Podium FC', pos: 2, played: 20, form: 'W,W,W,L,L', goalDifference: 6, crest: null },
      { team: 'Leader FC', pos: 1, played: 20, form: 'W,W,W,W,W', goalDifference: 20, crest: null },
    ],
  },
  { PL: 'Premier League' }
)

const midTable = boundary.find((item) => item.team === 'Mid Table FC')
assert.equal(midTable, undefined, 'score abaixo do corte nao pode entrar no board')

const podium = boundary.find((item) => item.team === 'Podium FC')
assert.ok(podium, 'score acima do corte precisa entrar')
assert.equal(podium?.score, 47)

// Lider que NAO joga nesta rodada: entra pela tabela (posicao 24 + forma 35 +
// saldo 8 = 67), sem o bonus de "joga hoje" e sem adversario. Prende o segundo
// passo do board, que puxa times da classificacao alem dos que tem partida.
const leader = boundary.find((item) => item.team === 'Leader FC')
assert.ok(leader, 'lider entra mesmo sem jogar na rodada')
assert.equal(leader?.score, 67)
assert.equal(leader?.opponent, null)

console.log('hype tests ok')
