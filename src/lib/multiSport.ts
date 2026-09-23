import type { SportKind, SportLeague, SportCompetitor, SportGame } from './sports'

export type { SportKind, SportLeague, SportCompetitor, SportGame } from './sports'

/**
 * Registro multi-esporte + parser generico de scoreboard da ESPN.
 *
 * Fatos medidos com curl (23/09/2026, `--compressed`): a ESPN responde o MESMO
 * envelope `{events: [...]}` em
 * `https://site.api.espn.com/apis/site/v2/sports/<path>/scoreboard` para
 * futebol, NBA, NFL, NHL, MLB, F1, UFC e ATP. O que muda:
 *
 * - futebol/ligas US: `competitions[0].competitors[]` com `team` (e o escudo em
 *   `team.logo` ou `team.logos[0].href`); placar em `competitor.score` (string),
 *   record em `competitor.records[]`, estadio em `competitions[0].venue.fullName`,
 *   TV em `competitions[0].broadcasts[0].names[0]`.
 * - racing/mma/tennis: sem times. F1 nao manda `competitors`; o UFC manda
 *   competidores de atleta (`team: null`, sem nome de time, com `athlete` e
 *   `records`) e o ATP nao manda `competitions` nenhum (o torneio vem em
 *   `groupings`). Nesses casos `competitors` fica vazio e o card usa `name`/`note`.
 * - nao existe predictor/probabilidade na ESPN (HTTP 400), entao nada de odds aqui.
 *
 * O catalogo (SPORTS) mora neste arquivo e nao em `lib/sports` por causa do
 * bundler: `fetchScoreboard` precisa do catalogo em runtime, e os scripts de
 * teste em node so resolvem specifier com extensao explicita, que o tsc/Next
 * recusam. `lib/sports` guarda os tipos (`import type` e apagado em runtime) e
 * `lib/multiSport` guarda os valores.
 */

const SITE = 'https://site.api.espn.com/apis/site/v2/sports'

const HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'HypeFC/0.2 (+https://github.com/JE4NVRG/HypeFc)',
}

/**
 * Catalogo. Os ids do futebol sao os mesmos de `services/espn.ts`
 * (ESPN_LEAGUE_SLUGS) para as duas pontas falarem da mesma liga.
 */
export const SPORTS: SportLeague[] = [
  // Futebol (paths ja usados pelas telas de hoje)
  { id: 'BSA', name: 'Brasileirão Série A', path: 'soccer/bra.1', kind: 'soccer', short: 'BRA' },
  { id: 'PL', name: 'Premier League', path: 'soccer/eng.1', kind: 'soccer', short: 'ING' },
  { id: 'PD', name: 'La Liga', path: 'soccer/esp.1', kind: 'soccer', short: 'ESP' },
  { id: 'SA', name: 'Serie A', path: 'soccer/ita.1', kind: 'soccer', short: 'ITA' },
  { id: 'BL1', name: 'Bundesliga', path: 'soccer/ger.1', kind: 'soccer', short: 'ALE' },
  { id: 'FL1', name: 'Ligue 1', path: 'soccer/fra.1', kind: 'soccer', short: 'FRA' },
  { id: 'DED', name: 'Eredivisie', path: 'soccer/ned.1', kind: 'soccer', short: 'HOL' },
  { id: 'PPL', name: 'Primeira Liga', path: 'soccer/por.1', kind: 'soccer', short: 'POR' },
  { id: 'ELC', name: 'Championship', path: 'soccer/eng.2', kind: 'soccer', short: 'CHA' },
  { id: 'CL', name: 'Champions League', path: 'soccer/uefa.champions', kind: 'soccer', short: 'UCL' },
  // Ligas novas (mesmo envelope de scoreboard, conferido com curl)
  { id: 'NBA', name: 'NBA', path: 'basketball/nba', kind: 'basketball', short: 'NBA' },
  { id: 'NFL', name: 'NFL', path: 'football/nfl', kind: 'football', short: 'NFL' },
  { id: 'NHL', name: 'NHL', path: 'hockey/nhl', kind: 'hockey', short: 'NHL' },
  { id: 'MLB', name: 'MLB', path: 'baseball/mlb', kind: 'baseball', short: 'MLB' },
  { id: 'F1', name: 'Fórmula 1', path: 'racing/f1', kind: 'racing', short: 'F1' },
  { id: 'UFC', name: 'UFC', path: 'mma/ufc', kind: 'mma', short: 'UFC' },
  { id: 'ATP', name: 'ATP Tour', path: 'tennis/atp', kind: 'tennis', short: 'ATP' },
]

const SPORT_BY_ID = new Map(SPORTS.map((league) => [league.id, league]))

/** Kinds sem times: o payload nao da placar de time, entao nao tem competitors. */
const TEAMLESS_KINDS = new Set<SportKind>(['racing', 'mma', 'tennis'])

export function sportsByKind(): Record<SportKind, SportLeague[]> {
  const grouped: Record<SportKind, SportLeague[]> = {
    soccer: [],
    basketball: [],
    football: [],
    hockey: [],
    baseball: [],
    racing: [],
    mma: [],
    tennis: [],
  }
  for (const league of SPORTS) grouped[league.kind].push(league)
  return grouped
}

/** Status normalizado: SCHEDULED | IN_PLAY | PAUSED | FINISHED | POSTPONED | OTHER. */
export type SportStatus = 'SCHEDULED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED' | 'POSTPONED' | 'OTHER'

/**
 * Mesmo mapeamento de `lib/espnParse` (nome primeiro, `state` como rede de
 * seguranca), reduzido ao vocabulario de 6 valores: o que no futebol e TIMED
 * vira SCHEDULED; CANCELLED/ABANDONED caem em OTHER; SUSPENDED vira PAUSED
 * (jogo interrompido, com placar, nao e adiamento).
 */
const STATUS_BY_NAME: Record<string, SportStatus> = {
  STATUS_SCHEDULED: 'SCHEDULED',
  STATUS_TIMED: 'SCHEDULED',
  STATUS_IN_PROGRESS: 'IN_PLAY',
  STATUS_FIRST_HALF: 'IN_PLAY',
  STATUS_SECOND_HALF: 'IN_PLAY',
  STATUS_OVERTIME: 'IN_PLAY',
  STATUS_SHOOTOUT: 'IN_PLAY',
  STATUS_HALFTIME: 'PAUSED',
  STATUS_END_PERIOD: 'PAUSED',
  STATUS_END_OF_REGULATION: 'PAUSED',
  STATUS_RAIN_DELAY: 'PAUSED',
  STATUS_SUSPENDED: 'PAUSED',
  STATUS_FULL_TIME: 'FINISHED',
  STATUS_FINAL: 'FINISHED',
  STATUS_POSTPONED: 'POSTPONED',
  STATUS_DELAYED: 'POSTPONED',
  STATUS_CANCELED: 'OTHER',
  STATUS_CANCELLED: 'OTHER',
  STATUS_ABANDONED: 'OTHER',
}

const STATUS_BY_STATE: Record<string, SportStatus> = {
  pre: 'SCHEDULED',
  in: 'IN_PLAY',
  post: 'FINISHED',
}

export function mapSportStatus(name: string | null | undefined, state: string | null | undefined): SportStatus {
  if (name && STATUS_BY_NAME[name]) return STATUS_BY_NAME[name]
  if (state && STATUS_BY_STATE[state]) return STATUS_BY_STATE[state]
  return 'OTHER'
}

/** Status em que o placar ja significa algo (nos agendados a ESPN manda '0'). */
function hasScore(status: SportStatus): boolean {
  return status === 'IN_PLAY' || status === 'PAUSED' || status === 'FINISHED'
}

function obj(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function str(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

function bool(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function number(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const parsed = Number(str(value) ?? '')
  return Number.isFinite(parsed) ? parsed : null
}

/** Escudo nos dois formatos da ESPN: `team.logo` (futebol) ou `logos[0].href`. */
function crestOf(team: Record<string, unknown>): string | null {
  const direct = str(team.logo)
  if (direct) return direct
  return str(obj(list(team.logos)[0])?.href)
}

/** `records[]` traz overall + casa/fora; o card quer o overall ('14-9'). */
function recordOf(competitor: Record<string, unknown>): string | null {
  const records = list(competitor.records).map(obj).filter((item): item is Record<string, unknown> => Boolean(item))
  if (!records.length) return null
  const overall = records.find((item) => str(item.type) === 'total') ?? records[0]
  return str(overall.summary)
}

function competitorsOf(competition: Record<string, unknown> | null, status: SportStatus): SportCompetitor[] {
  const out: SportCompetitor[] = []
  for (const raw of list(competition?.competitors)) {
    const competitor = obj(raw)
    const team = obj(competitor?.team)
    // Competidor sem time (stub de atleta, dupla de tenis sem team) nao vira card de time.
    if (!competitor || !team) continue
    const name = str(team.displayName) ?? str(team.name) ?? str(team.shortDisplayName) ?? str(team.abbreviation)
    if (!name) continue
    const homeAway = competitor.homeAway === 'home' || competitor.homeAway === 'away' ? competitor.homeAway : null
    out.push({
      id: str(team.id) ?? str(competitor.id),
      name,
      short: str(team.shortDisplayName) ?? str(team.abbreviation),
      crest: crestOf(team),
      score: hasScore(status) ? (number(competitor.score) ?? 0) : null,
      home_away: homeAway,
      winner: bool(competitor.winner),
      record: recordOf(competitor),
    })
  }
  return out
}

function broadcastOf(competition: Record<string, unknown> | null): string | null {
  const first = obj(list(competition?.broadcasts)[0])
  return str(list(first?.names)[0]) ?? str(competition?.broadcast)
}

/**
 * Nota do evento. Em jogo de time a ESPN usa `competitions[0].notes[0].headline`
 * (ex 'Doubleheader - Game 1'); nos esportes sem time o que existe e a sessao
 * (F1: 'FP1'), a categoria (UFC: 'Light Heavyweight') e a chave (ATP, que nao
 * tem `competitions`, em `groupings[0].grouping.displayName`). 'STD' (jogo
 * normal) e ruido, entao nao entra.
 */
function noteOf(event: Record<string, unknown>, competition: Record<string, unknown> | null, kind: SportKind): string | null {
  for (const raw of list(competition?.notes)) {
    const headline = str(obj(raw)?.headline)
    if (headline) return headline
  }
  if (TEAMLESS_KINDS.has(kind)) {
    const session = str(obj(competition?.type)?.abbreviation)
    if (session) return session
    const grouping = str(obj(obj(list(event.groupings)[0])?.grouping)?.displayName)
    if (grouping) return grouping
  }
  return null
}

/** Ordena por data asc; evento sem data vai para o fim. */
function byDate(a: SportGame, b: SportGame): number {
  if (a.date === b.date) return 0
  if (!a.date) return 1
  if (!b.date) return -1
  return a.date < b.date ? -1 : 1
}

/**
 * Payload de scoreboard (cru, sem tipo) -> jogos normalizados.
 * Nunca lanca: qualquer coisa que nao seja `{events: [...]}` devolve [].
 */
export function parseScoreboard(payload: unknown, league: SportLeague): SportGame[] {
  const events = list(obj(payload)?.events)
  const out: SportGame[] = []

  for (const raw of events) {
    const event = obj(raw)
    if (!event) continue

    const competition = obj(list(event.competitions)[0])
    const statusSource = obj(competition?.status) ?? obj(event.status)
    const statusType = obj(statusSource?.type)
    const status = mapSportStatus(
      str(statusType?.name),
      str(statusType?.state) ?? str(statusSource?.state)
    )

    const id = str(event.id) ?? ''
    const name = str(event.name) ?? str(event.shortName) ?? ''
    if (!id && !name) continue

    // A ESPN usa o status da competicao (mais especifico) e cai para o do evento.
    const eventStatus = obj(event.status)
    const clock = str(statusSource?.displayClock) ?? str(eventStatus?.displayClock)

    out.push({
      id,
      league_id: league.id,
      league_name: league.name,
      name,
      date: str(event.date),
      status,
      clock,
      competitors: TEAMLESS_KINDS.has(league.kind) ? [] : competitorsOf(competition, status),
      venue: str(obj(competition?.venue)?.fullName),
      broadcast: broadcastOf(competition),
      note: noteOf(event, competition, league.kind),
    })
  }

  return out.sort(byDate)
}

/**
 * Placar do dia (o scoreboard sem `dates` e o dia corrente na ESPN).
 * Liga desconhecida, HTTP ruim ou rede fora devolvem [] (nunca lanca).
 */
export async function fetchScoreboard(leagueId: string): Promise<SportGame[]> {
  const league = SPORT_BY_ID.get(leagueId)
  if (!league) return []
  try {
    const res = await fetch(`${SITE}/${league.path}/scoreboard`, { headers: HEADERS, cache: 'no-store' })
    if (!res.ok) return []
    return parseScoreboard(await res.json(), league)
  } catch {
    return []
  }
}
