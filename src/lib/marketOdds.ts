/**
 * Odds publicadas -> probabilidade de mercado.
 *
 * Regra do produto: o que sai daqui e FATO DA FONTE, nao palpite nosso. A odd e
 * publicada pela casa (ESPN summary: `odds[]` / `pickcenter[]`, campo provider.name);
 * a probabilidade e apenas a odd convertida e normalizada, com a margem da casa
 * medida e devolvida a parte (`margin`). Nada aqui decide, recomenda ou projeta
 * resultado: os numeros so descrevem o que o mercado precificou.
 *
 * Onde a fonte cala, a saida cala: sem odd -> null (nunca 0), secao ausente ou
 * vazia -> lista vazia. Ausencia de odds e ausencia normal na ESPN (jogos sem
 * cobertura de casa de aposta), nao erro.
 *
 * Unidade dos numeros: `MarketLine.home/draw/away` ja vem em DECIMAL (o parser
 * converte americano/fractional). `MarketProb.*` sao probabilidades normalizadas
 * (somam 1 entre os resultados disponiveis) e `margin` e a soma bruta - 1.
 */

export interface MarketLine {
  provider: string
  home: number | null
  draw: number | null
  away: number | null
  over_under: number | null
  detail: string | null
}

export interface MarketProb {
  provider: string
  home: number
  draw: number | null
  away: number
  margin: number
  raw: MarketLine
}

/** Odd americana (-110, +145) para decimal. Fora da escala americana -> null. */
export function americanToDecimal(american: number | null): number | null {
  if (american === null || !Number.isFinite(american)) return null
  const abs = Math.abs(american)
  // escala americana so existe a partir de 100 (|-110|, |+145|); -50, +20 ou 2.5 nao sao odds americanas
  if (abs < 100) return null
  return american < 0 ? 1 + 100 / abs : 1 + american / 100
}

/** Probabilidade implicita bruta: 1/decimal. Decimal <= 1 nao e odd -> null. */
export function decimalToImplied(decimal: number | null): number | null {
  if (decimal === null || !Number.isFinite(decimal) || decimal <= 1) return null
  return round4(1 / decimal)
}

/**
 * Normaliza a linha para somar 1 entre os resultados disponiveis (remove a
 * margem da casa) e mede a margem bruta = soma - 1.
 * Sem os dois lados obrigatorios (home e away) -> null.
 */
export function impliedProbabilities(line: MarketLine): MarketProb | null {
  if (!line || typeof line !== 'object') return null

  const homeDecimal = toDecimal(line.home)
  const awayDecimal = toDecimal(line.away)
  const drawDecimal = toDecimal(line.draw)
  if (homeDecimal === null || awayDecimal === null) return null

  const homeImplied = 1 / homeDecimal
  const awayImplied = 1 / awayDecimal
  const drawImplied = drawDecimal === null ? null : 1 / drawDecimal
  const sum = homeImplied + awayImplied + (drawImplied ?? 0)
  if (!(sum > 0)) return null

  return {
    provider: line.provider,
    home: round4(homeImplied / sum),
    draw: drawImplied === null ? null : round4(drawImplied / sum),
    away: round4(awayImplied / sum),
    margin: round4(sum - 1),
    raw: line,
  }
}

/**
 * Le `odds[]` do summary da ESPN; se essa secao estiver ausente/vazia, cai para
 * `pickcenter[]` (mesmo formato). Linhas de provedores ja presentes em `odds[]`
 * sao ignoradas em `pickcenter[]` para nao publicar a mesma casa duas vezes.
 * Sem fonte identificavel (provider.name/id) a entrada e descartada.
 */
export function parseMarketOdds(payload: unknown): MarketLine[] {
  const root = asRecord(payload)
  if (!root) return []

  const lines: MarketLine[] = []
  for (const entry of section(root.odds)) {
    const line = toLine(entry)
    if (line) lines.push(line)
  }
  for (const entry of section(root.pickcenter)) {
    const line = toLine(entry)
    if (line && !lines.some((existing) => existing.provider === line.provider)) lines.push(line)
  }
  return lines
}

// --- internos ---

function round4(value: number): number {
  return Math.round(value * 1e4) / 1e4
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function section(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

/** Detecta o formato pelo sinal/valor: fractional "10/1", americano (|x| >= 100) ou decimal (1 < x < 100). */
function toDecimal(value: unknown): number | null {
  if (typeof value === 'string') {
    const raw = value.trim()
    if (raw === '') return null
    const fractional = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(raw)
    if (fractional) {
      const numerator = Number(fractional[1])
      const denominator = Number(fractional[2])
      if (!(denominator > 0)) return null
      const decimal = numerator / denominator + 1
      return decimal > 1 ? decimal : null
    }
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? scaleToDecimal(parsed) : null
  }
  if (typeof value === 'number') return scaleToDecimal(value)
  return null
}

function scaleToDecimal(value: number): number | null {
  if (!Number.isFinite(value) || value === 0) return null
  if (Math.abs(value) >= 100) return americanToDecimal(value) // -110, +300, 255
  if (value > 1) return value // decimal: 1.083, 2.5, 21.0
  return null // 0 < x <= 1 nao e odd
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.trim())
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function firstDecimal(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const decimal = toDecimal(source[key])
    if (decimal !== null) return decimal
  }
  return null
}

function providerName(value: unknown): string | null {
  if (typeof value === 'string' && value.trim() !== '') return value.trim()
  const provider = asRecord(value)
  if (!provider) return null
  const name = provider.name
  if (typeof name === 'string' && name.trim() !== '') return name.trim()
  const id = provider.id
  if (typeof id === 'string' && id.trim() !== '') return id.trim()
  if (typeof id === 'number' && Number.isFinite(id)) return String(id)
  return null
}

/**
 * Um lado do 1x2, SO de mercado declarado pela fonte. Gate deliberado: a ESPN
 * publica, no mesmo array `odds[]`, blocos cujo mercado nao esta nomeado em JSON
 * — o da Bet 365 em bra.1 traz so `homeTeamOdds.odds: { summary: "350/1", value: 351 }`,
 * sem `moneyline` no bloco. Medido ao vivo na rodada 20260920: esses valores se
 * repetem identicos entre partidas diferentes (4.51/1.02/6.01 em jogos distintos),
 * contradizem a linha publicada pela outra casa e somam 1.02 a 1.26 — nao e um 1x2.
 * Virar isso em "probabilidade de vitoria" seria invencao nossa, entao o bloco sem
 * mercado declarado e descartado inteiro (ausencia normal da fonte).
 *
 * Ordem de leitura quando o mercado esta declarado:
 *   1. `moneyline.home|draw|away` -> { odds, value } ou { close: { odds }, open: { odds } }
 *   2. `homeTeamOdds|drawOdds|awayTeamOdds.moneyLine` (americano cru ou decimal)
 * Em ambos os casos o valor passa pela deteccao de formato (americano / decimal / fractional).
 */
function sideDecimal(
  entry: Record<string, unknown>,
  side: 'home' | 'draw' | 'away',
  teamKey: string
): number | null {
  const moneyline = asRecord(entry.moneyline)
  const sideNode = moneyline ? asRecord(moneyline[side]) : null
  if (sideNode) {
    const direct = firstDecimal(sideNode, ['odds', 'value'])
    if (direct !== null) return direct
    for (const phase of ['close', 'open']) {
      const phaseNode = asRecord(sideNode[phase])
      if (!phaseNode) continue
      const phased = firstDecimal(phaseNode, ['odds', 'value'])
      if (phased !== null) return phased
    }
  }

  const team = asRecord(entry[teamKey])
  const moneyLine = team ? toDecimal(team.moneyLine) : null
  if (moneyLine !== null) return moneyLine

  return null
}

function toLine(entry: unknown): MarketLine | null {
  const record = asRecord(entry)
  if (!record) return null
  const provider = providerName(record.provider)
  if (!provider) return null

  const home = sideDecimal(record, 'home', 'homeTeamOdds')
  const draw = sideDecimal(record, 'draw', 'drawOdds')
  const away = sideDecimal(record, 'away', 'awayTeamOdds')
  if (home === null && draw === null && away === null) return null

  // overUnder e linha de total, nao odd: le como numero puro (224.5 nao e "+224" americano)
  const overUnder = readNumber(record.overUnder)
  const detail = record.details

  return {
    provider,
    home: home === null ? null : round4(home),
    draw: draw === null ? null : round4(draw),
    away: away === null ? null : round4(away),
    over_under: overUnder === null ? null : round4(overUnder),
    detail: typeof detail === 'string' && detail.trim() !== '' ? detail.trim() : null,
  }
}
