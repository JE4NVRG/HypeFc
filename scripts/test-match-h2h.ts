import assert from 'node:assert/strict'
import {
  buildH2H,
  buildTeamForm,
  buildVenueSplit,
  type H2HMatch,
} from '../src/lib/matchH2H.ts'

// ---------------------------------------------------------------------------
// Dataset base: A x B (7 jogos validos, sendo 1 sem data) + A x C + 2 jogos que
// NAO podem entrar (agendado e FINISHED com placar null).
// ---------------------------------------------------------------------------

const played = (
  date: string | null,
  home: string,
  away: string,
  score_home: number,
  score_away: number
): H2HMatch => ({ date, home, away, status: 'FINISHED', score_home, score_away })

const matches: H2HMatch[] = [
  played('2026-01-10', 'A', 'B', 2, 0),
  played('2026-03-05', 'B', 'A', 1, 1),
  played('2026-05-20', 'A', 'B', 0, 3),
  played('2026-07-01', 'B', 'A', 2, 2),
  played('2026-08-15', 'A', 'B', 1, 0),
  played('2026-09-01', 'A', 'B', 3, 1),
  played('2026-09-10', 'A', 'C', 4, 0), // adversario diferente: nao e H2H de A x B
  // agendado: status errado
  { date: '2026-10-01', home: 'A', away: 'B', status: 'TIMED', score_home: null, score_away: null },
  // FINISHED mas sem placar: tambem nao conta
  { date: '2026-09-20', home: 'A', away: 'B', status: 'FINISHED', score_home: null, score_away: null },
  // sem data: conta, mas vai para o fim da ordenacao
  { home: 'B', away: 'A', status: 'FINISHED', score_home: 5, score_away: 0 },
]

let checks = 0
function ok(label: string, fn: () => void): void {
  fn()
  checks += 1
  console.log(`ok ${checks}. ${label}`)
}

// ---------------------------------------------------------------------------
// buildH2H
// ---------------------------------------------------------------------------

ok('H2H ordena desc e corta no limit default (5)', () => {
  const meetings = buildH2H(matches, 'A', 'B')
  assert.equal(meetings.length, 5)
  assert.deepEqual(
    meetings.map((meeting) => meeting.date),
    ['2026-09-01', '2026-08-15', '2026-07-01', '2026-05-20', '2026-03-05']
  )
  // o mais antigo (2026-01-10) fica de fora pelo limite
  assert.equal(meetings.some((meeting) => meeting.date === '2026-01-10'), false)
})

ok('H2H respeita o limit explicito', () => {
  const duas = buildH2H(matches, 'A', 'B', 2)
  assert.equal(duas.length, 2)
  assert.deepEqual(
    duas.map((meeting) => meeting.date),
    ['2026-09-01', '2026-08-15']
  )
  assert.equal(duas[0]?.score_home, 3)
  assert.equal(duas[0]?.score_away, 1)
})

ok('H2H ignora jogo nao-FINISHED e jogo sem placar', () => {
  const todos = buildH2H(matches, 'A', 'B', 20)
  assert.equal(todos.length, 7)
  assert.equal(todos.some((meeting) => meeting.date === '2026-10-01'), false)
  assert.equal(todos.some((meeting) => meeting.date === '2026-09-20'), false)
})

ok('H2H marca vencedor, inclusive empate e vitoria do visitante', () => {
  const todos = buildH2H(matches, 'A', 'B', 20)
  const porData = new Map(todos.map((meeting) => [meeting.date, meeting]))

  // A 3x1 B em casa
  assert.equal(porData.get('2026-09-01')?.winner, 'home')
  // A 0x3 B: quem ganha e o visitante
  assert.equal(porData.get('2026-05-20')?.winner, 'away')
  assert.equal(porData.get('2026-05-20')?.home, 'A')
  assert.equal(porData.get('2026-05-20')?.away, 'B')
  // 1x1 e 2x2
  assert.equal(porData.get('2026-03-05')?.winner, 'draw')
  assert.equal(porData.get('2026-07-01')?.winner, 'draw')
  // confronto com mando invertido entra igual
  assert.equal(porData.get('2026-07-01')?.home, 'B')
  assert.equal(porData.get('2026-07-01')?.away, 'A')
})

ok('H2H: jogo sem data vai para o fim da ordenacao', () => {
  const todos = buildH2H(matches, 'A', 'B', 20)
  const ultimo = todos[todos.length - 1]
  assert.equal(ultimo?.date, null)
  assert.equal(ultimo?.score_home, 5)
  assert.equal(ultimo?.score_away, 0)
  assert.equal(ultimo?.winner, 'home')
})

ok('H2H: times que nunca se enfrentaram devolvem array vazio', () => {
  assert.deepEqual(buildH2H(matches, 'A', 'Z'), [])
  assert.deepEqual(buildH2H([], 'A', 'B'), [])
})

// ---------------------------------------------------------------------------
// buildTeamForm
// ---------------------------------------------------------------------------

ok('form: ordena desc, corta no default (5) e da W/D/L do ponto de vista do time', () => {
  const form = buildTeamForm(matches, 'A')
  assert.equal(form.length, 5)
  assert.deepEqual(
    form.map((game) => game.date),
    ['2026-09-10', '2026-09-01', '2026-08-15', '2026-07-01', '2026-05-20']
  )
  assert.deepEqual(
    form.map((game) => game.result),
    ['W', 'W', 'W', 'D', 'L']
  )
  // A jogou 4-0 em casa contra C
  assert.equal(form[0]?.opponent, 'C')
  assert.equal(form[0]?.home, true)
  assert.equal(form[0]?.goals_for, 4)
  assert.equal(form[0]?.goals_against, 0)
  // 2x2 fora de casa contra B: empate, gols invertidos pelo mando
  assert.equal(form[3]?.opponent, 'B')
  assert.equal(form[3]?.home, false)
  assert.equal(form[3]?.goals_for, 2)
  assert.equal(form[3]?.goals_against, 2)
  // 0x3 em casa: derrota
  assert.equal(form[4]?.home, true)
  assert.equal(form[4]?.goals_for, 0)
  assert.equal(form[4]?.goals_against, 3)
})

ok('form: respeita o limit e o jogo sem data vai para o fim', () => {
  const duas = buildTeamForm(matches, 'A', 2)
  assert.equal(duas.length, 2)
  assert.deepEqual(
    duas.map((game) => game.date),
    ['2026-09-10', '2026-09-01']
  )

  const tudo = buildTeamForm(matches, 'A', 8)
  assert.equal(tudo.length, 8)
  const ultimo = tudo[tudo.length - 1]
  assert.equal(ultimo?.date, null)
  assert.equal(ultimo?.opponent, 'B')
  assert.equal(ultimo?.home, false)
  assert.equal(ultimo?.result, 'L') // B 5x0 A
  assert.equal(ultimo?.goals_for, 0)
  assert.equal(ultimo?.goals_against, 5)
})

ok('form: nao conta jogo nao-FINISHED/sem placar nem outro time', () => {
  const form = buildTeamForm(matches, 'A', 20)
  assert.equal(form.length, 8)
  assert.equal(form.some((game) => game.date === '2026-10-01'), false)
  assert.equal(form.some((game) => game.date === '2026-09-20'), false)

  // B: 7 jogos validos contra A (inclui o sem data) e nada mais
  const formB = buildTeamForm(matches, 'B', 20)
  assert.equal(formB.length, 7)
  assert.equal(formB.every((game) => game.opponent === 'A'), true)
  assert.equal(formB[0]?.date, '2026-09-01')
  assert.equal(formB[0]?.home, false)
  assert.equal(formB[0]?.result, 'L')
})

ok('form: time sem jogos devolve array vazio', () => {
  assert.deepEqual(buildTeamForm(matches, 'Z'), [])
})

// ---------------------------------------------------------------------------
// buildVenueSplit
// ---------------------------------------------------------------------------

ok('split: sempre as duas linhas, na ordem home/away', () => {
  const split = buildVenueSplit(matches, 'A')
  assert.equal(split.length, 2)
  assert.equal(split[0]?.venue, 'home')
  assert.equal(split[1]?.venue, 'away')
  assert.equal(split[0]?.team, 'A')
  assert.equal(split[1]?.team, 'A')
})

ok('split de casa: 4V 0E 1D, 10 GP 4 GC, 2.4 pgg', () => {
  const casa = buildVenueSplit(matches, 'A')[0]
  assert.equal(casa?.played, 5)
  assert.equal(casa?.wins, 4)
  assert.equal(casa?.draws, 0)
  assert.equal(casa?.losses, 1)
  assert.equal(casa?.goals_for, 10)
  assert.equal(casa?.goals_against, 4)
  assert.equal(casa?.points_per_game, 2.4)
})

ok('split fora: 0V 2E 1D, 3 GP 8 GC, 0.67 pgg (inclui o jogo sem data)', () => {
  const fora = buildVenueSplit(matches, 'A')[1]
  assert.equal(fora?.played, 3)
  assert.equal(fora?.wins, 0)
  assert.equal(fora?.draws, 2)
  assert.equal(fora?.losses, 1)
  assert.equal(fora?.goals_for, 3)
  assert.equal(fora?.goals_against, 8)
  assert.equal(fora?.points_per_game, 0.67)
})

ok('split: mando sem jogos volta zerado, ppg 0 (sem dividir por zero)', () => {
  // C so jogou fora (em A)
  const splitC = buildVenueSplit(matches, 'C')
  assert.equal(splitC.length, 2)
  assert.equal(splitC[0]?.venue, 'home')
  assert.equal(splitC[0]?.played, 0)
  assert.equal(splitC[0]?.wins, 0)
  assert.equal(splitC[0]?.draws, 0)
  assert.equal(splitC[0]?.losses, 0)
  assert.equal(splitC[0]?.goals_for, 0)
  assert.equal(splitC[0]?.goals_against, 0)
  assert.equal(splitC[0]?.points_per_game, 0)

  assert.equal(splitC[1]?.played, 1)
  assert.equal(splitC[1]?.losses, 1)
  assert.equal(splitC[1]?.goals_for, 0)
  assert.equal(splitC[1]?.goals_against, 4)
  assert.equal(splitC[1]?.points_per_game, 0)
})

ok('split: time que nao jogou devolve as duas linhas zeradas', () => {
  const splitZ = buildVenueSplit(matches, 'Z')
  assert.equal(splitZ.length, 2)
  assert.deepEqual(splitZ, [
    {
      team: 'Z',
      venue: 'home',
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goals_for: 0,
      goals_against: 0,
      points_per_game: 0,
    },
    {
      team: 'Z',
      venue: 'away',
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goals_for: 0,
      goals_against: 0,
      points_per_game: 0,
    },
  ])
})

ok('split: ppg arredonda a 2 casas', () => {
  const tres: H2HMatch[] = [
    played('2026-01-01', 'D', 'X', 1, 0),
    played('2026-01-08', 'D', 'X', 1, 1),
    played('2026-01-15', 'D', 'X', 0, 1),
  ]
  // 4 pts em 3 jogos = 1.333... -> 1.33
  assert.equal(buildVenueSplit(tres, 'D')[0]?.points_per_game, 1.33)
  assert.equal(buildVenueSplit(tres, 'D')[0]?.played, 3)
  assert.equal(buildVenueSplit(tres, 'D')[1]?.points_per_game, 0)
})

console.log(`\nmatch-h2h tests ok (${checks} blocos, tudo verde)`)
