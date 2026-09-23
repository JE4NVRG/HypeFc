/**
 * Vocabulario multi-esporte do painel.
 *
 * O HypeFC comeca no futebol, mas a ESPN serve NBA/NFL/NHL/MLB/F1/UFC/ATP no
 * MESMO formato de scoreboard (`/apis/site/v2/sports/<path>/scoreboard`). O que
 * muda entre eles e o vocabulario deste arquivo: `SportKind` diz como ler o
 * payload (racing/mma/tennis nao tem times) e `SportLeague` e a linha do
 * catalogo (`SPORTS`, em `lib/multiSport`).
 *
 * Por que os tipos moram aqui e o catalogo no multiSport: o node
 * (`--experimental-strip-types`, usado pelos scripts de teste) so resolve
 * specifier com extensao explicita (`./sports.ts`), enquanto o tsc/Next
 * recusam a extensao `.ts` (TS5097) e resolvem sem ela. Esse arquivo e o unico
 * jeito de compartilhar algo entre os dois modulos sem quebrar um dos dois
 * lados: `import type` e apagado em runtime, entao o node nem tenta resolver.
 * Consequencia pratica: valores (SPORTS, parseScoreboard, fetchScoreboard)
 * saem de `lib/multiSport`; aqui ficam so tipos e constantes sem dependencia.
 */

export type SportKind =
  | 'soccer'
  | 'basketball'
  | 'football'
  | 'hockey'
  | 'baseball'
  | 'racing'
  | 'mma'
  | 'tennis'

/** Ordem canonica dos kinds (a UI itera por aqui, nao pelas chaves de um objeto). */
export const SPORT_KINDS: SportKind[] = [
  'soccer',
  'basketball',
  'football',
  'hockey',
  'baseball',
  'racing',
  'mma',
  'tennis',
]

/** Kinds cujo payload nao tem times: sem competitors, o card usa name/note. */
export const TEAMLESS_SPORT_KINDS: SportKind[] = ['racing', 'mma', 'tennis']

export interface SportLeague {
  /** Id do painel (mesma chave usada pelo futebol: BSA, PL, ...; NBA, NFL, ...). */
  id: string
  name: string
  /** Caminho na ESPN entre 'sports/' e '/scoreboard' (ex: 'basketball/nba'). */
  path: string
  kind: SportKind
  /** Rotulo curto para chips/abas. */
  short: string
}

export interface SportCompetitor {
  id: string | null
  name: string
  short: string | null
  /** Escudo/logo: `team.logo` (futebol) ou `team.logos[0].href` (ligas US). */
  crest: string | null
  score: number | null
  home_away: 'home' | 'away' | null
  winner: boolean | null
  /** Record do time, ex '14-9' (a ESPN manda overall + casa/fora; usamos o overall). */
  record: string | null
}

export interface SportGame {
  id: string
  league_id: string
  league_name: string
  name: string
  /** ISO do inicio, como a ESPN manda (ex '2026-09-22T17:05Z'). */
  date: string | null
  /**
   * Vocabulario unico dos esportes: SCHEDULED | IN_PLAY | PAUSED | FINISHED |
   * POSTPONED | OTHER (o futebol do repo fala TIMED/CANCELLED/SUSPENDED, que
   * aqui colapsam em SCHEDULED/OTHER/PAUSED).
   */
  status: string
  clock: string | null
  competitors: SportCompetitor[]
  venue: string | null
  broadcast: string | null
  /** Nota do evento: manchete do jogo, sessao (F1), categoria (UFC), chave (tenis). */
  note: string | null
}
