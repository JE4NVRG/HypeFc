import assert from 'node:assert/strict'
import { attachMatchStats, parseEspnScoreboard, teamsMatch } from '../src/lib/matchStats.ts'

assert.equal(teamsMatch('SE Palmeiras', 'Palmeiras'), true)
assert.equal(teamsMatch('RB Bragantino', 'Red Bull Bragantino'), true)
assert.equal(teamsMatch('Manchester United FC', 'Manchester City'), false)
assert.equal(teamsMatch('SC Internacional', 'FC Internazionale Milano'), false)

const fixtures = parseEspnScoreboard({
  events: [{
    competitions: [{
      competitors: [
        {
          homeAway: 'home',
          team: { displayName: 'Grêmio' },
          statistics: [
            { name: 'possessionPct', displayValue: '28.2' },
            { name: 'totalShots', displayValue: '7' },
            { name: 'shotsOnTarget', displayValue: '4' },
            { name: 'wonCorners', displayValue: '2' },
          ],
        },
        {
          homeAway: 'away',
          team: { displayName: 'Palmeiras' },
          statistics: [
            { name: 'possessionPct', displayValue: '71.8' },
            { name: 'totalShots', displayValue: '15' },
            { name: 'shotsOnTarget', displayValue: '6' },
            { name: 'wonCorners', displayValue: '9' },
          ],
        },
      ],
    }],
  }],
})

const attached = attachMatchStats(
  [{ home: 'SE Palmeiras', away: 'Grêmio FBPA', league_id: 'BSA' }],
  fixtures
)
assert.equal(attached[0]?.match_stats?.shots_home, 15)
assert.equal(attached[0]?.match_stats?.possession_away, 28.2)
assert.equal(attached[0]?.match_stats?.source, 'espn')

console.log('match stats tests ok')
