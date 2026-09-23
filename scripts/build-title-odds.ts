/**
 * Probabilidade de titulo, de G4 e de cair — por simulacao da temporada inteira.
 *
 * Por que existe: o site ja tem o rating Elo de cada time e a tabela de pontos,
 * mas nenhum dos dois responde a pergunta que todo torcedor faz. A resposta sai
 * de simular o calendario que falta muitas vezes, nao de um pitaco: cada jogo
 * restante e sorteado pelas probabilidades do proprio modelo e a temporada e
 * jogada ate o fim.
 *
 * Regra de honestidade (a mesma do resto do site): o modelo e calibrado e NAO
 * supera a ancora "melhor colocado vence" (favorito 46,5% = ancora 46,5%,
 * Brier 0,629 contra 0,667 do uniforme). Entao a chance publicada e a
 * consequencia da diferenca de rating entre os times, e vai rotulada assim.
 * Nao ha "palpite" aqui.
 *
 * Fonte do calendario: mesmo scoreboard da ESPN que alimenta o painel, so que
 * por MES (`dates=YYYYMM` devolve o mes inteiro numa requisicao) — o endpoint de
 * agenda por time parou de devolver jogos futuros, e era ele que deixava a
 * secao "proximos jogos" vazia.
 *
 * Uso: node --experimental-strip-types scripts/build-title-odds.ts [--sims=5000]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  DEFAULT_HOME_ADVANTAGE,
  predictFromRatings,
} from '../src/lib/matchProbability.ts'
import { HEADERS, LEAGUES } from './lib/replay.ts'

const argSims = process.argv.find((a) => a.startsWith('--sims='))
const SIMS = Math.max(500, Math.min(20000, Number(argSims?.split('=')[1] || 5000) || 5000))
const SEASON = 2026
const AGORA = new Date()

const RAIZ = resolve(import.meta.dirname, '..')

/**
 * Rodadas de cada campeonato. E fato do calendario, nao estimativa — serve para
 * saber quantas rodadas a ESPN AINDA NAO publicou. A ESPN publica ~6 semanas
 * adiante: em setembro, o Brasileirao tem o resto da temporada no ar (fecha em
 * dezembro) e as ligas europeias so ate dezembro, metade do campeonato. Simular
 * so o que esta publicado e chamar isso de "chance de titulo" seria mentira por
 * omissao, entao as rodadas que faltam entram como confronto medio e o arquivo
 * declara quantas foram publicadas e quantas foram aproximadas.
 */
const RODADAS: Record<string, number> = {
  BSA: 38,
  PL: 38,
  PD: 38,
  SA: 38,
  BL1: 34,
  FL1: 34,
  PPL: 34,
  DED: 34,
}

interface RatingsPayload {
  season: number
  model: { name: string; k: number; home_advantage: number }
  leagues: Record<
    string,
    { league_id: string; league_name: string; slug: string; ratings: Record<string, number> }
  >
}

/** Nome comparavel: sem acento, sem pontuacao — "Atletico-MG" = "Atletico MG". */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

async function pegarJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, { headers: HEADERS })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

interface Time {
  id: string
  nome: string
  ratingName: string
  pts: number
  jogos: number
  rating: number
}

/**
 * Tabela de pontos da liga. O formato muda entre ligas (umas vem em `children`,
 * outras direto em `standings`), entao os dois caminhos sao tentados e as
 * entradas sao deduplicadas por id.
 */
async function tabelaDePontos(
  slug: string
): Promise<Array<{ id: string; nome: string; curto: string; pts: number; jogos: number }>> {
  const dados = await pegarJson(
    `https://site.api.espn.com/apis/v2/sports/soccer/${slug}/standings?season=${SEASON}`
  )
  if (!dados) return []
  const grupos: any[] = []
  for (const filho of dados.children || []) {
    if (filho?.standings?.entries) grupos.push(...filho.standings.entries)
  }
  if (dados.standings?.entries) grupos.push(...dados.standings.entries)

  const vistos = new Map<string, { id: string; nome: string; curto: string; pts: number; jogos: number }>()
  for (const e of grupos) {
    const id = String(e?.team?.id ?? '')
    if (!id || vistos.has(id)) continue
    const stats: any[] = e?.stats || []
    const pontos = Number(stats.find((s) => s?.name === 'points')?.displayValue ?? NaN)
    const jogos = Number(stats.find((s) => s?.name === 'gamesPlayed')?.displayValue ?? NaN)
    if (!Number.isFinite(pontos)) continue
    vistos.set(id, {
      id,
      // displayName e o nome que a tabela do app mostra (src/lib/espnParse.ts);
      // casar por ele e o unico jeito de a linha encontrar a chance.
      nome: e?.team?.displayName || e?.team?.shortDisplayName || `Time ${id}`,
      curto: e?.team?.shortDisplayName || '',
      pts: pontos,
      jogos: Number.isFinite(jogos) ? jogos : 0,
    })
  }
  return [...vistos.values()]
}

interface JogoRestante {
  data: string
  casaId: string
  foraId: string
  casaCandidatos: string[]
  foraCandidatos: string[]
}

/** Meses de hoje ate dezembro — o suficiente para fechar a temporada 2026. */
function mesesRestantes(): string[] {
  const meses: string[] = []
  const cursor = new Date(Date.UTC(AGORA.getUTCFullYear(), AGORA.getUTCMonth(), 1))
  const fim = new Date(Date.UTC(SEASON, 11, 1))
  while (cursor <= fim) {
    meses.push(`${cursor.getUTCFullYear()}${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`)
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }
  return meses
}

async function jogosRestantes(slug: string): Promise<JogoRestante[]> {
  const saida: JogoRestante[] = []
  for (const mes of mesesRestantes()) {
    const dados = await pegarJson(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${mes}&limit=400`
    )
    for (const evento of dados?.events || []) {
      const comp = evento?.competitions?.[0]
      const estado = comp?.status?.type?.state
      if (estado === 'post') continue // ja acabou: o ponto dele ja esta na tabela
      const data = String(evento?.date || '')
      if (!data || new Date(data) <= AGORA) continue
      const casa = (comp?.competitors || []).find((c: any) => c?.homeAway === 'home')
      const fora = (comp?.competitors || []).find((c: any) => c?.homeAway === 'away')
      if (!casa?.team?.id || !fora?.team?.id) continue
      const candidatos = (t: any): string[] =>
        [t?.shortDisplayName, t?.name, t?.displayName, t?.abbreviation, t?.location]
          .filter((x): x is string => typeof x === 'string' && x.length > 1)
      saida.push({
        data,
        casaId: String(casa.team.id),
        foraId: String(fora.team.id),
        casaCandidatos: candidatos(casa.team),
        foraCandidatos: candidatos(fora.team),
      })
    }
  }
  return saida
}

function media(valores: number[]): number {
  if (!valores.length) return 1500
  return valores.reduce((a, b) => a + b, 0) / valores.length
}

async function porLiga(
  shortId: string,
  nome: string,
  slug: string,
  catalogo: RatingsPayload
): Promise<any | null> {
  const liga = catalogo.leagues[shortId]
  if (!liga || !Object.keys(liga.ratings || {}).length) return null

  const tabela = new Map(Object.entries(liga.ratings))
  const porNomeNormalizado = new Map<string, string>()
  for (const nomeRating of tabela.keys()) porNomeNormalizado.set(normalizar(nomeRating), nomeRating)

  const pontos = await tabelaDePontos(slug)
  if (pontos.length < 6) return null
  const jogos = await jogosRestantes(slug)

  // O rating de cada time sai do proprio scoreboard (mesma fonte que gerou o
  // arquivo de ratings): casa primeiro pelos nomes dos jogos restantes e, se o
  // time nao aparece mais na temporada, cai para o nome da tabela de pontos.
  const ratingPorId = new Map<string, string>()
  const apelidoPorId = new Map<string, string>()
  for (const j of jogos) {
    for (const [id, candidatos] of [
      [j.casaId, j.casaCandidatos],
      [j.foraId, j.foraCandidatos],
    ] as Array<[string, string[]]>) {
      if (!apelidoPorId.has(id) && candidatos.length) apelidoPorId.set(id, candidatos[0])
      if (ratingPorId.has(id)) continue
      for (const c of candidatos) {
        const achado = porNomeNormalizado.get(normalizar(c))
        if (achado) {
          ratingPorId.set(id, achado)
          break
        }
      }
    }
  }

  const curtoPorId = new Map(pontos.map((p) => [p.id, p.curto]))
  const mediaLiga = media([...tabela.values()])
  let semRating = 0
  const times: Time[] = pontos.map((p) => {
    let ratingName = ratingPorId.get(p.id)
    if (!ratingName) ratingName = porNomeNormalizado.get(normalizar(p.nome)) || ''
    if (!ratingName) {
      semRating += 1
      ratingName = `${p.nome} (media)`
      tabela.set(ratingName, mediaLiga)
    }
    return {
      id: p.id,
      nome: p.nome,
      ratingName,
      pts: p.pts,
      jogos: p.jogos,
      rating: tabela.get(ratingName) as number,
    }
  })

  const nomePorId = new Map(times.map((t) => [t.id, t.ratingName]))
  const nomeExibicao = new Map(times.map((t) => [t.ratingName, t.nome]))
  const calendario = jogos
    .map((j) => ({ casa: nomePorId.get(j.casaId), fora: nomePorId.get(j.foraId) }))
    .filter((j): j is { casa: string; fora: string } => Boolean(j.casa && j.fora))

  // Uma previsao por confronto unico: o mesmo par pode repetir no returno.
  const cache = new Map<string, { home: number; draw: number; away: number }>()
  const probabilidade = (casa: string, fora: string) => {
    const chave = `${casa}|${fora}`
    const guardado = cache.get(chave)
    if (guardado) return guardado
    const p = predictFromRatings(tabela, casa, fora, {
      homeAdvantage: catalogo.model?.home_advantage ?? DEFAULT_HOME_ADVANTAGE,
    })
    cache.set(chave, p)
    return p
  }

  const zona = pontos.length <= 18 ? 2 : shortId === 'BSA' ? 4 : 3

  // Quanto do campeonato a ESPN ainda nao publicou (ela publica ~6 semanas
  // adiante). Sem isso a chance de titulo europeia valeria so ate dezembro e
  // pareceria definitiva.
  const publicadasPorTime = new Map<string, number>()
  for (const j of calendario) {
    publicadasPorTime.set(j.casa, (publicadasPorTime.get(j.casa) || 0) + 1)
    publicadasPorTime.set(j.fora, (publicadasPorTime.get(j.fora) || 0) + 1)
  }
  const totalRodadas =
    RODADAS[shortId] ||
    Math.max(...times.map((t) => t.jogos + (publicadasPorTime.get(t.ratingName) || 0)))
  const faltandoPorTime = new Map<string, number>()
  let rodadasPublicadas = 0
  for (const t of times) {
    const conhecidas = t.jogos + (publicadasPorTime.get(t.ratingName) || 0)
    if (conhecidas > rodadasPublicadas) rodadasPublicadas = conhecidas
    faltandoPorTime.set(t.ratingName, Math.max(0, totalRodadas - conhecidas))
  }
  const rodadasAproximadas = Math.max(0, totalRodadas - rodadasPublicadas)

  const titulos = new Map<string, number>()
  const top4 = new Map<string, number>()
  const queda = new Map<string, number>()
  for (const t of times) {
    titulos.set(t.ratingName, 0)
    top4.set(t.ratingName, 0)
    queda.set(t.ratingName, 0)
  }

  for (let s = 0; s < SIMS; s += 1) {
    const pts = new Map(times.map((t) => [t.ratingName, t.pts]))
    // Copia por temporada simulada: cada time precisa completar suas rodadas.
    const faltandoNoSorteio = new Map(faltandoPorTime)
    for (const j of calendario) {
      const p = probabilidade(j.casa, j.fora)
      const sorteio = Math.random()
      if (sorteio < p.home) {
        pts.set(j.casa, (pts.get(j.casa) as number) + 3)
      } else if (sorteio < p.home + p.draw) {
        pts.set(j.casa, (pts.get(j.casa) as number) + 1)
        pts.set(j.fora, (pts.get(j.fora) as number) + 1)
      } else {
        pts.set(j.fora, (pts.get(j.fora) as number) + 3)
      }
    }
    // Rodadas que a ESPN ainda nao publicou: sorteio de confrontos dentro da
    // liga ate cada time completar suas rodadas. Aproximacao declarada — quem
    // joga contra quem nessas rodadas ainda nao existe no calendario publico.
    for (let r = 0; r < totalRodadas; r += 1) {
      const fila = times.map((t) => t.ratingName).filter((n) => (faltandoNoSorteio.get(n) as number) > 0)
      if (fila.length < 2) break
      for (let i = fila.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1))
        const troca = fila[i]
        fila[i] = fila[j]
        fila[j] = troca
      }
      for (let i = 0; i + 1 < fila.length; i += 2) {
        const casa = fila[i]
        const fora = fila[i + 1]
        faltandoNoSorteio.set(casa, (faltandoNoSorteio.get(casa) as number) - 1)
        faltandoNoSorteio.set(fora, (faltandoNoSorteio.get(fora) as number) - 1)
        const p = probabilidade(casa, fora)
        const sorteio = Math.random()
        if (sorteio < p.home) {
          pts.set(casa, (pts.get(casa) as number) + 3)
        } else if (sorteio < p.home + p.draw) {
          pts.set(casa, (pts.get(casa) as number) + 1)
          pts.set(fora, (pts.get(fora) as number) + 1)
        } else {
          pts.set(fora, (pts.get(fora) as number) + 3)
        }
      }
    }

    // Desempate: pontos e, depois, rating (o criterio real varia por liga —
    // saldo de gols nao existe na simulacao, e dizer o contrario seria mentir).
    const ordem = [...times].sort((a, b) => {
      const pa = pts.get(a.ratingName) as number
      const pb = pts.get(b.ratingName) as number
      return pb - pa || b.rating - a.rating
    })
    titulos.set(ordem[0].ratingName, (titulos.get(ordem[0].ratingName) as number) + 1)
    for (const t of ordem.slice(0, 4)) top4.set(t.ratingName, (top4.get(t.ratingName) as number) + 1)
    for (const t of ordem.slice(-zona)) queda.set(t.ratingName, (queda.get(t.ratingName) as number) + 1)
  }

  const saida = times
    .map((t) => ({
      // `team` e o nome que a tabela de classificacao usa (displayName) — e por
      // ele que a linha da tabela encontra a chance. `apelido` e o nome curto do
      // calendario ("Athletico-PR"), que cabe no bloco estreito do topo.
      team: t.nome,
      apelido: apelidoPorId.get(t.id) || curtoPorId.get(t.id) || t.nome,
      rating_name: t.ratingName,
      pos: pontos.findIndex((p) => p.id === t.id) + 1,
      pts: t.pts,
      jogos: t.jogos,
      rating: Math.round(t.rating * 10) / 10,
      p_titulo: Math.round(((titulos.get(t.ratingName) as number) / SIMS) * 1000) / 1000,
      p_g4: Math.round(((top4.get(t.ratingName) as number) / SIMS) * 1000) / 1000,
      p_zona: Math.round(((queda.get(t.ratingName) as number) / SIMS) * 1000) / 1000,
    }))
    .sort((a, b) => b.p_titulo - a.p_titulo || b.pts - a.pts)

  return {
    league_id: shortId,
    league_name: nome,
    slug,
    jogos_restantes: calendario.length,
    rodadas_totais: totalRodadas,
    rodadas_publicadas: rodadasPublicadas,
    rodadas_aproximadas: rodadasAproximadas,
    zona_rebaixamento: zona,
    times_sem_rating: semRating,
    times: saida,
  }
}

async function principal() {
  const catalogo: RatingsPayload = JSON.parse(
    readFileSync(resolve(RAIZ, 'public/data/ratings.json'), 'utf8')
  )
  const ligas: Record<string, any> = {}
  for (const [shortId, slug, nome] of LEAGUES) {
    process.stdout.write(`  ${shortId} (${slug})... `)
    const resultado = await porLiga(shortId, nome, slug, catalogo)
    if (!resultado) {
      console.log('sem base suficiente, pulando')
      continue
    }
    ligas[shortId] = resultado
    const lider = resultado.times[0]
    console.log(
      `${resultado.times.length} times · ${resultado.jogos_restantes} jogos restantes · lider ${lider.team} ${(lider.p_titulo * 100).toFixed(1)}%`
    )
  }

  const saida = {
    generated_at: new Date().toISOString(),
    season: SEASON,
    simulacoes: SIMS,
    metodo: `temporada simulada ${SIMS} vezes a partir da tabela de pontos atual e do calendario da ESPN, com as probabilidades Elo+Poisson do proprio site; desempate por pontos e rating`,
    aviso:
      'O modelo e calibrado e nao supera a ancora "melhor colocado vence": a chance de titulo e consequencia da diferenca de rating, nao um palpite. Zona = ultimos colocados, nao rebaixamento confirmado. Rodadas que a ESPN ainda nao publicou entram como confronto sorteado dentro da liga — o campo rodadas_aproximadas diz quantas.',
    leagues: ligas,
  }
  mkdirSync(resolve(RAIZ, 'public/data'), { recursive: true })
  writeFileSync(resolve(RAIZ, 'public/data/title-odds.json'), JSON.stringify(saida, null, 2))
  console.log(`\npublic/data/title-odds.json escrito (${Object.keys(ligas).length} ligas, ${SIMS} simulacoes cada)`)
}

principal().catch((erro) => {
  console.error('falhou:', erro)
  process.exit(1)
})
