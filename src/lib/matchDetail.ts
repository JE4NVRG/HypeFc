import type { MatchStatus } from '@/types'
import { parseMarketOdds, type MarketLine } from './marketOdds.ts'

/**
 * Detalhe de partida (endpoint summary da ESPN). O payload tem ~400KB e traria
 * boxscore, commentary, rosters, seasonseries, odds etc.; aqui so entra o que a
 * pagina de detalhe usa.
 *
 * Contrato publico: o componente de UI e escrito contra estes nomes, entao nada
 * de renomear campo (mesmo que o valor venha bruto da ESPN).
 */
export interface MatchDetailStat {
  key: string
  label: string
  home: number | null
  away: number | null
  unit: 'pct' | 'count'
}

export interface MatchDetailLineupPlayer {
  name: string
  number: string | null
  position: string | null
  starter: boolean
}

export interface MatchDetailRecentGame {
  date: string | null
  opponent: string
  home: boolean
  result: 'W' | 'D' | 'L' | null
  score: string | null
}

export interface MatchDetailTeamSide {
  team: string
  crest: string | null
  score: number | null
  stats: MatchDetailStat[]
  lineup: MatchDetailLineupPlayer[]
  lastFive: MatchDetailRecentGame[]
}

export interface MatchDetailEvent {
  minute: string | null
  type: string
  text: string
  team: string | null
}

export interface MatchDetailMeeting {
  date: string | null
  home: string
  away: string
  score_home: number | null
  score_away: number | null
  competition: string | null
}

export interface MatchDetail {
  event_id: string
  league_id: string
  league_name: string
  status: string
  kickoff: string | null
  venue: { name: string | null; city: string | null; country: string | null; attendance: number | null }
  referee: string | null
  home: MatchDetailTeamSide
  away: MatchDetailTeamSide
  meetings: MatchDetailMeeting[]
  events: MatchDetailEvent[]
  odds: Array<{ provider: string; detail: string }>
  /** Odd publicada convertida em probabilidade de mercado (fato da fonte). */
  market: MarketLine[]
  source: 'espn'
  captured_at: string
}

// --- Estruturas do payload (tudo opcional: campo ausente vira null/array vazio) ---

interface EspnTeamNode {
  id?: string
  displayName?: string
  name?: string
  logo?: string
  logos?: Array<{ href?: string }>
}

interface EspnStatNode {
  name?: string
  value?: number
  displayValue?: string
}

interface EspnCompetitor {
  homeAway?: string
  score?: string
  team?: EspnTeamNode
}

interface EspnBoxTeam {
  homeAway?: string
  displayOrder?: number
  team?: EspnTeamNode
  statistics?: EspnStatNode[]
}

interface EspnRosterPlayer {
  starter?: boolean
  jersey?: string
  athlete?: { displayName?: string; fullName?: string; shortName?: string }
  position?: { abbreviation?: string; name?: string }
}

interface EspnRosterBlock {
  homeAway?: string
  team?: EspnTeamNode
  roster?: EspnRosterPlayer[]
}

interface EspnRecentEvent {
  gameDate?: string
  atVs?: string
  score?: string
  homeTeamId?: string
  awayTeamId?: string
  homeTeamScore?: string
  awayTeamScore?: string
  gameResult?: string
  opponent?: { displayName?: string; name?: string }
}

interface EspnRecentBlock {
  homeAway?: string
  team?: EspnTeamNode
  events?: EspnRecentEvent[]
}

interface EspnSeriesEvent {
  date?: string
  competitionName?: string
  competitors?: Array<{ homeAway?: string; score?: string; team?: { displayName?: string; name?: string } }>
}

interface EspnSeriesBlock {
  events?: EspnSeriesEvent[]
}

interface EspnKeyEvent {
  type?: { text?: string; type?: string }
  text?: string
  shortText?: string
  clock?: { displayValue?: string }
  team?: { displayName?: string; name?: string }
}

interface EspnCommentaryItem {
  time?: { displayValue?: string }
  text?: string
}

interface EspnOddsBlock {
  provider?: { name?: string; id?: string | number }
  details?: string
}

interface EspnSummaryPayload {
  header?: {
    league?: { name?: string }
    competitions?: Array<{
      date?: string
      status?: { type?: { name?: string; state?: string } }
      competitors?: EspnCompetitor[]
    }>
  }
  boxscore?: { teams?: EspnBoxTeam[] }
  gameInfo?: {
    venue?: { fullName?: string; shortName?: string; address?: { city?: string; country?: string } }
    attendance?: number | string | null
    officials?: Array<{ fullName?: string; displayName?: string }>
  }
  rosters?: EspnRosterBlock[]
  lastFiveGames?: EspnRecentBlock[]
  seasonseries?: EspnSeriesBlock[]
  headToHead?: unknown
  keyEvents?: EspnKeyEvent[]
  commentary?: EspnCommentaryItem[]
  odds?: EspnOddsBlock[]
  pickcenter?: EspnOddsBlock[]
}

// --- Helpers de leitura ---

function str(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function num(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const text = str(value)
  if (text == null) return null
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : null
}

/** Escudo: o competitor so traz `logos[]`; o boxscore as vezes traz `logo`. */
function crestOf(team: EspnTeamNode | undefined): string | null {
  if (!team) return null
  return str(team.logo) || str(team.logos?.[0]?.href) || null
}

function teamName(team: EspnTeamNode | undefined): string {
  return str(team?.displayName) || str(team?.name) || ''
}

/**
 * Tabela local de status. Este modulo tambem roda no teste com node puro, que
 * nao resolve o alias @/; por isso nao da para importar mapEspnStatus do
 * espnParse (os valores sao os mesmos MatchStatus do resto do app).
 */
const STATUS_BY_NAME: Record<string, MatchStatus> = {
  STATUS_SCHEDULED: 'TIMED',
  STATUS_TIMED: 'TIMED',
  STATUS_IN_PROGRESS: 'IN_PLAY',
  STATUS_FIRST_HALF: 'IN_PLAY',
  STATUS_SECOND_HALF: 'IN_PLAY',
  STATUS_HALFTIME: 'PAUSED',
  STATUS_FULL_TIME: 'FINISHED',
  STATUS_FINAL: 'FINISHED',
  STATUS_POSTPONED: 'POSTPONED',
  STATUS_CANCELED: 'CANCELLED',
  STATUS_CANCELLED: 'CANCELLED',
  STATUS_SUSPENDED: 'SUSPENDED',
}

const STATUS_BY_STATE: Record<string, MatchStatus> = {
  pre: 'TIMED',
  in: 'IN_PLAY',
  post: 'FINISHED',
}

function mapStatus(name: string | undefined, state: string | undefined): MatchStatus {
  if (name && STATUS_BY_NAME[name]) return STATUS_BY_NAME[name]
  if (state && STATUS_BY_STATE[state]) return STATUS_BY_STATE[state]
  return 'SCHEDULED'
}

const STAT_ROWS: Array<{ name: string; label: string; unit: 'pct' | 'count' }> = [
  { name: 'possessionPct', label: 'Posse de bola', unit: 'pct' },
  { name: 'totalShots', label: 'Chutes', unit: 'count' },
  { name: 'shotsOnTarget', label: 'No alvo', unit: 'count' },
  { name: 'wonCorners', label: 'Escanteios', unit: 'count' },
  { name: 'foulsCommitted', label: 'Faltas', unit: 'count' },
  { name: 'yellowCards', label: 'Amarelos', unit: 'count' },
  { name: 'redCards', label: 'Vermelhos', unit: 'count' },
  { name: 'saves', label: 'Defesas', unit: 'count' },
  { name: 'offsides', label: 'Impedimentos', unit: 'count' },
]

function statOf(stats: EspnStatNode[] | undefined, name: string): number | null {
  const item = (stats || []).find((stat) => stat.name === name)
  if (!item) return null
  return num(item.displayValue) ?? num(item.value)
}

/** Ordem fixa pedida pela UI; entra so a stat que a ESPN mandou em algum lado. */
function buildStats(home: EspnStatNode[] | undefined, away: EspnStatNode[] | undefined): MatchDetailStat[] {
  const rows: MatchDetailStat[] = []
  for (const row of STAT_ROWS) {
    const homeValue = statOf(home, row.name)
    const awayValue = statOf(away, row.name)
    if (homeValue == null && awayValue == null) continue
    rows.push({ key: row.name, label: row.label, home: homeValue, away: awayValue, unit: row.unit })
  }
  return rows
}

/**
 * Localiza o bloco (boxscore/roster/lastFiveGames) do lado pedido: primeiro pelo
 * id do time, senao pelo campo homeAway, e por ultimo a ordem, porque a ESPN
 * lista esses blocos na mesma ordem do header (casa primeiro).
 */
function pickSideBlock<T extends { team?: EspnTeamNode; homeAway?: string }>(
  list: T[] | undefined,
  competitor: EspnCompetitor | undefined,
  side: 'home' | 'away',
  index: number
): T | undefined {
  const items = list || []
  const id = str(competitor?.team?.id)
  if (id) {
    const byId = items.find((item) => str(item.team?.id) === id)
    if (byId) return byId
  }
  const bySide = items.find((item) => side === 'home' ? item.homeAway === 'home' : item.homeAway === 'away')
  if (bySide) return bySide
  return items[index]
}

function buildLineup(block: EspnRosterBlock | undefined): MatchDetailLineupPlayer[] {
  return (block?.roster || [])
    .map((player) => ({
      name: str(player.athlete?.displayName) || str(player.athlete?.fullName) || str(player.athlete?.shortName) || '',
      number: str(player.jersey),
      position: str(player.position?.abbreviation) || str(player.position?.name),
      starter: Boolean(player.starter),
    }))
    .filter((player) => player.name)
}

function buildRecent(block: EspnRecentBlock | undefined): MatchDetailRecentGame[] {
  const teamId = str(block?.team?.id)
  return (block?.events || []).map((event) => {
    const homeTeamId = str(event.homeTeamId)
    const result = str(event.gameResult)?.toUpperCase()
    const homeScore = num(event.homeTeamScore)
    const awayScore = num(event.awayTeamScore)
    return {
      date: str(event.gameDate),
      opponent: str(event.opponent?.displayName) || str(event.opponent?.name) || '',
      home: homeTeamId && teamId ? homeTeamId === teamId : str(event.atVs) === 'vs',
      result: result === 'W' || result === 'D' || result === 'L' ? result : null,
      score: str(event.score) || (homeScore != null && awayScore != null ? `${homeScore}-${awayScore}` : null),
    }
  })
}

function meetingsFromEvents(events: EspnSeriesEvent[] | undefined): MatchDetailMeeting[] {
  const out: MatchDetailMeeting[] = []
  for (const event of events || []) {
    const sides = event.competitors || []
    const homeSide = sides.find((side) => side.homeAway === 'home') || sides[0]
    const awaySide = sides.find((side) => side.homeAway === 'away') || sides[1]
    const home = teamName(homeSide?.team)
    const away = teamName(awaySide?.team)
    if (!home || !away) continue
    out.push({
      date: str(event.date),
      home,
      away,
      score_home: num(homeSide?.score),
      score_away: num(awaySide?.score),
      competition: str(event.competitionName),
    })
  }
  return out
}

/** seasonseries e o formato atual; headToHead veio null nesta liga e pode voltar. */
function buildMeetings(data: EspnSummaryPayload): MatchDetailMeeting[] {
  const series = Array.isArray(data.seasonseries) ? data.seasonseries : []
  const head = Array.isArray(data.headToHead)
    ? (data.headToHead as EspnSeriesBlock[])
    : data.headToHead && typeof data.headToHead === 'object'
      ? [data.headToHead as EspnSeriesBlock]
      : []

  const out: MatchDetailMeeting[] = []
  const seen = new Set<string>()
  for (const meeting of [...series, ...head].flatMap((block) => meetingsFromEvents(block?.events))) {
    const key = `${meeting.date}|${meeting.home}|${meeting.away}|${meeting.score_home}-${meeting.score_away}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(meeting)
  }
  return out
}

function buildEvents(data: EspnSummaryPayload): MatchDetailEvent[] {
  const key = (data.keyEvents || [])
    .map((event) => ({
      minute: str(event.clock?.displayValue),
      type: str(event.type?.text) || str(event.type?.type) || 'event',
      text: str(event.text) || str(event.shortText) || str(event.type?.text) || str(event.type?.type) || '',
      team: str(event.team?.displayName) || str(event.team?.name),
    }))
    .filter((event) => event.text)
  if (key.length) return key
  // Jogo que nao comecou nao tem keyEvents; o commentary ja cobre o pre-jogo.
  return (data.commentary || [])
    .map((item) => ({
      minute: str(item.time?.displayValue),
      type: 'commentary',
      text: str(item.text) || '',
      team: null,
    }))
    .filter((event) => event.text)
}

function buildOdds(data: EspnSummaryPayload): Array<{ provider: string; detail: string }> {
  const source = data.odds?.length ? data.odds : data.pickcenter || []
  const seen = new Set<string>()
  const out: Array<{ provider: string; detail: string }> = []
  for (const item of source) {
    const provider = str(item.provider?.name) || (item.provider?.id != null ? String(item.provider.id) : '')
    const detail = str(item.details) || ''
    if (!provider && !detail) continue
    const key = `${provider}|${detail}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ provider, detail })
  }
  return out
}

function buildSide(
  competitor: EspnCompetitor | undefined,
  boxTeam: EspnBoxTeam | undefined,
  started: boolean,
  lineup: MatchDetailLineupPlayer[],
  lastFive: MatchDetailRecentGame[]
): MatchDetailTeamSide {
  return {
    team: teamName(competitor?.team),
    crest: crestOf(competitor?.team) || crestOf(boxTeam?.team),
    // Mesma regra do parseEspnMatches: antes do apito nao existe placar.
    score: started ? num(competitor?.score) : null,
    // Preenchidas depois: a stat so existe comparando os dois lados.
    stats: [],
    lineup,
    lastFive,
  }
}

/**
 * Parser puro: nunca lanca, campo ausente vira null/array vazio. Payload sem
 * header/boxscore (jogo adiado, liga sem detalhe) devolve um MatchDetail vazio
 * em vez de erro - a pagina decide o que mostrar.
 */
export function parseMatchDetail(
  payload: unknown,
  leagueId: string,
  leagueName: string,
  eventId: string
): MatchDetail {
  const data = (payload && typeof payload === 'object' ? payload : {}) as EspnSummaryPayload
  const competition = data.header?.competitions?.[0]
  const competitors = competition?.competitors || []
  const homeCompetitor = competitors.find((side) => side.homeAway === 'home') || competitors[0]
  const awayCompetitor = competitors.find((side) => side.homeAway === 'away') || competitors[1]

  const status = mapStatus(competition?.status?.type?.name, competition?.status?.type?.state)
  const started = status === 'IN_PLAY' || status === 'PAUSED' || status === 'FINISHED'

  const boxTeams = data.boxscore?.teams || []
  const homeBox = pickSideBlock(boxTeams, homeCompetitor, 'home', 0)
  const awayBox = pickSideBlock(boxTeams, awayCompetitor, 'away', 1)
  const homeRoster = pickSideBlock(data.rosters, homeCompetitor, 'home', 0)
  const awayRoster = pickSideBlock(data.rosters, awayCompetitor, 'away', 1)
  const homeRecent = pickSideBlock(data.lastFiveGames, homeCompetitor, 'home', 0)
  const awayRecent = pickSideBlock(data.lastFiveGames, awayCompetitor, 'away', 1)

  const homeSide = buildSide(homeCompetitor, homeBox, started, buildLineup(homeRoster), buildRecent(homeRecent))
  const awaySide = buildSide(awayCompetitor, awayBox, started, buildLineup(awayRoster), buildRecent(awayRecent))
  // Comparativo: cada stat existe nos dois lados (o painel mostra uma linha por stat).
  const sideStats = buildStats(homeBox?.statistics, awayBox?.statistics)
  homeSide.stats = sideStats.map((stat) => ({ ...stat }))
  awaySide.stats = sideStats.map((stat) => ({ ...stat }))

  const venue = data.gameInfo?.venue
  const officials = data.gameInfo?.officials || []

  return {
    event_id: eventId,
    league_id: leagueId,
    league_name: leagueName || str(data.header?.league?.name) || leagueId,
    status,
    kickoff: str(competition?.date),
    venue: {
      name: str(venue?.fullName) || str(venue?.shortName),
      city: str(venue?.address?.city),
      country: str(venue?.address?.country),
      // A ESPN manda 0 quando nao tem o publico (eng.1 vem preenchido, bra.1 nao).
      attendance: num(data.gameInfo?.attendance),
    },
    referee: str(officials[0]?.fullName) || str(officials[0]?.displayName),
    home: homeSide,
    away: awaySide,
    meetings: buildMeetings(data),
    events: buildEvents(data),
    odds: buildOdds(data),
    market: parseMarketOdds(data),
    source: 'espn',
    captured_at: new Date().toISOString(),
  }
}

/**
 * Busca sob demanda: o summary tem ~400KB, nao pode entrar em revalidate de
 * pagina. O import do service e dinamico de proposito - este modulo tambem e
 * carregado pelo teste em node puro, que nao resolve o alias @/ (que so existe
 * no bundler); o import so acontece quando a funcao roda.
 */
export async function fetchMatchDetail(leagueId: string, eventId: string): Promise<MatchDetail> {
  const [{ fetchEspnMatchSummary }, { LEAGUE_NAMES }] = await Promise.all([
    import('@/services/espn'),
    import('@/types'),
  ])
  const payload = await fetchEspnMatchSummary(leagueId, eventId)
  if (!payload) throw new Error(`ESPN summary unavailable for event ${eventId}`)
  const leagueName = LEAGUE_NAMES[leagueId] || (payload as EspnSummaryPayload).header?.league?.name || leagueId
  return parseMatchDetail(payload, leagueId, leagueName, eventId)
}
