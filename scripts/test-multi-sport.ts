import assert from 'node:assert/strict'
import { SPORT_KINDS, type SportLeague } from '../src/lib/sports.ts'
import { SPORTS, sportsByKind, mapSportStatus, parseScoreboard, fetchScoreboard } from '../src/lib/multiSport.ts'

/**
 * Testes do registro multi-esporte e do parser generico de scoreboard.
 *
 * Os payloads sinteticos abaixo seguem os que a ESPN manda hoje (conferido com
 * curl --compressed): NBA com linescores, MLB com innings + jogo adiado, futebol
 * com record e os dois formatos de escudo, F1 sem competitors, ATP sem
 * competitions (torneio em groupings) e UFC com competidor de atleta (team: null).
 * No fim o teste mede, de verdade, quantos eventos cada liga responde hoje.
 */

function league(id: string): SportLeague {
  const found = SPORTS.find((item) => item.id === id)
  assert.ok(found, `liga ausente do catalogo: ${id}`)
  return found as SportLeague
}

const STATUSES = ['SCHEDULED', 'IN_PLAY', 'PAUSED', 'FINISHED', 'POSTPONED', 'OTHER']

// ---------------------------------------------------------------- catalogo
assert.equal(SPORTS.length, 17)
const ids = SPORTS.map((item) => item.id)
assert.equal(new Set(ids).size, ids.length, 'ids duplicados em SPORTS')
const paths = SPORTS.map((item) => item.path)
assert.equal(new Set(paths).size, paths.length, 'paths duplicados em SPORTS')

for (const item of SPORTS) {
  assert.ok(item.id && item.name && item.short, `liga sem id/name/short: ${JSON.stringify(item)}`)
  assert.match(item.path, /^[a-z]+\/[a-z0-9.]+$/, `path estranho: ${item.path}`)
  // A primeira pasta do path da ESPN e o proprio kind (basketball/nba, mma/ufc, ...).
  assert.equal(item.path.split('/')[0], item.kind, `kind ${item.kind} nao bate com o path ${item.path}`)
}

const grouped = sportsByKind()
assert.deepEqual(Object.keys(grouped).sort(), [...SPORT_KINDS].sort())
for (const kind of SPORT_KINDS) assert.ok(grouped[kind].length > 0, `kind sem liga no catalogo: ${kind}`)

// Futebol: mesmos ids/slugs de services/espn.ts (ESPN_LEAGUE_SLUGS).
assert.equal(grouped.soccer.length, 10)
assert.deepEqual(grouped.soccer.map((item) => item.id), ['BSA', 'PL', 'PD', 'SA', 'BL1', 'FL1', 'DED', 'PPL', 'ELC', 'CL'])
assert.deepEqual(grouped.soccer.map((item) => item.path), [
  'soccer/bra.1', 'soccer/eng.1', 'soccer/esp.1', 'soccer/ita.1', 'soccer/ger.1',
  'soccer/fra.1', 'soccer/ned.1', 'soccer/por.1', 'soccer/eng.2', 'soccer/uefa.champions',
])
// Esportes novos, com o path medido com curl.
assert.deepEqual(grouped.basketball.map((item) => item.path), ['basketball/nba'])
assert.deepEqual(grouped.football.map((item) => item.path), ['football/nfl'])
assert.deepEqual(grouped.hockey.map((item) => item.path), ['hockey/nhl'])
assert.deepEqual(grouped.baseball.map((item) => item.path), ['baseball/mlb'])
assert.deepEqual(grouped.racing.map((item) => item.path), ['racing/f1'])
assert.deepEqual(grouped.mma.map((item) => item.path), ['mma/ufc'])
assert.deepEqual(grouped.tennis.map((item) => item.path), ['tennis/atp'])

// ---------------------------------------------------------------- status
assert.equal(mapSportStatus('STATUS_SCHEDULED', 'pre'), 'SCHEDULED')
assert.equal(mapSportStatus('STATUS_TIMED', 'pre'), 'SCHEDULED')
assert.equal(mapSportStatus('STATUS_IN_PROGRESS', 'in'), 'IN_PLAY')
assert.equal(mapSportStatus('STATUS_FULL_TIME', 'post'), 'FINISHED')
assert.equal(mapSportStatus('STATUS_FINAL', 'post'), 'FINISHED')
assert.equal(mapSportStatus('STATUS_HALFTIME', 'in'), 'PAUSED')
assert.equal(mapSportStatus('STATUS_END_PERIOD', 'in'), 'PAUSED')
// O MLB de hoje manda POSTPONED com state 'post': o nome vence o state.
assert.equal(mapSportStatus('STATUS_POSTPONED', 'post'), 'POSTPONED')
// Desconhecido cai em OTHER; o state ainda serve de rede de seguranca.
assert.equal(mapSportStatus('STATUS_INVENTADO', undefined), 'OTHER')
assert.equal(mapSportStatus(undefined, undefined), 'OTHER')
assert.equal(mapSportStatus(undefined, 'pre'), 'SCHEDULED')
assert.equal(mapSportStatus('STATUS_INVENTADO', 'in'), 'IN_PLAY')
assert.equal(mapSportStatus('STATUS_INVENTADO', 'depois'), 'OTHER')

// ---------------------------------------------------------------- NBA
const nbaLeague = league('NBA')
const nba = parseScoreboard({
  events: [
    {
      id: '401902644',
      date: '2026-10-03T23:00Z',
      name: 'Miami Heat at Toronto Raptors',
      shortName: 'MIA @ TOR',
      season: { year: 2027, slug: 'preseason' },
      status: { displayClock: '0.0', period: 0, type: { name: 'STATUS_SCHEDULED', state: 'pre' } },
      competitions: [{
        status: { displayClock: '0.0', period: 0, type: { name: 'STATUS_SCHEDULED', state: 'pre' } },
        venue: { fullName: 'Videotron Centre' },
        broadcasts: [],
        broadcast: '',
        notes: [{ type: 'event', headline: 'NBA Canada Games 2026' }],
        competitors: [
          {
            id: '28', homeAway: 'home', score: '0', winner: null,
            records: [{ name: 'overall', type: 'total', summary: '0-0' }],
            team: { id: '28', displayName: 'Toronto Raptors', shortDisplayName: 'Raptors', abbreviation: 'TOR', logos: [{ href: 'https://a.espncdn.com/i/teamlogos/nba/500/tor.png' }] },
          },
          {
            id: '14', homeAway: 'away', score: '0', winner: null,
            records: [{ name: 'overall', type: 'total', summary: '0-0' }],
            team: { id: '14', displayName: 'Miami Heat', shortDisplayName: 'Heat', abbreviation: 'MIA', logos: [{ href: 'https://a.espncdn.com/i/teamlogos/nba/500/mia.png' }] },
          },
        ],
      }],
    },
    {
      id: '401900001',
      date: '2026-10-01T23:00Z',
      name: 'Boston Celtics at New York Knicks',
      status: { displayClock: '0:00', period: 4, type: { name: 'STATUS_FINAL', state: 'post' } },
      competitions: [{
        status: { displayClock: '0:00', period: 4, type: { name: 'STATUS_FINAL', state: 'post' } },
        venue: { fullName: 'Madison Square Garden' },
        broadcasts: [{ market: 'national', names: ['ESPN'] }],
        notes: [],
        competitors: [
          {
            id: '18', homeAway: 'home', score: '118', winner: true,
            records: [
              { name: 'overall', type: 'total', summary: '14-9' },
              { name: 'Home', type: 'home', summary: '8-4' },
              { name: 'Road', type: 'road', summary: '6-5' },
            ],
            linescores: [{ value: 28 }, { value: 30 }, { value: 29 }, { value: 31 }],
            team: { id: '18', displayName: 'New York Knicks', shortDisplayName: 'Knicks', abbreviation: 'NY', logos: [{ href: 'https://a.espncdn.com/i/teamlogos/nba/500/ny.png' }] },
          },
          {
            id: '2', homeAway: 'away', score: '112', winner: false,
            records: [{ name: 'overall', type: 'total', summary: '11-12' }],
            linescores: [{ value: 25 }, { value: 26 }, { value: 30 }, { value: 31 }],
            team: { id: '2', displayName: 'Boston Celtics', shortDisplayName: 'Celtics', abbreviation: 'BOS', logos: [{ href: 'https://a.espncdn.com/i/teamlogos/nba/500/bos.png' }] },
          },
        ],
      }],
    },
  ],
}, nbaLeague)

assert.equal(nba.length, 2)
// Ordenado por data asc, mesmo o payload vindo fora de ordem.
assert.deepEqual(nba.map((game) => game.id), ['401900001', '401902644'])

const nbaScheduled = nba[1] as (typeof nba)[number]
assert.equal(nbaScheduled.league_id, 'NBA')
assert.equal(nbaScheduled.league_name, 'NBA')
assert.equal(nbaScheduled.status, 'SCHEDULED')
assert.equal(nbaScheduled.clock, '0.0')
assert.equal(nbaScheduled.venue, 'Videotron Centre')
assert.equal(nbaScheduled.broadcast, null)
assert.equal(nbaScheduled.note, 'NBA Canada Games 2026')
assert.equal(nbaScheduled.competitors.length, 2)
// Jogo que nao comecou: a ESPN manda score '0', mas placar so vale depois do inicio.
assert.deepEqual(nbaScheduled.competitors.map((side) => side.score), [null, null])
assert.deepEqual(nbaScheduled.competitors.map((side) => side.home_away), ['home', 'away'])

const nbaFinished = nba[0] as (typeof nba)[number]
assert.equal(nbaFinished.status, 'FINISHED')
assert.equal(nbaFinished.clock, '0:00')
assert.equal(nbaFinished.note, null)
assert.equal(nbaFinished.venue, 'Madison Square Garden')
assert.equal(nbaFinished.broadcast, 'ESPN')
const nbaHome = nbaFinished.competitors[0]
assert.ok(nbaHome)
assert.equal(nbaHome.name, 'New York Knicks')
assert.equal(nbaHome.id, '18')
assert.equal(nbaHome.short, 'Knicks')
assert.equal(nbaHome.crest, 'https://a.espncdn.com/i/teamlogos/nba/500/ny.png')
assert.equal(nbaHome.score, 118)
assert.equal(nbaHome.home_away, 'home')
assert.equal(nbaHome.winner, true)
// records traz overall + casa/fora: o card quer o overall.
assert.equal(nbaHome.record, '14-9')
assert.equal(nbaFinished.competitors[1]?.record, '11-12')

// ---------------------------------------------------------------- MLB
const mlb = parseScoreboard({
  events: [
    {
      id: '401873648',
      date: '2026-09-22T17:05Z',
      name: 'Tampa Bay Rays at New York Yankees',
      status: { displayClock: '0:00', period: 9, type: { name: 'STATUS_FINAL', state: 'post' } },
      competitions: [{
        status: { displayClock: '0:00', period: 9, type: { name: 'STATUS_FINAL', state: 'post' } },
        venue: { fullName: 'Yankee Stadium' },
        broadcasts: [],
        // broadcasts vazio: a TV ainda vem no campo `broadcast`.
        broadcast: 'ESPN Unlmtd/MLB.TV',
        notes: [{ type: 'event', headline: 'Doubleheader - Game 1 - Makeup from May 23' }],
        competitors: [
          {
            id: '10', homeAway: 'home', score: '2', winner: true,
            records: [
              { name: 'overall', abbreviation: 'Game', type: 'total', summary: '90-66' },
              { name: 'Home', type: 'home', summary: '43-32' },
              { name: 'Road', type: 'road', summary: '47-34' },
            ],
            linescores: [{ value: 0 }, { value: 0 }, { value: 1 }, { value: 0 }, { value: 0 }, { value: 0 }, { value: 1 }, { value: 0 }, { value: 0 }],
            team: { id: '10', displayName: 'New York Yankees', shortDisplayName: 'Yankees', abbreviation: 'NYY', logo: 'https://a.espncdn.com/i/teamlogos/mlb/500/nyy.png' },
          },
          {
            id: '30', homeAway: 'away', score: '0', winner: false,
            records: [{ name: 'overall', type: 'total', summary: '95-61' }],
            team: { id: '30', displayName: 'Tampa Bay Rays', shortDisplayName: 'Rays', abbreviation: 'TB', logo: 'https://a.espncdn.com/i/teamlogos/mlb/500/tb.png' },
          },
        ],
      }],
    },
    {
      id: '401817035',
      date: '2026-09-22T22:35Z',
      name: 'Toronto Blue Jays at Baltimore Orioles',
      status: { displayClock: '0:00', period: 1, type: { name: 'STATUS_POSTPONED', state: 'post' } },
      competitions: [{
        status: { displayClock: '0:00', period: 1, type: { name: 'STATUS_POSTPONED', state: 'post' } },
        venue: { fullName: 'Oriole Park at Camden Yards' },
        broadcasts: [{ market: 'national', names: ['MLB.TV'] }],
        notes: [],
        competitors: [
          { id: '1', homeAway: 'home', score: '0', winner: null, team: { id: '1', displayName: 'Baltimore Orioles', shortDisplayName: 'Orioles', abbreviation: 'BAL' } },
          { id: '14', homeAway: 'away', score: '0', winner: null, team: { id: '14', displayName: 'Toronto Blue Jays', shortDisplayName: 'Blue Jays', abbreviation: 'TOR' } },
        ],
      }],
    },
  ],
}, league('MLB'))

assert.equal(mlb.length, 2)
const mlbFinal = mlb[0] as (typeof mlb)[number]
assert.equal(mlbFinal.league_name, 'MLB')
assert.equal(mlbFinal.status, 'FINISHED')
assert.equal(mlbFinal.broadcast, 'ESPN Unlmtd/MLB.TV')
assert.equal(mlbFinal.note, 'Doubleheader - Game 1 - Makeup from May 23')
assert.equal(mlbFinal.competitors[0]?.record, '90-66')
assert.equal(mlbFinal.competitors[0]?.crest, 'https://a.espncdn.com/i/teamlogos/mlb/500/nyy.png')
assert.equal(mlbFinal.competitors[0]?.score, 2)
const mlbPostponed = mlb[1] as (typeof mlb)[number]
assert.equal(mlbPostponed.status, 'POSTPONED')
assert.equal(mlbPostponed.broadcast, 'MLB.TV')
assert.deepEqual(mlbPostponed.competitors.map((side) => side.score), [null, null])
assert.equal(mlbPostponed.competitors[0]?.crest, null)

// ---------------------------------------------------------------- futebol
const soccer = parseScoreboard({
  events: [
    {
      id: '401841246',
      date: '2026-09-20T14:00Z',
      name: 'Palmeiras at Grêmio',
      status: { displayClock: "90'+7'", period: 2, type: { name: 'STATUS_FULL_TIME', state: 'post' } },
      competitions: [{
        status: { displayClock: "90'+7'", period: 2, type: { name: 'STATUS_FULL_TIME', state: 'post' } },
        venue: { fullName: 'Arena do Grêmio' },
        broadcasts: [],
        broadcast: '',
        notes: [],
        competitors: [
          {
            id: '6273', homeAway: 'home', score: '0', winner: false,
            records: [{ name: 'All Splits', type: 'total', summary: '7-8-13' }],
            team: { id: '6273', displayName: 'Grêmio', shortDisplayName: 'Grêmio', abbreviation: 'GRE', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/6273.png' },
          },
          {
            id: '2029', homeAway: 'away', score: '0', winner: false,
            records: [{ name: 'All Splits', type: 'total', summary: '16-9-3' }],
            team: { id: '2029', displayName: 'Palmeiras', shortDisplayName: 'Palmeiras', abbreviation: 'PAL', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/2029.png' },
          },
        ],
      }],
    },
    {
      id: '401841240',
      date: '2026-09-20T19:00Z',
      name: 'Fluminense at Corinthians',
      status: { displayClock: "45'+2'", period: 1, type: { name: 'STATUS_HALFTIME', state: 'in' } },
      competitions: [{
        status: { displayClock: "45'+2'", period: 1, type: { name: 'STATUS_HALFTIME', state: 'in' } },
        venue: { fullName: 'Neo Química Arena' },
        broadcasts: [{ market: 'national', names: ['Premiere'] }],
        notes: [],
        competitors: [
          {
            id: '874', homeAway: 'home', score: '1', winner: null,
            records: [{ name: 'All Splits', type: 'total', summary: '8-8-12' }],
            // Escudo no outro formato: logos[0].href.
            team: { id: '874', displayName: 'Corinthians', shortDisplayName: 'Corinthians', abbreviation: 'COR', logos: [{ href: 'https://a.espncdn.com/i/teamlogos/soccer/500/874.png' }] },
          },
          {
            id: '3445', homeAway: 'away', score: '3', winner: null,
            records: [{ name: 'All Splits', type: 'total', summary: '13-9-6' }],
            team: { id: '3445', displayName: 'Fluminense', shortDisplayName: 'Fluminense', abbreviation: 'FLU', logos: [{ href: 'https://a.espncdn.com/i/teamlogos/soccer/500/3445.png' }] },
          },
        ],
      }],
    },
  ],
}, league('BSA'))

assert.equal(soccer.length, 2)
const brazil = soccer[0] as (typeof soccer)[number]
assert.equal(brazil.league_id, 'BSA')
assert.equal(brazil.league_name, 'Brasileirão Série A')
assert.equal(brazil.status, 'FINISHED')
assert.equal(brazil.clock, "90'+7'")
assert.equal(brazil.venue, 'Arena do Grêmio')
assert.equal(brazil.broadcast, null)
assert.equal(brazil.competitors[0]?.name, 'Grêmio')
assert.equal(brazil.competitors[0]?.record, '7-8-13')
assert.equal(brazil.competitors[0]?.crest, 'https://a.espncdn.com/i/teamlogos/soccer/500/6273.png')
assert.equal(brazil.competitors[0]?.score, 0)
const halftime = soccer[1] as (typeof soccer)[number]
assert.equal(halftime.status, 'PAUSED')
assert.equal(halftime.clock, "45'+2'")
assert.equal(halftime.broadcast, 'Premiere')
assert.equal(halftime.competitors[0]?.crest, 'https://a.espncdn.com/i/teamlogos/soccer/500/874.png')
assert.equal(halftime.competitors[1]?.score, 3)

// ---------------------------------------------------------------- racing (sem times)
const f1 = parseScoreboard({
  events: [{
    id: '600057444',
    date: '2026-09-24T08:30Z',
    name: 'Qatar Airways Azerbaijan Grand Prix',
    shortName: 'Azerbaijan GP',
    circuit: { id: '607', fullName: 'Baku City Circuit' },
    status: { displayClock: '0:00', period: 0, type: { name: 'STATUS_SCHEDULED', state: 'pre' } },
    competitions: [{
      status: { displayClock: '0:00', period: 0, type: { name: 'STATUS_SCHEDULED', state: 'pre' } },
      broadcasts: [{ market: 'national', names: ['Apple TV'] }],
      broadcast: 'Apple TV',
      // F1 manda competicao sem `competitors` e sem `venue` (o circuito vem em event.circuit).
      type: { id: '1', abbreviation: 'FP1' },
      notes: [],
      recent: true,
    }],
  }],
}, league('F1'))

assert.equal(f1.length, 1)
const race = f1[0] as (typeof f1)[number]
assert.equal(race.league_id, 'F1')
assert.equal(race.name, 'Qatar Airways Azerbaijan Grand Prix')
assert.equal(race.status, 'SCHEDULED')
assert.equal(race.note, 'FP1')
assert.equal(race.broadcast, 'Apple TV')
assert.equal(race.venue, null)
assert.deepEqual(race.competitors, [])
assert.equal(race.date, '2026-09-24T08:30Z')

// ---------------------------------------------------------------- tennis (sem competitions)
const atp = parseScoreboard({
  events: [{
    id: '441-2026',
    date: '2026-09-22T04:00Z',
    name: 'Chengdu Open',
    shortName: 'Chengdu Open',
    major: false,
    status: { period: 3, type: { name: 'STATUS_FINAL', state: 'post' } },
    groupings: [{
      grouping: { id: '1', slug: 'mens-singles', displayName: "Men's Singles" },
      competitions: [{ id: '186127' }],
    }],
  }],
}, league('ATP'))

assert.equal(atp.length, 1)
const tournament = atp[0] as (typeof atp)[number]
assert.equal(tournament.league_id, 'ATP')
assert.equal(tournament.name, 'Chengdu Open')
assert.equal(tournament.status, 'FINISHED')
assert.equal(tournament.note, "Men's Singles")
assert.equal(tournament.clock, null)
assert.equal(tournament.venue, null)
assert.deepEqual(tournament.competitors, [])

// ---------------------------------------------------------------- mma (competidor de atleta)
const ufc = parseScoreboard({
  events: [{
    id: '600060738',
    date: '2026-09-22T23:00Z',
    name: "Dana White's Contender Series: Season 10, Week 7",
    status: { type: { name: 'STATUS_FINAL', state: 'post' } },
    competitions: [{
      status: { displayClock: '4:55', type: { name: 'STATUS_FINAL', state: 'post' } },
      venue: { fullName: 'Meta APEX' },
      broadcasts: [{ market: 'national', names: ['Paramount+'] }],
      type: { id: '990', abbreviation: 'Light Heavyweight' },
      competitors: [
        // A ESPN manda o atleta sem time: nao existe card de time nesses dois.
        { id: '5122908', homeAway: null, score: null, winner: true, athlete: { displayName: 'Damian Piwowarczyk' }, records: [{ name: 'overall', type: 'total', summary: '12-4-0' }], team: null },
        { id: '5369434', homeAway: null, score: null, winner: false, athlete: { displayName: 'Nome Do Outro' }, records: [{ name: 'overall', type: 'total', summary: '8-1-0' }], team: null },
      ],
    }],
  }],
}, league('UFC'))

assert.equal(ufc.length, 1)
const fight = ufc[0] as (typeof ufc)[number]
assert.equal(fight.league_id, 'UFC')
assert.equal(fight.status, 'FINISHED')
assert.equal(fight.note, 'Light Heavyweight')
assert.equal(fight.venue, 'Meta APEX')
assert.equal(fight.clock, '4:55')
assert.deepEqual(fight.competitors, [])

// ---------------------------------------------------------------- payload estranho
const junk: unknown[] = [
  null,
  undefined,
  42,
  'nao e json',
  [],
  {},
  { events: 'nope' },
  { events: null },
  { events: [] },
  { events: [null, 42, {}, 'x'] },
]
for (const payload of junk) {
  assert.deepEqual(parseScoreboard(payload, league('NBA')), [], `payload estranho devolveu jogo: ${JSON.stringify(payload)}`)
}

// Evento mutilado: nao lanca, nao inventa time e cai no OTHER.
const broken = parseScoreboard({
  events: [
    { id: '1', name: 'Jogo Estranho', competitions: 'nope', status: { type: { name: 'STATUS_INVENTADO' } } },
    { id: '2', name: 'Sem Time', competitions: [{ competitors: [{ team: null }, { team: {} }, 'lixo'] }] },
    { id: '3' },
  ],
}, league('NHL'))
assert.equal(broken.length, 3)
assert.equal(broken[0]?.status, 'OTHER')
assert.deepEqual(broken[0]?.competitors, [])
assert.equal(broken[1]?.status, 'OTHER')
assert.deepEqual(broken[1]?.competitors, [])
assert.equal(broken[2]?.name, '')
assert.equal(broken[2]?.date, null)

// ---------------------------------------------------------------- ordenacao
const ordered = parseScoreboard({
  events: [
    { id: 'c', name: 'Terceiro', date: '2026-09-22T23:00Z' },
    { id: 'a', name: 'Primeiro', date: '2026-09-22T01:00Z' },
    { id: 'd', name: 'Sem data' },
    { id: 'b', name: 'Segundo', date: '2026-09-22T12:30Z' },
  ],
}, league('NFL'))
assert.deepEqual(ordered.map((game) => game.id), ['a', 'b', 'c', 'd'])
assert.deepEqual(ordered.map((game) => game.status), ['OTHER', 'OTHER', 'OTHER', 'OTHER'])
assert.ok(ordered.every((game) => STATUSES.includes(game.status)))

// ---------------------------------------------------------------- fetchScoreboard
assert.deepEqual(await fetchScoreboard('NAO_EXISTE'), [])
// O catalogo e case-sensitive: só o id exato resolve (e não bate na rede).
assert.deepEqual(await fetchScoreboard('nba'), [])

// ---------------------------------------------------------------- medicao ao vivo
const rows = await Promise.all(
  SPORTS.map(async (item) => {
    const games = await fetchScoreboard(item.id)
    return { item, games }
  })
)

let total = 0
const report: string[] = []
for (const { item, games } of rows) {
  assert.ok(Array.isArray(games), `${item.id} nao devolveu lista`)
  total += games.length
  for (const game of games) {
    assert.equal(game.league_id, item.id)
    assert.ok(game.id, `${item.id}: evento sem id`)
    assert.ok(game.name, `${item.id}: evento sem nome`)
    assert.ok(STATUSES.includes(game.status), `${item.id}: status fora do vocabulario (${game.status})`)
    if (game.date) assert.match(game.date, /^\d{4}-\d{2}-\d{2}T/, `${item.id}: data nao-ISO (${game.date})`)
    if (['racing', 'mma', 'tennis'].includes(item.kind)) {
      assert.equal(game.competitors.length, 0, `${item.id}: esporte sem time com competitors`)
    } else {
      const sides = game.competitors
      assert.ok(sides.length === 0 || sides.length === 2, `${item.id}: competidores = ${sides.length}`)
      if (sides.length === 2) {
        assert.deepEqual(sides.map((side) => side.home_away).sort(), ['away', 'home'], `${item.id}: sem casa/fora`)
        assert.ok(sides.every((side) => side.name), `${item.id}: competidor sem nome`)
      }
    }
  }
  const first = games[0]
  report.push(
    `${item.id.padEnd(4)} ${item.kind.padEnd(11)} ${String(games.length).padStart(3)}  ` +
    (first ? `${first.name} [${first.status}]` : '-')
  )
}

console.log('eventos por liga (scoreboard do dia da ESPN, medido agora):')
console.log(report.join('\n'))
console.log(`total: ${total} eventos em ${SPORTS.length} ligas`)

if (total === 0) {
  // Nenhuma liga trouxe evento: ou e um dia vazio (improvavel), ou a rede caiu.
  try {
    const probe = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard', {
      headers: { Accept: 'application/json' },
    })
    const raw = (await probe.json()) as { events?: unknown[] }
    assert.ok(!(raw.events || []).length, 'fetchScoreboard devolveu zero com a ESPN respondendo eventos (parser quebrado)')
    console.log('aviso: ESPN respondeu scoreboard vazio hoje; medicao ao vivo sem jogos')
  } catch {
    console.log('aviso: sem rede para a medicao ao vivo (fetchScoreboard devolveu [] em todas as ligas)')
  }
}

console.log('multi sport tests ok')
