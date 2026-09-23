/**
 * Tabelas por mando (casa/fora).
 *
 * A tabela geral da ESPN nao traz split de mando, entao ele e reconstruido dos
 * jogos ja encerrados — a mesma lacuna que deixava as colunas CASA/FORA e o
 * card "Fortaleza" em "—".
 *
 * Dois cuidados que a pratica exigiu:
 *
 * 1. **Janela da temporada.** O endpoint aceita o ANO em `dates`, nao a
 *    temporada. Na Europa isso devolve dois campeonatos no mesmo calendario
 *    (2025-26 + 2026-27), o que inflava o split. Por isso cada time e limitado
 *    aos seus `played` jogos mais recentes, que e exatamente o que a tabela
 *    mostra — assim o split reconcilia com a classificacao por construcao.
 * 2. **Identidade do time.** A tabela e o scoreboard nomeiam o mesmo clube de
 *    formas diferentes (Athletico Paranaense vs Athletico-PR, id 3458). O
 *    acumulador e chaveado pelo id.
 */

export interface SplitInput {
  home: string
  away: string
  home_id?: string | null
  away_id?: string | null
  status: string
  score_home: number | null
  score_away: number | null
  /** ISO do inicio. Necessario para escolher os jogos mais recentes. */
  date?: string | null
}

export interface SplitRow {
  pos: number
  team: string
  crest: string
  espn_id?: string
  pts: number
  played: number
  wins: number
  draws: number
  losses: number
  form: string | null
  goalDifference: number
  goalsFor: number
  goalsAgainst: number
}

interface Accumulator {
  espnId: string
  team: string
  played: number
  pts: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
}

interface SidedMatch {
  key: string
  team: string
  espnId: string
  date: string
  venue: 'home' | 'away'
  scored: number
  conceded: number
}

function accumulate(sided: SidedMatch[]): Accumulator[] {
  const map = new Map<string, Accumulator>()

  for (const match of sided) {
    const row =
      map.get(match.key) ??
      ({
        espnId: match.espnId,
        team: match.team,
        played: 0,
        pts: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
      } satisfies Accumulator)

    row.played += 1
    row.goalsFor += match.scored
    row.goalsAgainst += match.conceded
    if (match.scored > match.conceded) {
      row.wins += 1
      row.pts += 3
    } else if (match.scored === match.conceded) {
      row.draws += 1
      row.pts += 1
    } else {
      row.losses += 1
    }
    map.set(match.key, row)
  }

  return Array.from(map.values())
}

/** Ranking por pontos, saldo e gols pro — mesmo criterio da tabela geral. */
function rank(rows: Accumulator[]): SplitRow[] {
  const sorted = [...rows].sort(
    (a, b) =>
      b.pts - a.pts ||
      b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) ||
      b.goalsFor - a.goalsFor ||
      a.team.localeCompare(b.team)
  )

  return sorted.map((row, index) => ({
    pos: index + 1,
    team: row.team,
    crest: '',
    espn_id: row.espnId || undefined,
    pts: row.pts,
    played: row.played,
    wins: row.wins,
    draws: row.draws,
    losses: row.losses,
    // Forma por mando exigiria a mesma janela por data; o painel nao exibe esse
    // campo, entao fica nulo em vez de ser chutado.
    form: null,
    goalDifference: row.goalsFor - row.goalsAgainst,
    goalsFor: row.goalsFor,
    goalsAgainst: row.goalsAgainst,
  }))
}

/**
 * Corta cada time nos `played` jogos mais recentes — casa e fora JUNTOS, nao um
 * limite por lado. Limitar por lado (5 jogos em casa + 5 fora com a tabela
 * marcando 5) foi justamente o erro que apareceu na Premier League.
 */
function recentOnly(sided: SidedMatch[], playedByTeam?: Record<string, number>): SidedMatch[] {
  if (!playedByTeam) return sided

  const byTeam = new Map<string, SidedMatch[]>()
  for (const match of sided) {
    const list = byTeam.get(match.key)
    if (list) list.push(match)
    else byTeam.set(match.key, [match])
  }

  const out: SidedMatch[] = []
  for (const [key, list] of Array.from(byTeam.entries())) {
    const limit = playedByTeam[key]
    if (!limit) continue
    // Sem data o jogo vai para o fim da fila, entao sobra para os mais recentes.
    const ordered = [...list].sort((a, b) => b.date.localeCompare(a.date))
    out.push(...ordered.slice(0, limit))
  }
  return out
}

/**
 * So jogos encerrados com placar entram. Cada time ganha duas linhas: uma nos
 * jogos em que foi mandante e outra nos que foi visitante.
 *
 * `playedByTeam` deve vir da classificacao (chave = id do time quando houver),
 * para o split cobrir exatamente a mesma janela da tabela.
 */
export function buildHomeAwaySplits(
  matches: SplitInput[],
  playedByTeam?: Record<string, number>
): { home: SplitRow[]; away: SplitRow[] } {
  const all: SidedMatch[] = []

  for (const match of matches) {
    if (match.status !== 'FINISHED') continue
    if (match.score_home === null || match.score_away === null) continue

    const homeId = match.home_id || ''
    const awayId = match.away_id || ''
    const date = match.date || ''

    all.push({
      key: homeId || match.home,
      team: match.home,
      espnId: homeId,
      date,
      venue: 'home',
      scored: match.score_home,
      conceded: match.score_away,
    })
    all.push({
      key: awayId || match.away,
      team: match.away,
      espnId: awayId,
      date,
      venue: 'away',
      scored: match.score_away,
      conceded: match.score_home,
    })
  }

  // O corte e sobre a temporada do time inteira (casa + fora); so depois separa.
  const current = recentOnly(all, playedByTeam)

  return {
    home: rank(accumulate(current.filter((match) => match.venue === 'home'))),
    away: rank(accumulate(current.filter((match) => match.venue === 'away'))),
  }
}

export interface SplitAlignTarget {
  team: string
  crest?: string
  espn_id?: string
}

/**
 * O painel casa o split pelo nome do time. Como a tabela nem sempre usa o mesmo
 * nome do scoreboard, a linha do split recebe o nome canonico da tabela —
 * casado pelo id, que nao muda.
 */
export function alignSplitRows(rows: SplitRow[], table: SplitAlignTarget[]): SplitRow[] {
  const byId = new Map<string, SplitAlignTarget>()
  for (const row of table) {
    if (row.espn_id) byId.set(row.espn_id, row)
  }

  return rows.map((row) => {
    const target = row.espn_id ? byId.get(row.espn_id) : undefined
    if (!target) return row
    return { ...row, team: target.team, crest: target.crest ?? row.crest }
  })
}

export interface SplitReconcileTarget {
  team: string
  played: number
}

/**
 * Janela por time para o split: quantos jogos a classificacao ja contabiliza.
 * A chave e o id quando existe, para casar com o acumulador do split.
 */
export function playedWindow(
  table: Array<{ team: string; played: number; espn_id?: string }>
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const row of table) out[row.espn_id || row.team] = row.played
  return out
}

/**
 * Rede de seguranca: o split so pode ir para a tela se os jogos de casa e fora
 * somarem exatamente o que a classificacao mostra. Se a janela estiver errada
 * (temporada trocada, liga com formato esquisito), e melhor nao mostrar nada do
 * que mostrar numero errado — foi assim que a divergencia de duas temporadas na
 * Europa apareceu.
 */
export function splitsReconcile(
  home: SplitRow[],
  away: SplitRow[],
  table: SplitReconcileTarget[]
): boolean {
  const homeByTeam = new Map(home.map((row) => [row.team, row]))
  const awayByTeam = new Map(away.map((row) => [row.team, row]))

  for (const row of table) {
    const homeRow = homeByTeam.get(row.team)
    const awayRow = awayByTeam.get(row.team)
    if (!homeRow || !awayRow) return false
    if (homeRow.played + awayRow.played !== row.played) return false
  }

  return true
}
