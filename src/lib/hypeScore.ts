/**
 * Corte de entrada no board.
 *
 * Calibrado com `npm run backtest` (1.440 jogos, ajuste/validacao por liga):
 * subir de 28 para 44 leva a taxa de acerto de ~50% para ~59% na validacao, com
 * card em ~30% dos jogos — o suficiente para encher um painel de 12 em uma
 * rodada de 36 jogos. O criterio foi "maior acerto mantendo >=28% de cobertura";
 * 48 acerta mais (61,6%) mas cai para 24% de cobertura.
 */
export const MIN_HYPE_SCORE = 44
export const MAX_HYPE_FLAGS = 12

/**
 * Pesos do score, isolados para poderem ser calibrados contra resultado real.
 * Os valores aqui sao o default do produto; o backtest varre variacoes em cima
 * do MESMO codigo, em vez de reimplementar a conta.
 */
export interface HypeWeights {
  formWin: number
  formDraw: number
  positionFirst: number
  positionSecond: number
  positionThird: number
  positionTop6: number
  balanceHigh: number
  balanceMid: number
  classic: number
  live: number
  playing: number
}

export const DEFAULT_HYPE_WEIGHTS: HypeWeights = {
  formWin: 7,
  formDraw: 3,
  positionFirst: 24,
  positionSecond: 18,
  positionThird: 14,
  positionTop6: 8,
  balanceHigh: 8,
  balanceMid: 4,
  classic: 18,
  live: 14,
  playing: 8,
}

export interface HypeOptions {
  /** Corte de entrada. Default: MIN_HYPE_SCORE. */
  minScore?: number
  weights?: Partial<HypeWeights>
}

function resolveOptions(options?: HypeOptions): { minScore: number; weights: HypeWeights } {
  return {
    minScore: options?.minScore ?? MIN_HYPE_SCORE,
    weights: { ...DEFAULT_HYPE_WEIGHTS, ...(options?.weights ?? {}) },
  }
}

export interface DayStats {
  totalMatches: number
  liveMatches: number
  finishedMatches: number
  scheduledMatches: number
  totalGoals: number
  avgGoals: number
  leaguesActive: number
}

export interface HypeTableRow {
  team: string
  crest?: string | null
  pos: number
  played?: number
  form?: string | null
  goalDifference?: number
}

export interface HypeFixture {
  league_id: string
  league_name: string
  home: string
  home_crest?: string | null
  home_position?: number | null
  away: string
  away_crest?: string | null
  away_position?: number | null
  time_local?: string
  status: string
}

export interface HypeBoardItem {
  team: string
  reason: string
  priority: number
  crest: string | null
  position: number | null
  league_id: string
  league_name: string
  score: number
  signals: string[]
  form: Array<'W' | 'D' | 'L'>
  opponent: string | null
  match_status: string | null
  time_local: string | null
}

const INACTIVE = new Set(['POSTPONED', 'CANCELLED', 'SUSPENDED'])

const CLUB_ALIASES: Record<string, string[]> = {
  flamengo: ['flamengo'],
  fluminense: ['fluminense'],
  vasco: ['vasco'],
  botafogo: ['botafogo'],
  palmeiras: ['palmeiras'],
  corinthians: ['corinthians'],
  'sao paulo': ['sao paulo'],
  santos: ['santos'],
  gremio: ['gremio'],
  internacional: ['internacional'],
  'atletico mineiro': ['atletico mineiro'],
  cruzeiro: ['cruzeiro'],
  bahia: ['bahia'],
  vitoria: ['vitoria'],
  barcelona: ['barcelona'],
  'real madrid': ['real madrid'],
  'atletico madrid': ['atletico madrid', 'atletico de madrid'],
  'manchester united': ['manchester united'],
  'manchester city': ['manchester city'],
  liverpool: ['liverpool'],
  everton: ['everton'],
  arsenal: ['arsenal'],
  tottenham: ['tottenham'],
  milan: ['milan'],
  inter: ['inter', 'internazionale'],
  juventus: ['juventus'],
  roma: ['roma'],
  lazio: ['lazio'],
  dortmund: ['dortmund'],
  bayern: ['bayern'],
  psg: ['psg', 'paris saint germain', 'paris sg'],
  marseille: ['marseille'],
  benfica: ['benfica'],
  porto: ['porto'],
  sporting: ['sporting'],
  ajax: ['ajax'],
  feyenoord: ['feyenoord'],
}

const RIVALRIES: Array<[string, string]> = [
  ['flamengo', 'fluminense'],
  ['flamengo', 'vasco'],
  ['flamengo', 'botafogo'],
  ['flamengo', 'palmeiras'],
  ['palmeiras', 'corinthians'],
  ['palmeiras', 'sao paulo'],
  ['palmeiras', 'santos'],
  ['corinthians', 'sao paulo'],
  ['corinthians', 'santos'],
  ['gremio', 'internacional'],
  ['atletico mineiro', 'cruzeiro'],
  ['bahia', 'vitoria'],
  ['barcelona', 'real madrid'],
  ['atletico madrid', 'real madrid'],
  ['manchester united', 'manchester city'],
  ['manchester united', 'liverpool'],
  ['liverpool', 'everton'],
  ['arsenal', 'tottenham'],
  ['milan', 'inter'],
  ['juventus', 'inter'],
  ['roma', 'lazio'],
  ['dortmund', 'bayern'],
  ['psg', 'marseille'],
  ['benfica', 'porto'],
  ['benfica', 'sporting'],
  ['porto', 'sporting'],
  ['ajax', 'feyenoord'],
]

export function normalizeClubName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function matchesClub(name: string, clubKey: string): boolean {
  const norm = normalizeClubName(name)
  const aliases = CLUB_ALIASES[clubKey] || [clubKey]
  return aliases.some((alias) => {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')
    return new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`).test(norm)
  })
}

export function isClassicMatch(home: string, away: string): boolean {
  return RIVALRIES.some(([a, b]) =>
    (matchesClub(home, a) && matchesClub(away, b)) ||
    (matchesClub(home, b) && matchesClub(away, a))
  )
}

export function parseForm(form: string | null | undefined): Array<'W' | 'D' | 'L'> {
  if (!form) return []
  const letters = form.toUpperCase().match(/[WDL]/g) || []
  return letters.slice(-5) as Array<'W' | 'D' | 'L'>
}

function formPoints(letters: Array<'W' | 'D' | 'L'>, weights: HypeWeights): number {
  return letters.reduce(
    (sum, letter) => sum + (letter === 'W' ? weights.formWin : letter === 'D' ? weights.formDraw : 0),
    0
  )
}

function positionPoints(position: number | null, weights: HypeWeights): number {
  if (!position || position < 1) return 0
  if (position === 1) return weights.positionFirst
  if (position === 2) return weights.positionSecond
  if (position === 3) return weights.positionThird
  if (position <= 6) return weights.positionTop6
  return 0
}

function goalDifferencePoints(
  goalDifference: number,
  played: number,
  weights: HypeWeights
): number {
  if (!played || played < 1) return 0
  const perGame = goalDifference / played
  if (perGame >= 1) return weights.balanceHigh
  if (perGame >= 0.5) return weights.balanceMid
  return 0
}

interface Draft {
  team: string
  crest: string | null
  position: number | null
  league_id: string
  league_name: string
  opponent: string | null
  match_status: string | null
  time_local: string | null
  played: number
  formRaw: string | null
  goalDifference: number
  isLive: boolean
  isActiveFixture: boolean
  isClassic: boolean
}

function rowFor(table: HypeTableRow[] | undefined, team: string): HypeTableRow | undefined {
  return table?.find((row) => row.team === team)
}

function scoreDraft(draft: Draft, options: { minScore: number; weights: HypeWeights }): HypeBoardItem | null {
  const { weights } = options
  const letters = parseForm(draft.formRaw)
  const shape = formPoints(letters, weights)
  const table = positionPoints(draft.position, weights)
  const playing = draft.isActiveFixture ? weights.playing : 0
  const live = draft.isLive ? weights.live : 0
  const classic = draft.isClassic ? weights.classic : 0
  const balance = goalDifferencePoints(draft.goalDifference, draft.played, weights)
  const score = Math.min(100, shape + table + playing + live + classic + balance)
  if (score < options.minScore) return null

  const signals: Array<{ label: string; points: number }> = []
  if (classic > 0) signals.push({ label: 'Clássico', points: classic })
  if (live > 0) signals.push({ label: 'Ao vivo', points: live })
  if (draft.position === 1) signals.push({ label: 'Líder', points: table })
  else if (draft.position != null && draft.position <= 3) signals.push({ label: 'Top 3', points: table })
  else if (table > 0) signals.push({ label: 'Zona alta', points: table })
  if (shape >= 21) {
    const wins = letters.filter((letter) => letter === 'W').length
    signals.push({ label: wins >= 4 ? `Forma ${wins}V` : 'Boa forma', points: shape })
  }
  if (balance > 0) signals.push({ label: 'Saldo alto', points: balance })

  signals.sort((a, b) => b.points - a.points)
  const pinned = signals.filter((signal) => signal.label === 'Clássico' || signal.label === 'Ao vivo')
  const rest = signals.filter((signal) => signal.label !== 'Clássico' && signal.label !== 'Ao vivo')
  const labels = [...pinned, ...rest].slice(0, 3).map((signal) => signal.label)
  const priority = score >= 70 ? 1 : score >= 50 ? 2 : draft.isClassic ? 4 : 3

  return {
    team: draft.team,
    reason: labels.slice(0, 2).join(' · ') || 'Em alta',
    priority,
    crest: draft.crest,
    position: draft.position,
    league_id: draft.league_id,
    league_name: draft.league_name,
    score,
    signals: labels,
    form: letters,
    opponent: draft.opponent,
    match_status: draft.match_status,
    time_local: draft.time_local,
  }
}

function keepBetter(current: HypeBoardItem | undefined, next: HypeBoardItem): HypeBoardItem {
  if (!current) return next
  if (next.score !== current.score) return next.score > current.score ? next : current
  if (Boolean(next.opponent) !== Boolean(current.opponent)) return next.opponent ? next : current
  return current
}

export function buildHypeBoard(
  matches: HypeFixture[],
  standingsMap: Record<string, HypeTableRow[]>,
  leagueNames: Record<string, string> = {},
  options?: HypeOptions
): HypeBoardItem[] {
  const resolved = resolveOptions(options)
  const ranked = new Map<string, HypeBoardItem>()

  const consider = (draft: Draft) => {
    const item = scoreDraft(draft, resolved)
    if (!item) return
    ranked.set(item.team, keepBetter(ranked.get(item.team), item))
  }

  for (const match of matches) {
    const table = standingsMap[match.league_id]
    const classic = isClassicMatch(match.home, match.away)
    const live = match.status === 'IN_PLAY' || match.status === 'PAUSED'
    const active = !INACTIVE.has(match.status)
    const sides = [
      {
        team: match.home,
        crest: match.home_crest || null,
        position: match.home_position ?? null,
        opponent: match.away,
      },
      {
        team: match.away,
        crest: match.away_crest || null,
        position: match.away_position ?? null,
        opponent: match.home,
      },
    ]

    for (const side of sides) {
      const row = rowFor(table, side.team)
      consider({
        team: side.team,
        crest: side.crest || row?.crest || null,
        position: row?.pos ?? side.position,
        league_id: match.league_id,
        league_name: match.league_name,
        opponent: side.opponent,
        match_status: match.status,
        time_local: match.time_local || null,
        played: row?.played || 0,
        formRaw: row?.form || null,
        goalDifference: row?.goalDifference || 0,
        isLive: live,
        isActiveFixture: active,
        isClassic: classic,
      })
    }
  }

  for (const leagueId of Object.keys(standingsMap)) {
    const table = standingsMap[leagueId]
    if (!table?.length) continue
    for (const row of table.slice(0, 3)) {
      if (ranked.has(row.team)) continue
      consider({
        team: row.team,
        crest: row.crest || null,
        position: row.pos,
        league_id: leagueId,
        league_name: leagueNames[leagueId] || leagueId,
        opponent: null,
        match_status: null,
        time_local: null,
        played: row.played || 0,
        formRaw: row.form || null,
        goalDifference: row.goalDifference || 0,
        isLive: false,
        isActiveFixture: false,
        isClassic: false,
      })
    }
  }

  return Array.from(ranked.values())
    .sort((a, b) => b.score - a.score || (a.position ?? 99) - (b.position ?? 99) || a.team.localeCompare(b.team))
    .slice(0, MAX_HYPE_FLAGS)
}

export function computeDayStats(matches: Array<{
  status: string
  score_home: number | null
  score_away: number | null
  league_id: string
}>): DayStats {
  const live = matches.filter((match) => match.status === 'IN_PLAY' || match.status === 'PAUSED')
  const finished = matches.filter((match) => match.status === 'FINISHED')
  const scheduled = matches.filter((match) => match.status === 'TIMED' || match.status === 'SCHEDULED')
  const scored = matches.filter((match) =>
    (match.status === 'FINISHED' || match.status === 'IN_PLAY' || match.status === 'PAUSED') &&
    match.score_home != null &&
    match.score_away != null
  )
  const totalGoals = scored.reduce((sum, match) => sum + (match.score_home ?? 0) + (match.score_away ?? 0), 0)
  const leagues = new Set(matches.map((match) => match.league_id))

  return {
    totalMatches: matches.length,
    liveMatches: live.length,
    finishedMatches: finished.length,
    scheduledMatches: scheduled.length,
    totalGoals,
    avgGoals: scored.length > 0 ? Math.round((totalGoals / scored.length) * 10) / 10 : 0,
    leaguesActive: leagues.size,
  }
}
