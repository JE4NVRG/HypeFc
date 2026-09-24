/**
 * Cobertura do dado — de onde vem cada numero do painel, o que a fonte nao
 * entrega e o que o produto se recusa a estimar.
 *
 * Modulo puro (sem React, sem fetch): a UI le daqui e nao reescreve a regra.
 * As duas regras que a tela cita por nome vem da fonte de verdade:
 *
 * - `MIN_BUCKET_SAMPLE` (@/lib/hypeRecord): bucket abaixo do piso sai sem taxa.
 * - `splitsReconcile` (@/lib/splits): casa/fora so entra se fechar o total.
 *
 * Se a regra mudar no codigo, o texto do painel acompanha sozinho.
 */

import { MIN_BUCKET_SAMPLE } from '@/lib/hypeRecord'

/** Repo publico do projeto: dado versionado e codigo auditavel. */
export const REPO_URL = 'https://github.com/JE4NVRG/HypeFc'

export interface SourceFacts {
  /** Como a fonte aparece para quem le o painel. */
  name: string
  /** Host real consultado pelo navegador no modo estatico. */
  host: string
  /** O que a fonte exige para responder. */
  access: string
  /** Portas de entrada usadas pelo produto. */
  endpoints: string[]
}

export const DATA_SOURCE: SourceFacts = {
  name: 'ESPN (API pública, sem chave)',
  host: 'site.api.espn.com',
  access: 'Sem chave, sem login e sem cadastro: o navegador chama a ESPN direto',
  endpoints: ['scoreboard (rodada)', 'standings (tabela)', 'summary (detalhe do jogo)'],
}

export interface CoveragePoint {
  key: string
  label: string
  detail: string
}

/** O que a fonte nao da. Cada linha e um campo que existe no mundo e nao no payload. */
export const SOURCE_GAPS: CoveragePoint[] = [
  {
    key: 'xg',
    label: 'xG e mapa de calor',
    detail:
      'Não existe campo de xG nem de posição de finalização em fonte gratuita estável. Não há de onde estimar sem inventar.',
  },
  {
    key: 'publico',
    label: 'Público no Brasileirão',
    detail:
      'A ESPN manda 0 quando não publica o número (na Premier League manda o real). 0 em estádio com jogo é ausência de dado, não zero, então vira "—".',
  },
  {
    key: 'odds',
    label: 'Odds',
    detail:
      'Só entram quando a casa publica. O feed da rodada não traz odds; elas aparecem apenas no detalhe da partida, e o painel não inventa cotação.',
  },
  {
    key: 'narracao',
    label: 'Narração do feed',
    detail:
      'O texto corrido do feed vem em inglês e é descartado. Ficam os lances com minuto, autor e placar, o que dá para conferir sem traduzir nada.',
  },
]

/**
 * Onde o produto prefere nao mostrar a mostrar errado: a mesma regra em todas as
 * telas, nao um caso isolado deste painel.
 */
export const REFUSALS: CoveragePoint[] = [
  {
    key: 'amostra',
    label: 'Taxa com amostra pequena',
    detail: `Bucket de acerto com menos de ${MIN_BUCKET_SAMPLE} cards sai sem taxa: mostra o n e não inventa porcentagem.`,
  },
  {
    key: 'split',
    label: 'Split casa/fora',
    detail:
      'Só aparece se casa + fora fecharem exatamente o total de jogos da tabela (splitsReconcile). Se a janela não bate, sai "—" em vez de número errado.',
  },
  {
    key: 'escalacao',
    label: 'Escalação',
    detail:
      'Só quando publicada. Sem time divulgado, o bloco diz que a escalação não foi divulgada em vez de preencher 11 nomes.',
  },
  {
    key: 'publico',
    label: 'Público zerado',
    detail:
      'Público 0 publicado pela fonte vira "—". Zero é um número, ausência de dado também, e o painel não confunde os dois.',
  },
]

/** Posicao do produto sobre o score, para nao deixar leitura ambigua. */
export const SCORE_STANCE = {
  title: 'O score mede atenção e embalo',
  detail:
    'Não é palpite, não é probabilidade e não é sinal de aposta. Não existe modelo de resultado nem recomendação de mercado no painel, só o registro medido, com amostra à vista.',
}

export interface CadenceFact {
  key: string
  label: string
  value: string
  detail: string
  /** Verdadeiro quando este e o ritmo em vigor agora. */
  active: boolean
}

export const CADENCE = {
  liveSeconds: 60,
  idleSeconds: 300,
  /** O job que grava e liquida a rodada roda todo dia neste horario. */
  recordPublishHour: 9,
}

function isLive(liveCount?: number | null): boolean {
  return typeof liveCount === 'number' && Number.isFinite(liveCount) && liveCount > 0
}

/** Os tres ritmos do painel, com o que esta valendo marcado. */
export function cadenceFacts(liveCount?: number | null): CadenceFact[] {
  const live = isLive(liveCount)
  return [
    {
      key: 'live',
      label: 'Com jogo ao vivo',
      value: '60s',
      detail: 'Placar e minuto buscados de novo a cada 60 segundos.',
      active: live,
    },
    {
      key: 'idle',
      label: 'Sem jogo ao vivo',
      value: '5 min',
      detail: 'Sem bola rolando, o painel desacelera sozinho.',
      active: !live,
    },
    {
      key: 'recorde',
      label: 'Histórico de rodadas',
      value: 'diário, 09:00',
      detail:
        'A rodada é gravada antes dos jogos e liquidada todo dia às 09:00, versionada no repositório público.',
      active: false,
    },
  ]
}

export interface ProvenanceRow {
  key: string
  label: string
  value: string
}

export interface ProvenanceInput {
  stats?: { totalMatches: number; totalGoals: number } | null
  leagueCount?: number | null
  liveCount?: number | null
  lastUpdated?: string | null
}

function positive(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

/**
 * Linha de procedencia. So emite o fato que veio: campo ausente nao vira zero.
 * "0 ligas" seria mentira — o painel cobre 10 — entao liga sem numero nao entra.
 */
export function buildProvenance({
  stats,
  leagueCount,
  liveCount,
  lastUpdated,
}: ProvenanceInput): ProvenanceRow[] {
  const rows: ProvenanceRow[] = []

  const leagues = positive(leagueCount)
  if (leagues !== null) {
    rows.push({ key: 'ligas', label: 'Ligas cobertas', value: String(leagues) })
  }

  const matches = stats ? positive(stats.totalMatches) : null
  const goals = stats && Number.isFinite(stats.totalGoals) ? stats.totalGoals : null
  if (matches !== null) {
    rows.push({ key: 'jogos', label: 'Jogos lidos na rodada', value: matches.toLocaleString('pt-BR') })
    if (goals !== null && goals >= 0) {
      rows.push({ key: 'gols', label: 'Gols registrados nesses jogos', value: goals.toLocaleString('pt-BR') })
    }
  }

  const live = positive(liveCount)
  if (live !== null) {
    rows.push({ key: 'aovivo', label: 'Em andamento agora', value: String(live) })
  }

  const stamp = typeof lastUpdated === 'string' ? lastUpdated.trim() : ''
  rows.push({ key: 'leitura', label: 'Última leitura', value: stamp || '—' })

  return rows
}
