import assert from 'node:assert/strict'
import {
  buildHomeAwaySplits,
  alignSplitRows,
  splitsReconcile,
  type SplitInput,
  type SplitRow,
} from '../src/lib/splits.ts'
import { buildLeagueIntel, type TableSide } from '../src/lib/leagueStats.ts'

const finished = (
  home: string,
  away: string,
  score_home: number,
  score_away: number
): SplitInput => ({ home, away, status: 'FINISHED', score_home, score_away })

const matches: SplitInput[] = [
  finished('A', 'B', 2, 0),
  finished('A', 'C', 1, 1),
  finished('A', 'D', 0, 3),
  finished('C', 'B', 2, 1),
  finished('D', 'A', 1, 0),
  finished('B', 'A', 1, 1),
  finished('C', 'A', 1, 1),
  // agendado: nao pode entrar em nenhum dos lados
  { home: 'E', away: 'F', status: 'TIMED', score_home: null, score_away: null },
]

const { home, away } = buildHomeAwaySplits(matches)

const find = (rows: ReturnType<typeof buildHomeAwaySplits>['home'], team: string) =>
  rows.find((row) => row.team === team)

// A em casa: V 2-0, E 1-1, D 0-3 -> 4 pts, 3 GF, 4 GA
const aHome = find(home, 'A')
assert.ok(aHome)
assert.equal(aHome?.played, 3)
assert.equal(aHome?.pts, 4)
assert.equal(aHome?.wins, 1)
assert.equal(aHome?.draws, 1)
assert.equal(aHome?.losses, 1)
assert.equal(aHome?.goalsFor, 3)
assert.equal(aHome?.goalsAgainst, 4)

// A fora: D 0-1, E 1-1, E 1-1 -> 2 pts
const aAway = find(away, 'A')
assert.ok(aAway)
assert.equal(aAway?.played, 3)
assert.equal(aAway?.pts, 2)
assert.equal(aAway?.goalsFor, 2)
assert.equal(aAway?.goalsAgainst, 3)

// B so tem jogos fora (2), nenhum em casa
assert.equal(find(home, 'B')?.played, 1)
assert.equal(find(away, 'B')?.played, 2)
assert.equal(find(away, 'B')?.pts, 0)

// D fora: venceu 3-0
assert.equal(find(away, 'D')?.pts, 3)
assert.equal(find(away, 'D')?.goalsFor, 3)

// Ranking do split de casa: C (4 pts, saldo +1) na frente de A (4 pts, saldo -1)
assert.equal(home[0]?.team, 'C')
assert.equal(home[1]?.team, 'A')
assert.equal(home[0]?.pos, 1)

// Time que nao jogou (agendado) nao aparece
assert.equal(find(home, 'E'), undefined)
assert.equal(find(away, 'F'), undefined)

// Integracao: e isso que tirava o "—" do painel. Antes home/away vinham vazios
// e o homePpg ficava null; agora o split alimenta o mando. A conversao pts ->
// points tem que ser a mesma do componente (LeagueIntel.toSide) — e exatamente
// nessa costura que o split quebra se alguem trocar o nome do campo.
const toSide = (row: SplitRow): TableSide => ({
  team: row.team,
  crest: row.crest,
  pos: row.pos,
  played: row.played,
  points: row.pts,
  goalsFor: row.goalsFor,
  goalsAgainst: row.goalsAgainst,
  form: row.form,
})

const total: TableSide[] = [
  { team: 'A', played: 6, points: 6, goalsFor: 5, goalsAgainst: 7 },
  { team: 'B', played: 3, points: 1, goalsFor: 2, goalsAgainst: 5 },
  { team: 'C', played: 3, points: 5, goalsFor: 4, goalsAgainst: 3 },
  { team: 'D', played: 2, points: 6, goalsFor: 4, goalsAgainst: 0 },
]

const intel = buildLeagueIntel(total, home.map(toSide), away.map(toSide))
const a = intel.teams.find((team) => team.team === 'A')
assert.ok(a)
assert.equal(a?.homePpg, 1.33)
assert.equal(a?.awayPpg, 0.67)
assert.equal(a?.homeBias, 0.66)

// Com menos de 3 jogos no split o ppg fica null (nao inventa media de 1 jogo)
const c = intel.teams.find((team) => team.team === 'C')
assert.equal(c?.homePpg, null)
assert.equal(c?.awayPpg, null)

// O lider de "Fortaleza" agora existe: antes era sempre null
assert.equal(intel.leaders.homeBias?.team, 'A')

// Nomes diferentes para o mesmo time: o split casa pelo id e assume o nome
// canonico da tabela. Sem isso o Athletico Paranaense fica sem casa/fora no
// painel (a tabela usa o nome longo, o scoreboard usa "Athletico-PR").
const comIds: SplitInput[] = [
  { home: 'Athletico-PR', away: 'X', home_id: '3458', away_id: '900', status: 'FINISHED', score_home: 2, score_away: 0 },
  { home: 'Athletico-PR', away: 'X', home_id: '3458', away_id: '900', status: 'FINISHED', score_home: 1, score_away: 1 },
  { home: 'Athletico-PR', away: 'X', home_id: '3458', away_id: '900', status: 'FINISHED', score_home: 3, score_away: 0 },
]

const splitIds = buildHomeAwaySplits(comIds)
assert.equal(splitIds.home.length, 1)
assert.equal(splitIds.home[0]?.team, 'Athletico-PR')
assert.equal(splitIds.home[0]?.pts, 7)
assert.equal(splitIds.home[0]?.espn_id, '3458')

const alinhado = alignSplitRows(splitIds.home, [
  { team: 'Athletico Paranaense', crest: 'crest-3458', espn_id: '3458' },
])
assert.equal(alinhado[0]?.team, 'Athletico Paranaense')
assert.equal(alinhado[0]?.crest, 'crest-3458')
assert.equal(alinhado[0]?.pts, 7)

// Sem id correspondente, a linha fica como veio (nao some nem inventa nome)
const semPar = alignSplitRows(splitIds.home, [{ team: 'Outro', espn_id: '999' }])
assert.equal(semPar[0]?.team, 'Athletico-PR')

// Janela da temporada: o endpoint devolve o ANO-calendario inteiro, que na
// Europa carrega dois campeonatos. Limitando pelos jogos que a classificacao
// contabiliza, o split volta a falar so da temporada atual.
const duasTemporadas: SplitInput[] = [
  { home: 'T', away: 'U', home_id: '1', away_id: '2', date: '2026-03-01T00:00Z', status: 'FINISHED', score_home: 9, score_away: 0 },
  { home: 'T', away: 'U', home_id: '1', away_id: '2', date: '2026-09-01T00:00Z', status: 'FINISHED', score_home: 1, score_away: 0 },
  { home: 'T', away: 'U', home_id: '1', away_id: '2', date: '2026-09-08T00:00Z', status: 'FINISHED', score_home: 2, score_away: 0 },
]

const semJanela = buildHomeAwaySplits(duasTemporadas)
assert.equal(semJanela.home[0]?.played, 3)
assert.equal(semJanela.home[0]?.goalsFor, 12)

const comJanela = buildHomeAwaySplits(duasTemporadas, { '1': 2, '2': 2 })
assert.equal(comJanela.home[0]?.played, 2)
assert.equal(comJanela.home[0]?.goalsFor, 3)
assert.equal(comJanela.home[0]?.pts, 6)

// Rede de seguranca: casa+fora tem que somar a tabela, senao o split nao vai
// para a tela. Foi essa checagem que exporia a divergencia de duas temporadas.
assert.equal(splitsReconcile(home, away, total), true)
assert.equal(splitsReconcile(home, away, [{ team: 'A', played: 7 }]), false)
assert.equal(splitsReconcile(home, away, [{ team: 'Fantasma', played: 6 }]), false)

console.log('splits tests ok')
