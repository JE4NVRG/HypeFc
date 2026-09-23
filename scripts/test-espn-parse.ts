import assert from 'node:assert/strict'
import {
  mapEspnStatus,
  parseEspnStandings,
  parseEspnMatches,
  parseEspnLeaders,
  parseEspnTeamMeta,
  buildTeamFormIndex,
  lookupTeamForm,
  normalizeTeamKey,
} from '../src/lib/espnParse.ts'

assert.equal(mapEspnStatus('STATUS_FULL_TIME', 'post'), 'FINISHED')
assert.equal(mapEspnStatus('STATUS_HALFTIME', 'in'), 'PAUSED')
assert.equal(mapEspnStatus('STATUS_IN_PROGRESS', 'in'), 'IN_PLAY')
assert.equal(mapEspnStatus('STATUS_POSTPONED', 'pre'), 'POSTPONED')
assert.equal(mapEspnStatus(undefined, 'pre'), 'TIMED')
assert.equal(mapEspnStatus(undefined, undefined), 'SCHEDULED')

const standings = parseEspnStandings({
  children: [{
    standings: {
      entries: [
        {
          team: { displayName: 'Manchester City', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/382.png' },
          stats: [
            { name: 'gamesPlayed', value: 10 },
            { name: 'wins', value: 8 },
            { name: 'ties', value: 1 },
            { name: 'losses', value: 1 },
            { name: 'points', value: 25 },
            { name: 'pointsFor', value: 24 },
            { name: 'pointsAgainst', value: 8 },
            { name: 'rank', value: 1 },
            { name: 'pointDifferential', displayValue: '+16' },
          ],
        },
        {
          team: { displayName: 'Arsenal' },
          stats: [
            { name: 'gamesPlayed', value: 10 },
            { name: 'wins', value: 7 },
            { name: 'ties', value: 2 },
            { name: 'losses', value: 1 },
            { name: 'points', value: 23 },
            { name: 'pointsFor', value: 20 },
            { name: 'pointsAgainst', value: 10 },
            { name: 'rank', value: 2 },
            { name: 'pointDifferential', displayValue: '+10' },
          ],
        },
      ],
    },
  }],
})

assert.equal(standings.length, 2)
assert.equal(standings[0]?.team, 'Manchester City')
assert.equal(standings[0]?.pts, 25)
assert.equal(standings[0]?.draws, 1)
assert.equal(standings[0]?.goalDifference, 16)
assert.equal(standings[0]?.goalsFor, 24)
assert.equal(standings[1]?.pos, 2)

const matches = parseEspnMatches(
  {
    events: [
      {
        date: '2026-09-20T21:30Z',
        status: { type: { name: 'STATUS_SCHEDULED', state: 'pre' } },
        competitions: [{
          competitors: [
            { homeAway: 'home', team: { displayName: 'Flamengo', logo: 'https://x/f.png' }, score: '0' },
            { homeAway: 'away', team: { displayName: 'Bragantino' }, score: '0' },
          ],
        }],
      },
      {
        date: '2026-09-20T14:00Z',
        status: { type: { name: 'STATUS_FULL_TIME', state: 'post' } },
        competitions: [{
          competitors: [
            { homeAway: 'home', team: { displayName: 'Grêmio' }, score: '0' },
            { homeAway: 'away', team: { displayName: 'Palmeiras' }, score: '2' },
          ],
        }],
      },
    ],
  },
  'BSA',
  'Brasileirão Série A'
)

assert.equal(matches.length, 2)
const scheduled = matches.find((match) => match.home === 'Flamengo')
assert.equal(scheduled?.status, 'TIMED')
assert.equal(scheduled?.score_home, null)
assert.equal(scheduled?.home_crest, 'https://x/f.png')
const finished = matches.find((match) => match.home === 'Grêmio')
assert.equal(finished?.score_away, 2)
assert.equal(finished?.status, 'FINISHED')

const leaders = parseEspnLeaders(
  {
    categories: [
      {
        name: 'goals',
        leaders: [
          { value: 12, athlete: { $ref: 'a/1' }, team: { $ref: 't/1' } },
          { value: 9, athlete: { $ref: 'a/2' }, team: { $ref: 't/2' } },
        ],
      },
    ],
  },
  'goals'
)
assert.equal(leaders.length, 2)
assert.equal(leaders[0]?.value, 12)
assert.equal(leaders[0]?.athleteRef, 'a/1')
assert.equal(parseEspnLeaders({ categories: [] }, 'goals').length, 0)

const metas = parseEspnTeamMeta({
  events: [{
    competitions: [{
      competitors: [
        { homeAway: 'home', form: 'DLLLW', team: { id: '6273', displayName: 'Grêmio', shortDisplayName: 'Grêmio', abbreviation: 'GRE' } },
        { homeAway: 'away', form: 'DLWWD', team: { id: '3458', displayName: 'Athletico Paranaense', shortDisplayName: 'Athletico-PR', abbreviation: 'CAP' } },
      ],
    }],
  }],
})

assert.equal(metas.length, 2)
const index = buildTeamFormIndex(metas)
assert.equal(index.byId.get('3458'), 'DLWWD')
assert.equal(index.byAbbr.get('GRE'), 'DLLLW')
assert.equal(lookupTeamForm(index, { team: 'Athletico-PR' }), 'DLWWD')
assert.equal(lookupTeamForm(index, { team: 'Grêmio' }), 'DLLLW')
assert.equal(lookupTeamForm(index, { team: 'Athletico Paranaense', espn_id: '3458' }), 'DLWWD')
assert.equal(lookupTeamForm(index, { team: 'Time Desconhecido' }), null)
assert.equal(normalizeTeamKey('Grêmio'), 'gremio')
assert.equal(normalizeTeamKey('Athletico-PR'), 'athleticopr')

console.log('espn parse tests ok')
