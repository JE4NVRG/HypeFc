import assert from 'node:assert/strict'
import { buildLeagueIntel } from '../src/lib/leagueStats.ts'

const intel = buildLeagueIntel(
  [
    { team: 'Fortress', pos: 1, played: 10, points: 24, goalsFor: 20, goalsAgainst: 8, form: 'W,W,W,D,W', crest: '' },
    { team: 'Leaky', pos: 2, played: 10, points: 12, goalsFor: 10, goalsAgainst: 18, form: 'L,L,D,L,L', crest: '' },
  ],
  [
    { team: 'Fortress', played: 5, points: 15, goalsFor: 12, goalsAgainst: 2 },
    { team: 'Leaky', played: 5, points: 3, goalsFor: 4, goalsAgainst: 10 },
  ],
  [
    { team: 'Fortress', played: 5, points: 9, goalsFor: 8, goalsAgainst: 6 },
    { team: 'Leaky', played: 5, points: 9, goalsFor: 6, goalsAgainst: 8 },
  ]
)

assert.equal(intel.profile.matches, 10)
assert.equal(intel.profile.goals, 30)
assert.equal(intel.profile.goalsPerMatch, 3)
assert.equal(intel.profile.homePointsShare, 0.5)

const fortress = intel.teams.find((team) => team.team === 'Fortress')
assert.equal(fortress?.ppg, 2.4)
assert.equal(fortress?.gfPerGame, 2)
assert.equal(fortress?.gaPerGame, 0.8)
assert.equal(fortress?.homePpg, 3)
assert.equal(fortress?.awayPpg, 1.8)
assert.equal(fortress?.homeBias, 1.2)
assert.equal(fortress?.attackRank, 1)
assert.equal(fortress?.defenseRank, 1)
assert.equal(intel.leaders.attack?.team, 'Fortress')
assert.equal(intel.leaders.defense?.team, 'Fortress')
assert.equal(intel.leaders.homeBias?.team, 'Fortress')
assert.equal(intel.leaders.form?.team, 'Fortress')

const thin = buildLeagueIntel(
  [{ team: 'New', pos: 1, played: 2, points: 6, goalsFor: 4, goalsAgainst: 0, form: 'W,W' }],
  [{ team: 'New', played: 1, points: 3, goalsFor: 2, goalsAgainst: 0 }],
  [{ team: 'New', played: 1, points: 3, goalsFor: 2, goalsAgainst: 0 }]
)
assert.equal(thin.teams[0]?.homePpg, null)
assert.equal(thin.leaders.homeBias, null)

console.log('league stats tests ok')
