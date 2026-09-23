/**
 * Probabilidade de vitoria — modelo PROPRIO (Elo + Poisson).
 *
 * A ESPN nao tem predictor: o endpoint de prediction devolve HTTP 400
 * "Predictor is not supported". Entao qualquer probabilidade que apareca no
 * produto tem que ser NOSSA, e um numero so vale se for MEDIDO — este modulo nao
 * publica nada sozinho. Quem mede e scripts/backtest-probability.ts, que roda o
 * modelo jogo a jogo contra o placar real e reporta Brier, log loss, calibracao
 * e o acerto do argumento, contra duas referencias obrigatorias.
 *
 * Sem dependencia externa: so Math.
 *
 * ---------------------------------------------------------------------------
 * POR QUE ELO PURO NAO BASTA (o empate nao sai de Elo)
 * ---------------------------------------------------------------------------
 * A saida de um Elo e UMA probabilidade: o "expected score" do mandante, onde o
 * empate ja esta embutido valendo meio ponto. Ou seja, Elo sabe dizer
 * "o mandante leva 60% dos pontos", mas nao sabe separar 60% em
 * (vitoria, empate, derrota): 45/26/29 e 60/0/40 produzem o MESMO expected
 * score, e sao previsoes completamente diferentes. Empate nao e um valor de
 * pontos, e um placar — "os dois times fizeram o mesmo numero de gols".
 *
 * Por isso o bridge aqui: o Elo fixa o BALANCO (o expected score do mandante,
 * que e o que ele faz bem) e um modelo de gols de Poisson separa esse balanco em
 * tres resultados, porque no Poisson o empate cai naturalmente de
 * P(gols_casa == gols_fora). O ajuste e por bissecao: procura-se a supremacia
 * de gols que reproduz exatamente o expected score do Elo, mantendo o total de
 * gols da liga fixo. Nada de heuristica "chute o empate em 26%": o empate e
 * consequencia do modelo de gols.
 *
 * ---------------------------------------------------------------------------
 * CONSTANTES (todas com origem, nenhuma de enfeite)
 * ---------------------------------------------------------------------------
 * - K = 20: fator de atualizacao do Elo. Baixo o bastante para o rating nao
 *   oscilar com um resultado isolado, alto o bastante para reagir dentro de uma
 *   temporada. E o valor classico de Elo de futebol (a FIDE usa 10-20).
 * - HOME_ADVANTAGE = 70 pontos Elo: um time equilibrado jogando em casa tem
 *   expected score ~0.60 em vez de 0.50. A conta fechada: no Elo de escala 400,
 *   0.60/0.40 = 1.5 e 400*log10(1.5) ~= 70.4. Bate com a frequencia real de
 *   vitoria do mandante (~45% de vitoria + a metade que cabe no empate).
 * - TOTAL_GOALS = 2.6 gols por jogo (soma dos dois times): a media de gols das
 *   grandes ligas de futebol. E o unico parametro livre do Poisson aqui — ele
 *   controla o quanto do resultado sobra para o empate.
 * - BASE_RATING = 1500: rating inicial de todo time (escala Elo padrao).
 * - MAX_GOALS = 12: truncamento da soma infinita do Poisson. Para lambda <= 3 a
 *   cauda perdida em 12 gols e < 1e-6, ou seja irrelevante para 4 casas.
 */

/** Jogo no minimo necessario para o rating. Estrutural, como H2HMatch. */
export interface H2HLikeMatch {
  home: string
  away: string
  score_home: number | null
  score_away: number | null
  status: string
  date?: string | null
}

export interface ProbInput {
  team: string
  rating: number
}

export interface MatchProb {
  home: number
  draw: number
  away: number
  source: 'elo+poisson'
  /** Times com rating no conjunto (tamanho da base que produziu os ratings). */
  sample: number
}

export interface CalibrationBucket {
  bucket: string
  n: number
  predicted: number
  observed: number
}

export interface ProbOutcome {
  probs: { home: number; draw: number; away: number }
  outcome: 'home' | 'draw' | 'away'
}

export const BASE_RATING = 1500
export const DEFAULT_K = 20
/** Pontos Elo de vantagem de mando (ver constante derivada no topo). */
export const DEFAULT_HOME_ADVANTAGE = 70
/** Gols somados dos dois times num jogo equilibrado. */
export const DEFAULT_TOTAL_GOALS = 2.6

const MAX_GOALS = 12
/** Piso de gols esperados por time: lambda 0 gera P(0 gols)=1 e trava o modelo. */
const MIN_LAMBDA = 0.1

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** pmf[k] = P(X = k), X ~ Poisson(lambda). */
function poissonPmf(lambda: number, max: number): number[] {
  const out = new Array<number>(max + 1)
  out[0] = Math.exp(-lambda)
  for (let k = 1; k <= max; k += 1) out[k] = (out[k - 1] as number) * (lambda / k)
  return out
}

/** 1X2 a partir dos gols esperados dos dois lados (Poisson independente). */
function poissonOutcome(
  lambdaHome: number,
  lambdaAway: number
): { home: number; draw: number; away: number } {
  const ph = poissonPmf(lambdaHome, MAX_GOALS)
  const pa = poissonPmf(lambdaAway, MAX_GOALS)
  let home = 0
  let draw = 0
  let away = 0
  for (let i = 0; i <= MAX_GOALS; i += 1) {
    const hi = ph[i] as number
    for (let j = 0; j <= MAX_GOALS; j += 1) {
      const cell = hi * (pa[j] as number)
      if (i > j) home += cell
      else if (i === j) draw += cell
      else away += cell
    }
  }
  // Renormaliza a cauda truncada: as tres partes tem que somar exatamente 1.
  const total = home + draw + away
  return { home: home / total, draw: draw / total, away: away / total }
}

/**
 * Expected score do mandante para uma supremacia de gols `s` (gols casa - fora),
 * com o total de gols da liga fixo.
 */
function expectancyForSupremacy(supremacy: number, totalGoals: number): number {
  const lambdaHome = clamp(totalGoals / 2 + supremacy / 2, MIN_LAMBDA, totalGoals - MIN_LAMBDA)
  const lambdaAway = clamp(totalGoals / 2 - supremacy / 2, MIN_LAMBDA, totalGoals - MIN_LAMBDA)
  const { home, draw } = poissonOutcome(lambdaHome, lambdaAway)
  return home + draw / 2
}

/**
 * Inverte o bridge: qual supremacia de gols reproduz o expected score do Elo?
 *
 * `expectancyForSupremacy` e monotonica crescente em `s`, entao bissecao resolve
 * e converge para precisao de sobra em 48 passos. Se o expected score do Elo
 * estiver fora do que o Poisson alcanca (time super favorito), o resultado
 * satura no extremo — e isso e honesto: o modelo declara o teto, nao extrapola.
 */
function solveSupremacy(expectancy: number, totalGoals: number): number {
  const span = Math.max(totalGoals - 2 * MIN_LAMBDA, 0.2)
  let lo = -span
  let hi = span
  for (let step = 0; step < 48; step += 1) {
    const mid = (lo + hi) / 2
    if (expectancyForSupremacy(mid, totalGoals) < expectancy) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** Expected score do mandante (Elo puro): 1 vitoria, 0.5 empate, 0 derrota. */
function eloExpectancy(ratingHome: number, ratingAway: number, homeAdvantage: number): number {
  return 1 / (1 + Math.pow(10, -(ratingHome + homeAdvantage - ratingAway) / 400))
}

/**
 * Ratings Elo a partir de jogos com placar.
 *
 * Regra do repo: so jogo FINISHED com placar nos dois lados conta — agendado, ao
 * vivo ou com placar null nunca entra. Os jogos sao ordenados por data (faltando
 * data, vao para o fim), porque Elo e sequencial: outra ordem da outro rating.
 *
 * O update e de soma zero (o que o mandante ganha, o visitante perde): o bolo de
 * pontos nao infla com o tempo, entao a escala continua sendo Elo.
 */
export function buildRatings(
  matches: H2HLikeMatch[],
  options?: { k?: number; homeAdvantage?: number }
): Map<string, number> {
  const k = options?.k ?? DEFAULT_K
  const homeAdvantage = options?.homeAdvantage ?? DEFAULT_HOME_ADVANTAGE

  const played = matches
    .filter(
      (match) =>
        match.status === 'FINISHED' && match.score_home !== null && match.score_away !== null
    )
    .sort((a, b) => String(a.date ?? '').localeCompare(String(b.date ?? '')))

  const ratings = new Map<string, number>()

  for (const match of played) {
    const scoreHome = match.score_home as number
    const scoreAway = match.score_away as number

    const ratingHome = ratings.get(match.home) ?? BASE_RATING
    const ratingAway = ratings.get(match.away) ?? BASE_RATING

    const expectedHome = eloExpectancy(ratingHome, ratingAway, homeAdvantage)
    const actualHome = scoreHome > scoreAway ? 1 : scoreHome === scoreAway ? 0.5 : 0
    const delta = k * (actualHome - expectedHome)

    ratings.set(match.home, ratingHome + delta)
    ratings.set(match.away, ratingAway - delta)
  }

  return ratings
}

/**
 * 1X2 a partir dos dois ratings.
 *
 * O Elo decide o balanco e o Poisson decide o empate — o porque esta no topo do
 * arquivo. `totalGoals` fica exposto so para inspecao/teste; o backtest usa o
 * default.
 */
export function predictMatch(
  homeRating: number,
  awayRating: number,
  options?: { homeAdvantage?: number; totalGoals?: number }
): { home: number; draw: number; away: number } {
  const homeAdvantage = options?.homeAdvantage ?? DEFAULT_HOME_ADVANTAGE
  const totalGoals = options?.totalGoals ?? DEFAULT_TOTAL_GOALS

  const expectancy = eloExpectancy(homeRating, awayRating, homeAdvantage)
  const supremacy = solveSupremacy(expectancy, totalGoals)

  const lambdaHome = clamp(totalGoals / 2 + supremacy / 2, MIN_LAMBDA, totalGoals - MIN_LAMBDA)
  const lambdaAway = clamp(totalGoals / 2 - supremacy / 2, MIN_LAMBDA, totalGoals - MIN_LAMBDA)

  return poissonOutcome(lambdaHome, lambdaAway)
}

/**
 * Igual a predictMatch, mas resolvendo os ratings pelo nome do time.
 *
 * Time sem rating entra com BASE_RATING (1500) — nao desaparece nem herda valor
 * de outro time. `sample` e quantos times tem rating no conjunto, para o numero
 * nunca aparecer solto na tela.
 */
export function predictFromRatings(
  ratings: Map<string, number>,
  home: string,
  away: string,
  options?: { homeAdvantage?: number; totalGoals?: number }
): MatchProb {
  const homeRating = ratings.get(home) ?? BASE_RATING
  const awayRating = ratings.get(away) ?? BASE_RATING
  const probs = predictMatch(homeRating, awayRating, options)
  return { ...probs, source: 'elo+poisson', sample: ratings.size }
}

const OUTCOMES: Array<'home' | 'draw' | 'away'> = ['home', 'draw', 'away']

/**
 * Brier multiclasse: media de sum_k (p_k - 1{resultado=k})^2.
 *
 * Escala 0-2 (nao divide por 3 classes, de proposito — assim o valor e lido
 * direto contra a referencia uniforme, que da exatamente 2/3 ~= 0.667). Menor e
 * melhor; 0 e previsao perfeita.
 */
export function brierScore(rows: ProbOutcome[]): number {
  if (!rows.length) return Number.NaN
  let sum = 0
  for (const row of rows) {
    for (const key of OUTCOMES) {
      const indicator = row.outcome === key ? 1 : 0
      const diff = row.probs[key] - indicator
      sum += diff * diff
    }
  }
  return sum / rows.length
}

/** Log loss medio: media de -ln(P(resultado)). Referencia uniforme = ln 3. */
export function logLoss(rows: ProbOutcome[]): number {
  if (!rows.length) return Number.NaN
  let sum = 0
  for (const row of rows) {
    // Piso para log(0): um 0 absoluto e uma promessa que nenhum modelo faz.
    const p = clamp(row.probs[row.outcome], 1e-15, 1)
    sum += -Math.log(p)
  }
  return sum / rows.length
}

function bucketLabel(index: number, buckets: number): string {
  const width = 100 / buckets
  const lo = width * index
  const hi = width * (index + 1)
  return `${lo.toFixed(0)}-${hi.toFixed(0)}%`
}

/**
 * Calibracao: quando o modelo diz X%, acontece X%?
 *
 * Cada jogo entra TRES vezes — uma por classe (casa/empate/fora) — porque essa e
 * a curva de confiabilidade multiclasse de verdade: agrupa cada probabilidade
 * declarada contra o que de fato ocorreu. Empate entra com peso igual ao dos
 * outros, que e justamente onde um modelo mal feito se revela. Por isso o n da
 * tabela e 3x o numero de jogos; o backtest mostra o n de jogos a parte.
 *
 * `predicted` = media das probabilidades da faixa; `observed` = frequencia real
 * do evento. Modelo calibrado: os dois numeros andam juntos. Faixa vazia nao sai
 * (n=0 nao e informacao).
 */
export function calibration(rows: ProbOutcome[], buckets = 5): CalibrationBucket[] {
  if (!rows.length || buckets < 1) return []

  const n = Math.floor(buckets)
  const count = new Array<number>(n).fill(0)
  const predicted = new Array<number>(n).fill(0)
  const observed = new Array<number>(n).fill(0)

  for (const row of rows) {
    for (const key of OUTCOMES) {
      const p = clamp(row.probs[key], 0, 1)
      const index = Math.min(Math.floor(p * n), n - 1)
      count[index] = (count[index] as number) + 1
      predicted[index] = (predicted[index] as number) + p
      observed[index] = (observed[index] as number) + (row.outcome === key ? 1 : 0)
    }
  }

  const out: CalibrationBucket[] = []
  for (let index = 0; index < n; index += 1) {
    const size = count[index] as number
    if (!size) continue
    out.push({
      bucket: bucketLabel(index, n),
      n: size,
      predicted: (predicted[index] as number) / size,
      observed: (observed[index] as number) / size,
    })
  }
  return out
}
