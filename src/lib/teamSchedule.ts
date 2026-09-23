/**
 * Proximos jogos de um time na ESPN.
 *
 * Endpoint provado com curl (23/09/2026):
 *   https://site.api.espn.com/apis/site/v2/sports/soccer/bra.1/teams/2029/schedule?fixture=true
 *
 * Detalhes que importam (todos conferidos no payload real, nao assumidos):
 * - O MESMO endpoint sem parametro devolve os jogos JA jogados: 28 eventos, todos
 *   com status state 'post'. Com `?fixture=true` devolve os que FALTAM: 10 eventos,
 *   todos com state 'pre' (Palmeiras -> 09/out a 02/dez). Ou seja: e a variante que
 *   traz o futuro, e ela responde 200 na site.api (CORS liberado).
 * - O valor tem de ser exatamente "true". `?fixture=1` e `?fixtures=true` voltam o
 *   historico (0 e 28 eventos, respectivamente) — parametro silenciosamente ignorado.
 * - Os eventos vem INLINE (ao contrario do sports.core.api, que devolve so `$ref` e
 *   obrigaria uma requisicao por jogo). Uma chamada basta.
 * - Cada evento tem `competitions[0].competitors[]` com `homeAway` home/away,
 *   `team.logos[0].href` (nao existe `team.logo` aqui) e `event.league.name`.
 * - Nao ha paginacao: eng.1/Man City devolveu 33 jogos numa tacada (ate mai/2027).
 * - Time sem jogo publicado (liga encerrada, id fora da liga) devolve 0 eventos;
 *   id inexistente devolve HTTP 500. Os dois casos viram lista vazia, nunca erro.
 *
 * Contrato publico: a UI e escrita contra estes nomes, entao nada de renomear campo.
 */
export interface TeamFixture {
  date: string | null
  opponent: string
  opponent_crest: string | null
  home: boolean
  competition: string | null
  status: string
}

/** A lista e compacta por decisao de produto: os proximos 5 bastam (a UI mostra 5 linhas). */
const MAX_FIXTURES = 5

// --- Estruturas do payload (tudo opcional: campo ausente vira null/array vazio) ---

interface EspnTeamNode {
  id?: string
  displayName?: string
  name?: string
  shortDisplayName?: string
  logo?: string
  logos?: Array<{ href?: string }>
}

interface EspnFixtureCompetitor {
  homeAway?: string
  team?: EspnTeamNode
}

interface EspnFixtureCompetition {
  date?: string
  status?: { type?: { name?: string; state?: string } }
  competitors?: EspnFixtureCompetitor[]
}

interface EspnFixtureEvent {
  date?: string
  league?: { name?: string; abbreviation?: string }
  seasonType?: { name?: string; abbreviation?: string }
  competitions?: EspnFixtureCompetition[]
}

interface EspnSchedulePayload {
  events?: EspnFixtureEvent[]
}

// --- Helpers de leitura ---

function str(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

/** Escudo: o competitor so traz `logos[]` (o `logo` fica aqui como rede). */
function crestOf(team: EspnTeamNode | undefined): string | null {
  if (!team) return null
  return str(team.logo) || str(team.logos?.[0]?.href) || null
}

function teamName(team: EspnTeamNode | undefined): string {
  return str(team?.displayName) || str(team?.name) || str(team?.shortDisplayName) || ''
}

/**
 * Tabela local de status. Este modulo tambem roda no teste com node puro, que nao
 * resolve o alias @/; por isso nao da para importar do espnParse (os valores sao os
 * mesmos MatchStatus do resto do app).
 */
const STATUS_BY_NAME: Record<string, string> = {
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
  STATUS_DELAYED: 'DELAYED',
}

const STATUS_BY_STATE: Record<string, string> = {
  pre: 'TIMED',
  in: 'IN_PLAY',
  post: 'FINISHED',
}

function mapStatus(name: string | undefined, state: string | undefined): string {
  const key = (name || '').toUpperCase()
  if (key && STATUS_BY_NAME[key]) return STATUS_BY_NAME[key]
  if (state && STATUS_BY_STATE[state]) return STATUS_BY_STATE[state]
  return 'SCHEDULED'
}

/** Estado/status que, mesmo futuro, nao e "agendado" e por isso nao entra na lista. */
const NOT_SCHEDULED = new Set([
  'STATUS_POSTPONED',
  'STATUS_CANCELED',
  'STATUS_CANCELLED',
  'STATUS_SUSPENDED',
  'STATUS_DELAYED',
  'STATUS_FORFEITED',
])

/**
 * So entra jogo futuro com status agendado. Jogo em andamento/encerrado nunca e
 * "proximo"; adiado/suspenso/cancelado tambem fica de fora. Quando o payload nao
 * traz state nem nome, aceita (o filtro seguinte exige que o confronto exista).
 */
function isUpcoming(state: string | undefined, name: string | undefined): boolean {
  const stateKey = (state || '').toLowerCase()
  if (stateKey === 'in' || stateKey === 'post') return false

  const nameKey = (name || '').toUpperCase()
  if (NOT_SCHEDULED.has(nameKey)) return false
  if (stateKey === 'pre') return true

  return nameKey === '' || nameKey === 'STATUS_SCHEDULED' || nameKey === 'STATUS_TIMED'
}

/** Chave de ordenacao; sem data (ou data invalida) vai para o fim da lista. */
function timeOf(date: string | null): number {
  if (!date) return Number.POSITIVE_INFINITY
  const parsed = Date.parse(date)
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed
}

function compareFixtures(a: TeamFixture, b: TeamFixture): number {
  const left = timeOf(a.date)
  const right = timeOf(b.date)
  if (left === right) return 0
  return left - right
}

/**
 * Parser puro: nunca lanca. Payload estranho (nao-objeto, sem `events`, evento sem
 * confronto) devolve array vazio em vez de erro.
 *
 * Sem o id do time em maos nao da para dizer qual lado e o adversario: nesse caso o
 * evento e descartado em vez de mostrar o confronto trocado. A ordem final e por data
 * ascendente, jogos sem data no fim, no maximo 5.
 */
export function parseTeamSchedule(payload: unknown, teamId: string): TeamFixture[] {
  const data = (payload && typeof payload === 'object' ? payload : {}) as EspnSchedulePayload
  const events = Array.isArray(data.events) ? data.events : []
  const wantedId = str(teamId)

  const rows: TeamFixture[] = []
  if (!wantedId) return rows

  for (const event of events) {
    if (!event || typeof event !== 'object') continue

    const competition = Array.isArray(event.competitions) ? event.competitions[0] : undefined
    const status = competition?.status?.type
    if (!isUpcoming(status?.state, status?.name)) continue

    const competitors = Array.isArray(competition?.competitors) ? competition.competitors : []
    const mine = competitors.find((side) => str(side?.team?.id) === wantedId)
    if (!mine) continue

    const other = competitors.find((side) => side !== mine)
    const opponent = teamName(other?.team)
    if (!opponent) continue

    rows.push({
      date: str(event.date) || str(competition?.date),
      opponent,
      opponent_crest: crestOf(other?.team),
      home: mine.homeAway === 'home',
      competition: str(event.league?.name) || str(event.seasonType?.name),
      status: mapStatus(status?.name, status?.state),
    })
  }

  return rows.sort(compareFixtures).slice(0, MAX_FIXTURES)
}

// --- Busca ---

const SITE = 'https://site.api.espn.com/apis'

const HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'HypeFC/0.2 (+https://github.com/JE4NVRG/HypeFc)',
}

/**
 * Busca os proximos jogos do time. Nunca lanca: liga sem slug, id ausente, HTTP ruim
 * ou rede fora devolvem [] (a UI mostra o estado vazio honesto).
 *
 * `teamName` faz parte do contrato publico porque o chamador ja o tem em maos (vem do
 * meta do time), mas o endpoint resolve o time pelo id: o nome nao entra na URL.
 */
export async function fetchTeamSchedule(
  leagueId: string,
  teamId: string,
  teamName: string
): Promise<TeamFixture[]> {
  void teamName

  const id = str(teamId)
  if (!id) return []

  try {
    // O mapa de slugs mora em services/espn; import dinamico porque este modulo
    // tambem e carregado pelo teste em node puro, que nao resolve o alias @/.
    const { ESPN_LEAGUE_SLUGS } = await import('@/services/espn')
    const slug = ESPN_LEAGUE_SLUGS[leagueId]
    if (!slug) return []

    const res = await fetch(
      `${SITE}/site/v2/sports/soccer/${slug}/teams/${encodeURIComponent(id)}/schedule?fixture=true`,
      { headers: HEADERS, cache: 'no-store' }
    )
    if (res.ok) {
      const payload = (await res.json().catch(() => null)) as unknown
      const daAgenda = parseTeamSchedule(payload, id)
      if (daAgenda.length) return daAgenda
    }

    // Reserva: calendario da LIGA por mes. Em 23/09/2026 o endpoint de agenda do
    // time parou de devolver jogos futuros — voltava vazio em todas as variacoes
    // testadas (sem parametro, com limit, com season), enquanto o scoreboard por
    // mes seguia publicando a temporada inteira. Sem esta reserva a secao
    // "proximos jogos" ficava vazia sem motivo aparente.
    const meses: string[] = []
    const hoje = new Date()
    for (let i = 0; i < 4; i += 1) {
      const d = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + i, 1))
      meses.push(`${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
    }
    const paginas = await Promise.all(
      meses.map((mes) =>
        fetch(`${SITE}/site/v2/sports/soccer/${slug}/scoreboard?dates=${mes}&limit=400`, {
          headers: HEADERS,
          cache: 'no-store',
        })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      )
    )
    const eventos = paginas.flatMap((pagina: unknown) => {
      const lista = (pagina as EspnSchedulePayload | null)?.events
      return Array.isArray(lista) ? lista : []
    })
    return parseTeamSchedule({ events: eventos }, id)
  } catch {
    return []
  }
}
