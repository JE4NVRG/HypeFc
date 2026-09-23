/**
 * Chance de titulo / G4 / zona, publicada como arquivo estatico pelo build
 * (scripts/build-title-odds.ts).
 *
 * O cliente nao simula nada: ele le o resultado da simulacao pronta. O texto
 * que acompanha o numero na tela tem que deixar claro (a) quantas vezes a
 * temporada foi simulada e (b) quantas rodadas foram aproximadas por nao
 * estarem publicadas na fonte.
 */
export interface TitleOddsTeam {
  /** Nome usado pela tabela de classificacao (e por ele que o casamento acontece). */
  team: string
  /** Nome curto do calendario ("Athletico-PR") — para espaco estreito. */
  apelido: string
  rating_name: string
  pos: number
  pts: number
  jogos: number
  rating: number
  p_titulo: number
  p_g4: number
  p_zona: number
}

export interface LeagueTitleOdds {
  league_id: string
  league_name: string
  slug: string
  jogos_restantes: number
  rodadas_totais: number
  rodadas_publicadas: number
  rodadas_aproximadas: number
  zona_rebaixamento: number
  times_sem_rating: number
  times: TitleOddsTeam[]
}

export interface TitleOddsPayload {
  generated_at: string
  season: number
  simulacoes: number
  metodo: string
  aviso: string
  leagues: Record<string, LeagueTitleOdds>
}

let pedido: Promise<TitleOddsPayload | null> | null = null

/** Uma busca para a pagina inteira. */
export function loadTitleOdds(): Promise<TitleOddsPayload | null> {
  if (!pedido) {
    pedido = fetch('data/title-odds.json', { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<TitleOddsPayload>) : null))
      .catch(() => null)
  }
  return pedido
}

/**
 * Nome comparavel. A tabela de classificacao e a simulacao vem da mesma fonte,
 * mas nao do mesmo endpoint, entao o casamento e por nome normalizado — e quando
 * nao casa, a tela simplesmente nao mostra chance para aquele time, em vez de
 * arriscar o numero do vizinho.
 */
export function normalizarTime(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

export function chanceDoTime(
  payload: TitleOddsPayload | null,
  leagueId: string,
  nome: string
): TitleOddsTeam | null {
  const liga = payload?.leagues?.[leagueId]
  if (!liga || !nome) return null
  const alvo = normalizarTime(nome)
  return (
    liga.times.find((t) => normalizarTime(t.team) === alvo) ||
    liga.times.find((t) => normalizarTime(t.apelido || '') === alvo) ||
    null
  )
}

/** Texto curto e honesto sobre como o numero foi obtido. */
export function notaDaSimulacao(liga: LeagueTitleOdds, simulacoes: number): string {
  const base = `${simulacoes.toLocaleString('pt-BR')} temporadas simuladas com o modelo do site (Elo+Poisson)`
  if (liga.rodadas_aproximadas > 0) {
    return `${base}. ${liga.rodadas_publicadas} de ${liga.rodadas_totais} rodadas estão publicadas na fonte; as ${liga.rodadas_aproximadas} restantes entram como confronto sorteado dentro da liga.`
  }
  return `${base}, a partir da tabela atual e do calendário completo da temporada.`
}

/**
 * Formato da chance. Zero nao e "0,0%": um time com 0,04% tem chance, so nao
 * aparece em uma casa decimal. Publicar "0,0%" seria dizer que acabou.
 */
export function formatarChance(p: number): string {
  if (!p || p <= 0) return '—'
  const pct = p * 100
  if (pct >= 10) return `${pct.toFixed(0)}%`
  if (pct >= 1) return `${pct.toFixed(1)}%`
  if (pct >= 0.05) return `${pct.toFixed(2)}%`
  return '<0,05%'
}
