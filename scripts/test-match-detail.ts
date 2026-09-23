import assert from 'node:assert/strict'
import { parseMatchDetail } from '../src/lib/matchDetail.ts'

// --- Jogo encerrado: tudo preenchido (formato real do summary da ESPN) ---

const finished = parseMatchDetail(
  {
    header: {
      league: { name: 'Brazilian Serie A' },
      competitions: [{
        date: '2026-09-20T14:00Z',
        status: { type: { name: 'STATUS_FULL_TIME', state: 'post' } },
        competitors: [
          {
            homeAway: 'home',
            score: '0',
            // competitor so traz logos[]; o boxscore e que traz logo
            team: { id: '6273', displayName: 'Grêmio', logos: [{ href: 'https://x/gremio.png' }] },
          },
          {
            homeAway: 'away',
            score: '0',
            team: { id: '2029', displayName: 'Palmeiras' },
          },
        ],
      }],
    },
    boxscore: {
      teams: [
        {
          homeAway: 'home',
          displayOrder: 1,
          team: { id: '6273', displayName: 'Grêmio', logo: 'https://x/gremio-box.png' },
          statistics: [
            { name: 'foulsCommitted', displayValue: '19' },
            { name: 'possessionPct', displayValue: '28.2' },
            { name: 'totalShots', displayValue: '7' },
            { name: 'shotsOnTarget', displayValue: '4' },
            { name: 'wonCorners', displayValue: '2' },
            { name: 'yellowCards', displayValue: '5' },
            { name: 'redCards', displayValue: '0' },
            { name: 'saves', displayValue: '10' },
            { name: 'offsides', displayValue: '1' },
            // fora da lista pedida pela UI: nao deve aparecer
            { name: 'shotPct', displayValue: '0.6' },
            { name: 'accuratePasses', displayValue: '172' },
            // displayValue vazio cai no value numerico
            { name: 'blockedShots', displayValue: '', value: 2 },
          ],
        },
        {
          homeAway: 'away',
          displayOrder: 2,
          team: { id: '2029', displayName: 'Palmeiras' },
          statistics: [
            { name: 'possessionPct', displayValue: '71.8' },
            { name: 'totalShots', displayValue: '31' },
            { name: 'shotsOnTarget', displayValue: '10' },
            { name: 'wonCorners', displayValue: '9' },
            { name: 'foulsCommitted', displayValue: '14' },
            { name: 'yellowCards', displayValue: '5' },
            { name: 'redCards', displayValue: '0' },
            { name: 'saves', displayValue: '4' },
            // sem offsides: o lado do Palmeiras fica null
          ],
        },
      ],
    },
    gameInfo: {
      venue: {
        fullName: 'Arena do Grêmio',
        address: { city: 'Porto Alegre', country: 'Brazil' },
      },
      attendance: 0,
      officials: [{ fullName: 'Paulo Cezar Zanovelli Da Silva' }],
    },
    rosters: [
      {
        team: { id: '6273', displayName: 'Grêmio' },
        roster: [
          { starter: true, jersey: '1', athlete: { displayName: 'Weverton' }, position: { abbreviation: 'G', name: 'Goalkeeper' } },
          { starter: true, jersey: '2', athlete: { displayName: 'Fabián Balbuena' }, position: { abbreviation: 'CD' } },
          { starter: false, athlete: { fullName: 'Reserva Sem Camisa' } },
        ],
      },
      {
        team: { id: '2029', displayName: 'Palmeiras' },
        roster: [
          { starter: true, jersey: '1', athlete: { displayName: 'Carlos Miguel' }, position: { abbreviation: 'G' } },
          // sem atleta: descartado
          { starter: false, jersey: '9' },
        ],
      },
    ],
    lastFiveGames: [
      {
        team: { id: '6273', displayName: 'Grêmio' },
        events: [
          { gameDate: '2026-08-30T21:30Z', atVs: 'vs', score: '3-1', gameResult: 'W', homeTeamId: '6273', awayTeamId: '9318', opponent: { displayName: 'Chapecoense' } },
          { gameDate: '2026-09-07T23:00Z', score: '1-0', gameResult: 'L', homeTeamId: '3457', awayTeamId: '6273', opponent: { displayName: 'Vitória' } },
          { gameDate: '2026-09-10T23:00Z', atVs: '@', gameResult: 'X', homeTeamScore: '2', awayTeamScore: '2', opponent: { name: 'Bahia' } },
        ],
      },
      {
        team: { id: '2029', displayName: 'Palmeiras' },
        events: [
          { gameDate: '2026-09-03T00:30Z', atVs: '@', score: '0-0', gameResult: 'D', opponent: { displayName: 'Santos' } },
        ],
      },
    ],
    seasonseries: [{
      type: 'head-to-head',
      events: [
        {
          date: '2026-04-03T00:30:00Z',
          competitionName: '2026 Brasileiro Serie A ',
          competitors: [
            { homeAway: 'home', score: '2', team: { displayName: 'Palmeiras' } },
            { homeAway: 'away', score: '1', team: { displayName: 'Grêmio' } },
          ],
        },
        {
          date: '2025-11-26T00:30:00Z',
          competitors: [
            { homeAway: 'home', team: { displayName: 'Grêmio' } },
            { homeAway: 'away', score: '2', team: { displayName: 'Palmeiras' } },
          ],
        },
      ],
    }],
    headToHead: {
      events: [
        {
          // repetido do seasonseries: nao pode duplicar
          date: '2026-04-03T00:30:00Z',
          competitionName: '2026 Brasileiro Serie A ',
          competitors: [
            { homeAway: 'home', score: '2', team: { displayName: 'Palmeiras' } },
            { homeAway: 'away', score: '1', team: { displayName: 'Grêmio' } },
          ],
        },
        {
          date: '2024-07-04T22:00:00Z',
          competitors: [
            { homeAway: 'home', score: '2', team: { displayName: 'Grêmio' } },
            { homeAway: 'away', score: '2', team: { displayName: 'Palmeiras' } },
          ],
        },
      ],
    },
    keyEvents: [
      { type: { text: 'Kickoff', type: 'kickoff' }, clock: { displayValue: '' } },
      {
        type: { text: 'Yellow Card', type: 'yellow-card' },
        text: 'Agustín Giay (Palmeiras) is shown the yellow card for a bad foul.',
        clock: { displayValue: "33'" },
        team: { displayName: 'Palmeiras' },
      },
      {
        type: { type: 'substitution' },
        clock: { displayValue: "68'" },
        team: { name: 'Grêmio' },
      },
    ],
    commentary: [
      { time: { displayValue: '' }, text: 'Lineups are announced and players are warming up.' },
    ],
    odds: [
      { provider: { name: 'DraftKings' }, details: 'PAL -110' },
      { provider: { name: 'DraftKings' }, details: 'PAL -110' },
      { provider: { name: 'Bet 365' } },
    ],
    pickcenter: [{ provider: { name: 'NaoUsado' }, details: 'X' }],
  },
  'BSA',
  'Brasileirão Série A',
  '401841246'
)

assert.equal(finished.event_id, '401841246')
assert.equal(finished.league_id, 'BSA')
assert.equal(finished.league_name, 'Brasileirão Série A')
assert.equal(finished.status, 'FINISHED')
assert.equal(finished.kickoff, '2026-09-20T14:00Z')
assert.equal(finished.source, 'espn')
assert.ok(Date.parse(finished.captured_at) > 0)
assert.deepEqual(finished.venue, {
  name: 'Arena do Grêmio',
  city: 'Porto Alegre',
  country: 'Brazil',
  attendance: 0,
})
assert.equal(finished.referee, 'Paulo Cezar Zanovelli Da Silva')

// crest: logo do competitor quando existe, senao o do boxscore
assert.equal(finished.home.team, 'Grêmio')
assert.equal(finished.home.crest, 'https://x/gremio.png')
assert.equal(finished.away.team, 'Palmeiras')
assert.equal(finished.away.crest, null)
assert.equal(finished.home.score, 0)
assert.equal(finished.away.score, 0)

// stats: ordem fixa, so as pedidas, valor numerico e null no lado ausente
assert.equal(finished.home.stats.length, 9)
assert.deepEqual(
  finished.home.stats.map((stat) => stat.label),
  ['Posse de bola', 'Chutes', 'No alvo', 'Escanteios', 'Faltas', 'Amarelos', 'Vermelhos', 'Defesas', 'Impedimentos']
)
assert.deepEqual(
  finished.home.stats.map((stat) => stat.key),
  ['possessionPct', 'totalShots', 'shotsOnTarget', 'wonCorners', 'foulsCommitted', 'yellowCards', 'redCards', 'saves', 'offsides']
)
assert.equal(finished.home.stats[0]?.home, 28.2)
assert.equal(finished.home.stats[0]?.away, 71.8)
assert.equal(finished.home.stats[0]?.unit, 'pct')
assert.equal(finished.home.stats[1]?.unit, 'count')
assert.equal(finished.home.stats[7]?.home, 10)
assert.equal(finished.home.stats[8]?.home, 1)
assert.equal(finished.home.stats[8]?.away, null)
assert.ok(!finished.home.stats.some((stat) => stat.key === 'shotPct'))

// escalacao: numero/posicao faltando viram null, sem atleta sai da lista
assert.deepEqual(finished.home.lineup, [
  { name: 'Weverton', number: '1', position: 'G', starter: true },
  { name: 'Fabián Balbuena', number: '2', position: 'CD', starter: true },
  { name: 'Reserva Sem Camisa', number: null, position: null, starter: false },
])
assert.deepEqual(finished.away.lineup, [
  { name: 'Carlos Miguel', number: '1', position: 'G', starter: true },
])

// ultimos jogos: casa/fora pelo id, placar pelo score ou pelos lados
assert.deepEqual(finished.home.lastFive.map((game) => [game.result, game.home, game.score]), [
  ['W', true, '3-1'],
  ['L', false, '1-0'],
  [null, false, '2-2'],
])
assert.equal(finished.home.lastFive[2]?.opponent, 'Bahia')
assert.deepEqual(finished.away.lastFive, [
  { date: '2026-09-03T00:30Z', opponent: 'Santos', home: false, result: 'D', score: '0-0' },
])

// confrontos: seasonseries + headToHead sem duplicar
assert.equal(finished.meetings.length, 3)
assert.deepEqual(finished.meetings[0], {
  date: '2026-04-03T00:30:00Z',
  home: 'Palmeiras',
  away: 'Grêmio',
  score_home: 2,
  score_away: 1,
  competition: '2026 Brasileiro Serie A',
})
assert.equal(finished.meetings[1]?.score_home, null)
assert.equal(finished.meetings[1]?.score_away, 2)
assert.equal(finished.meetings[2]?.date, '2024-07-04T22:00:00Z')

// eventos: minuto vazio vira null, texto cai no type.text, time opcional
assert.equal(finished.events.length, 3)
assert.deepEqual(finished.events[0], { minute: null, type: 'Kickoff', text: 'Kickoff', team: null })
assert.deepEqual(finished.events[1], {
  minute: "33'",
  type: 'Yellow Card',
  text: 'Agustín Giay (Palmeiras) is shown the yellow card for a bad foul.',
  team: 'Palmeiras',
})
assert.deepEqual(finished.events[2], { minute: "68'", type: 'substitution', text: 'substitution', team: 'Grêmio' })

// odds: dedup por provedor+odd e provedor sem odd continua
assert.deepEqual(finished.odds, [
  { provider: 'DraftKings', detail: 'PAL -110' },
  { provider: 'Bet 365', detail: '' },
])

// --- Jogo que nao comecou: sem stats, sem keyEvents, sem placar ---

const scheduled = parseMatchDetail(
  {
    header: {
      competitions: [{
        date: '2026-10-02T23:00Z',
        status: { type: { name: 'STATUS_SCHEDULED', state: 'pre' } },
        competitors: [
          { homeAway: 'home', score: '0', team: { id: '2026', displayName: 'São Paulo', logos: [{ href: 'https://x/sao.png' }] } },
          { homeAway: 'away', score: '0', team: { id: '2674', displayName: 'Santos', logos: [{ href: 'https://x/san.png' }] } },
        ],
      }],
    },
    boxscore: {
      teams: [
        {
          homeAway: 'home',
          // antes do apito o boxscore traz stat de temporada, nao de jogo
          team: { id: '2026', displayName: 'São Paulo', logo: 'https://x/sao.png' },
          statistics: [{ name: 'totalGoals', displayValue: '32' }, { name: 'goalDifference', displayValue: '2' }],
        },
        { homeAway: 'away', team: { id: '2674', displayName: 'Santos' }, statistics: [{ name: 'totalGoals', displayValue: '41' }] },
      ],
    },
    rosters: [
      { team: { id: '2026' }, roster: [{ starter: true, jersey: '1', athlete: { displayName: 'Rafael' }, position: { abbreviation: 'G' } }] },
      { team: { id: '2674' }, roster: [] },
    ],
    lastFiveGames: [{ team: { id: '2026' }, events: [] }],
    seasonseries: [{ type: 'head-to-head', events: [] }],
    headToHead: null,
    commentary: [{ time: { displayValue: '2' }, text: 'First Half begins.' }],
    pickcenter: [{ provider: { name: 'DraftKings' }, details: 'SAO +120' }],
  },
  'BSA',
  'Brasileirão Série A',
  '401841169'
)

assert.equal(scheduled.status, 'TIMED')
assert.equal(scheduled.home.score, null)
assert.equal(scheduled.away.score, null)
assert.deepEqual(scheduled.home.stats, [])
assert.deepEqual(scheduled.away.stats, [])
assert.equal(scheduled.home.crest, 'https://x/sao.png')
assert.equal(scheduled.home.lineup.length, 1)
assert.deepEqual(scheduled.away.lineup, [])
assert.deepEqual(scheduled.home.lastFive, [])
assert.deepEqual(scheduled.meetings, [])
// sem keyEvents o timeline usa o commentary
assert.deepEqual(scheduled.events, [{ minute: '2', type: 'commentary', text: 'First Half begins.', team: null }])
// sem odds, cai no pickcenter
assert.deepEqual(scheduled.odds, [{ provider: 'DraftKings', detail: 'SAO +120' }])
assert.equal(scheduled.referee, null)
assert.deepEqual(scheduled.venue, { name: null, city: null, country: null, attendance: null })

// --- Payload vazio ou quebrado: nunca lanca ---

for (const payload of [{}, null, undefined, 'x', 42]) {
  const empty = parseMatchDetail(payload, 'PL', '', '')
  assert.equal(empty.status, 'SCHEDULED')
  assert.equal(empty.league_id, 'PL')
  // sem nome de liga passado, cai no id
  assert.equal(empty.league_name, 'PL')
  assert.equal(empty.kickoff, null)
  assert.equal(empty.referee, null)
  assert.deepEqual(empty.home, { team: '', crest: null, score: null, stats: [], lineup: [], lastFive: [] })
  assert.deepEqual(empty.away.lineup, [])
  assert.deepEqual(empty.meetings, [])
  assert.deepEqual(empty.events, [])
  assert.deepEqual(empty.odds, [])
  assert.equal(empty.source, 'espn')
  assert.deepEqual(empty.venue, { name: null, city: null, country: null, attendance: null })
}

// nome da liga vem do payload quando o parametro nao e passado
const fromPayload = parseMatchDetail(
  { header: { league: { name: 'Brazilian Serie A' } } },
  'BSA',
  '',
  '1'
)
assert.equal(fromPayload.league_name, 'Brazilian Serie A')

// --- Mapa de status (mesmos valores do MatchStatus do app) ---

const statusOf = (name: string, state: string) =>
  parseMatchDetail(
    { header: { competitions: [{ status: { type: { name, state } } }] } },
    'BSA', 'x', '1'
  ).status

assert.equal(statusOf('STATUS_IN_PROGRESS', 'in'), 'IN_PLAY')
assert.equal(statusOf('STATUS_FIRST_HALF', 'in'), 'IN_PLAY')
assert.equal(statusOf('STATUS_HALFTIME', 'in'), 'PAUSED')
assert.equal(statusOf('STATUS_FULL_TIME', 'post'), 'FINISHED')
assert.equal(statusOf('STATUS_POSTPONED', 'pre'), 'POSTPONED')
assert.equal(statusOf('STATUS_SUSPENDED', 'post'), 'SUSPENDED')
assert.equal(statusOf('', 'post'), 'FINISHED')
assert.equal(statusOf('', ''), 'SCHEDULED')

// --- Placar so aparece depois do apito ---

const live = parseMatchDetail(
  {
    header: {
      competitions: [{
        status: { type: { name: 'STATUS_SECOND_HALF', state: 'in' } },
        competitors: [
          { homeAway: 'home', score: '2', team: { displayName: 'Flamengo' } },
          { homeAway: 'away', score: '1', team: { displayName: 'Vasco' } },
        ],
      }],
    },
  },
  'BSA', 'Brasileirão Série A', '2'
)
assert.equal(live.status, 'IN_PLAY')
assert.equal(live.home.score, 2)
assert.equal(live.away.score, 1)

// boxscore sem header: as stats ainda casam pelo homeAway do bloco
const noHeader = parseMatchDetail(
  {
    boxscore: {
      teams: [
        { homeAway: 'home', team: { id: '1', displayName: 'Casa' }, statistics: [{ name: 'totalShots', displayValue: '9' }] },
        { homeAway: 'away', team: { id: '2', displayName: 'Fora' }, statistics: [{ name: 'totalShots', displayValue: '3' }] },
      ],
    },
  },
  'BSA', 'Brasileirão Série A', '3'
)
assert.deepEqual(noHeader.home.stats, [{ key: 'totalShots', label: 'Chutes', home: 9, away: 3, unit: 'count' }])
assert.equal(noHeader.home.team, '')
assert.equal(noHeader.away.team, '')

console.log('match detail tests ok')
