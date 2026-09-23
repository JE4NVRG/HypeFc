#!/usr/bin/env node
/**
 * Alertas por push — a entrega do produto pago do HypeFC.
 *
 * O que este script faz, em uma passada:
 *   1. le os assinantes com plano pro ativo e o que cada um segue (follows);
 *   2. pergunta a ESPN quem joga HOJE entre os times seguidos (scoreboard do dia,
 *      a mesma API publica que o painel usa);
 *   3. monta o aviso do jogo — time, adversario, horario em America/Sao_Paulo e,
 *      quando existir rating dos dois lados, a probabilidade que o modelo ja
 *      publicou em public/data/ratings.json;
 *   4. entrega com Web Push (VAPID) nas inscricoes de `push_subs`;
 *   5. registra cada aviso em `alert_log` (chave: subscriber_id + event_key) e
 *      apaga as inscricoes que a Apple/Google ja deram como mortas (404/410).
 *
 * Regras que nao se negociam:
 * - Nada de numero inventado. Sem rating dos dois times, o texto sai sem a linha
 *   "modelo: ..." — ele nunca vira chute. E o texto e factual: quem joga, contra
 *   quem, que horas.
 * - Idempotencia: o alerta de um jogo so sai UMA vez por assinante. A chave e
 *   `event_key` = `<eventId>:rodada`, e o par (subscriber_id, event_key) tem
 *   unique no banco — rodar o cron duas vezes nao duplica o aviso.
 * - Sem configuracao (Supabase/VAPID) o script sai com codigo 0 e diz o que
 *   falta: cron nao deve marcar falha por falta de chave que o dono ainda vai
 *   colar no .env.local.
 * - Chaves e endpoints nunca aparecem inteiros no stdout: endpoint sai truncado
 *   nos ultimos 12 caracteres.
 *
 * Uso (rodar da raiz do repo, de onde o cron chama):
 *   npm run alertas                      envia a rodada de hoje
 *   npm run alertas -- --date 2026-09-20  outro dia (teste de um dia passado)
 *   npm run alertas -- --dry-run          mostra o que sairia, sem enviar/gravar
 *   npm run alertas -- --dry-run --fixture scripts/fixtures/alertas.json
 *                                         inspecao com dados locais (sem banco)
 *
 * Variaveis de ambiente (lidas do .env.local quando existir):
 *   SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) + SUPABASE_SERVICE_KEY  — banco
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY + VAPID_SUBJECT   — Web Push
 *   HYPEFC_SITE_URL (opcional) — base do link do alerta
 */

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import webpush from 'web-push'
import { normalizeTeamKey } from '../src/lib/espnParse.ts'
import { probabilidadeDoJogo, type RatingsPayload } from '../src/lib/ratings.ts'

// ------------------------------------------------------------------ constante

const ESPN_SITE = 'https://site.api.espn.com/apis/site/v2/sports'
const ESPN_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'HypeFC/0.2 (+https://github.com/JE4NVRG/HypeFc)',
}
const FUSO = 'America/Sao_Paulo'
/** Base do link do alerta: o site publicado (Pages com subpasta ou dominio). */
const SITE_PADRAO = 'https://je4nvrg.github.io/HypeFc/'
/** 6h de validade: alerta de jogo de hoje nao serve para amanha. */
const TTL_SEGUNDOS = 6 * 60 * 60

/**
 * Catalogo liga -> caminho na ESPN. Espelho de `lib/multiSport` (SPORTS): o
 * script roda fora do bundler, que so resolve specifier com extensao explicita,
 * e por isso nao da para importar o catalogo de la. Sao so ids e paths.
 */
const LIGAS: Record<string, { path: string; nome: string }> = {
  BSA: { path: 'soccer/bra.1', nome: 'Brasileirão Série A' },
  PL: { path: 'soccer/eng.1', nome: 'Premier League' },
  PD: { path: 'soccer/esp.1', nome: 'La Liga' },
  SA: { path: 'soccer/ita.1', nome: 'Serie A' },
  BL1: { path: 'soccer/ger.1', nome: 'Bundesliga' },
  FL1: { path: 'soccer/fra.1', nome: 'Ligue 1' },
  DED: { path: 'soccer/ned.1', nome: 'Eredivisie' },
  PPL: { path: 'soccer/por.1', nome: 'Primeira Liga' },
  ELC: { path: 'soccer/eng.2', nome: 'Championship' },
  CL: { path: 'soccer/uefa.champions', nome: 'Champions League' },
  NBA: { path: 'basketball/nba', nome: 'NBA' },
  NFL: { path: 'football/nfl', nome: 'NFL' },
  NHL: { path: 'hockey/nhl', nome: 'NHL' },
  MLB: { path: 'baseball/mlb', nome: 'MLB' },
  F1: { path: 'racing/f1', nome: 'Fórmula 1' },
  UFC: { path: 'mma/ufc', nome: 'UFC' },
  ATP: { path: 'tennis/atp', nome: 'ATP Tour' },
}

// ---------------------------------------------------------------------- tipos

export interface JogoHoje {
  eventId: string
  leagueId: string
  leagueName: string
  /** ISO do inicio, como a ESPN manda; null quando o payload nao trouxe. */
  kickoff: string | null
  home: string
  away: string
  /** Id do time na ESPN (a coluna `follows.team_id` guarda exatamente isso). */
  homeId: string | null
  awayId: string | null
  /** Nome do status da ESPN (STATUS_SCHEDULED, STATUS_FINAL, ...). */
  status: string
}

export interface PayloadAlerta {
  title: string
  body: string
  url: string
  tag: string
}

interface Assinante {
  id: string
  email?: string | null
  plan?: string | null
  status?: string | null
  paid_until?: string | null
}

interface Seguido {
  subscriber_id: string
  league_id: string
  team_id: string
  team_name: string
}

interface Inscricao {
  id: string
  subscriber_id: string
  endpoint: string
  p256dh: string
  auth: string
  fails?: number | null
}

interface Dados {
  assinantes: Assinante[]
  seguidos: Seguido[]
  inscricoes: Inscricao[]
  /** Pares (subscriber_id|event_key) ja registrados em alert_log. */
  paresAntigos: Set<string>
  /** Quantos assinantes pro estao com o periodo pago vencido (nao recebem). */
  vencidos: number
}

// ------------------------------------------------------------ funcoes puras

/** Data de hoje (ou a data do jogo) no fuso de Sao Paulo, como YYYY-MM-DD. */
function diaEmSaoPaulo(iso: string | null): string | null {
  if (!iso) return null
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return null
  return data.toLocaleDateString('en-CA', { timeZone: FUSO })
}

export function hojeEmSaoPaulo(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: FUSO })
}

/**
 * Horario do jogo em America/Sao_Paulo (HH:MM). null quando nao ha data: o texto
 * simplesmente omite a hora em vez de mostrar 00:00 ou um horario do servidor.
 */
export function horarioSaoPaulo(iso: string | null): string | null {
  if (!iso) return null
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return null
  return data.toLocaleTimeString('pt-BR', {
    timeZone: FUSO,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/**
 * Chave de idempotencia do aviso: um jogo, uma rodada, um aviso por assinante.
 * Estavel por construcao — depende so do id do evento na ESPN.
 */
export function eventKeyDe(jogo: { eventId: string }): string {
  return `${jogo.eventId}:rodada`
}

/** Endpoint nunca sai inteiro no log (identifica o aparelho do assinante). */
export function truncarEndpoint(endpoint: string): string {
  return `...${endpoint.slice(-12)}`
}

function porcento(valor: number): string {
  return `${Math.round(valor * 100)}%`
}

/**
 * Texto do alerta. Ex.:
 *   Flamengo x Palmeiras hoje 16:00 — modelo: 46% / 26% / 28% (registro publico, sem palpite)
 *
 * Sem rating dos dois lados a segunda parte NAO sai: o aviso continua verdadeiro
 * (quem joga, contra quem, que horas) e sem nenhum numero novo.
 */
export function montarPayload(jogo: JogoHoje, ratings: RatingsPayload | null): PayloadAlerta {
  const horario = horarioSaoPaulo(jogo.kickoff)
  const confronto = `${jogo.home} x ${jogo.away} hoje${horario ? ` ${horario}` : ''}`

  const prob = probabilidade(jogo, ratings)
  const corpo = prob
    ? `${confronto} — modelo: ${porcento(prob.home)} / ${porcento(prob.draw)} / ${porcento(prob.away)} (registro publico, sem palpite)`
    : confronto

  return {
    title: 'Seu time joga hoje',
    body: corpo,
    url: urlDoJogo(jogo),
    // tag por jogo: uma notificacao por confronto, entrega repetida substitui.
    tag: `hypefc-${jogo.eventId}`,
  }
}

/** Link direto do confronto no painel (?jogo=<id>&dia=YYYY-MM-DD). */
function urlDoJogo(jogo: JogoHoje): string {
  const base = (process.env.HYPEFC_SITE_URL || SITE_PADRAO).trim() || SITE_PADRAO
  const params = new URLSearchParams({ jogo: jogo.eventId })
  const dia = diaEmSaoPaulo(jogo.kickoff)
  if (dia) params.set('dia', dia)
  return `${base}${base.includes('?') ? '&' : '?'}${params.toString()}`
}

function probabilidade(jogo: JogoHoje, ratings: RatingsPayload | null) {
  const direto = probabilidadeDoJogo(ratings, jogo.leagueId, jogo.home, jogo.away)
  if (direto) return direto
  // Nome do time pode chegar diferente entre ESPN e tabela de ratings (sigla de
  // estado no meio, por exemplo). Tenta pelo nome normalizado; se ainda assim
  // nao achar, devolve null e o alerta sai sem numero nenhum.
  const aliases = comAliases(ratings, jogo)
  if (!aliases) return null
  return probabilidadeDoJogo(aliases.payload, jogo.leagueId, aliases.home, aliases.away)
}

/**
 * Copia o payload de ratings com os nomes da ESPN como chave, quando o time
 * existe na tabela com outro rotulo. Nao cria rating: so aponta o nome.
 */
function comAliases(
  payload: RatingsPayload | null,
  jogo: JogoHoje
): { payload: RatingsPayload; home: string; away: string } | null {
  const liga = payload?.leagues?.[jogo.leagueId]
  if (!payload || !liga) return null

  const porNome = new Map<string, [string, number]>()
  for (const nome of Object.keys(liga.ratings)) {
    porNome.set(normalizeTeamKey(nome), [nome, liga.ratings[nome] as number])
  }

  const casa = porNome.get(normalizeTeamKey(jogo.home))
  const fora = porNome.get(normalizeTeamKey(jogo.away))
  if (!casa || !fora) return null
  if (casa[0] === jogo.home && fora[0] === jogo.away) return null

  const ratings = { ...liga.ratings, [jogo.home]: casa[1], [jogo.away]: fora[1] }
  return {
    payload: { ...payload, leagues: { ...payload.leagues, [jogo.leagueId]: { ...liga, ratings } } },
    home: jogo.home,
    away: jogo.away,
  }
}

// --------------------------------------------------------------- ESPN (dia)

interface EventoEspn {
  id?: string | number
  date?: string
  status?: { type?: { name?: string } }
  competitions?: Array<{
    date?: string
    status?: { type?: { name?: string } }
    competitors?: Array<{
      homeAway?: string
      team?: { id?: string; displayName?: string; name?: string }
    }>
  }>
}

/** Parser puro do scoreboard do dia: nunca lanca, jogo incompleto fica de fora. */
export function jogosDoDia(payload: unknown, leagueId: string, leagueName: string): JogoHoje[] {
  const dados = (payload && typeof payload === 'object' ? payload : {}) as { events?: unknown[] }
  const eventos = Array.isArray(dados.events) ? dados.events : []
  const jogos: JogoHoje[] = []

  for (const bruto of eventos) {
    const evento = (bruto && typeof bruto === 'object' ? bruto : {}) as EventoEspn
    const competicao = (evento.competitions || [])[0] || {}
    const lados = competicao.competitors || []
    const casa = lados.find((lado) => lado.homeAway === 'home')?.team
    const fora = lados.find((lado) => lado.homeAway === 'away')?.team
    const id = evento.id === undefined || evento.id === null ? '' : String(evento.id)
    const nomeCasa = casa?.displayName || casa?.name || ''
    const nomeFora = fora?.displayName || fora?.name || ''
    if (!id || !nomeCasa || !nomeFora) continue

    jogos.push({
      eventId: id,
      leagueId,
      leagueName,
      kickoff: evento.date || competicao.date || null,
      home: nomeCasa,
      away: nomeFora,
      homeId: casa?.id ? String(casa.id) : null,
      awayId: fora?.id ? String(fora.id) : null,
      status: competicao.status?.type?.name || evento.status?.type?.name || 'STATUS_SCHEDULED',
    })
  }

  return jogos
}

/**
 * Jogo ja encerrado nao e aviso: quem recebe "joga hoje" as 09:00 esta no meio
 * do dia, nao depois do apito final.
 */
function jaAcabou(jogo: JogoHoje): boolean {
  const status = jogo.status.toUpperCase()
  return status.includes('FINAL') || status.includes('FULL_TIME')
}

async function scoreboardDoDia(pathLiga: string, diaIso: string): Promise<unknown | null> {
  const url = `${ESPN_SITE}/${pathLiga}/scoreboard?dates=${diaIso.replace(/-/g, '')}`
  try {
    const res = await fetch(url, { headers: ESPN_HEADERS })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

// -------------------------------------------------------- Supabase (REST)

interface Rest {
  url: string
  chave: string
}

/**
 * Cliente REST minimo (PostgREST) com a service key. A service key ignora RLS —
 * e por isso que ela existe so aqui, no Mac do dono, nunca no site publicado.
 */
async function rest<T>(cfg: Rest, caminho: string, init: RequestInit = {}): Promise<T[]> {
  const res = await fetch(`${cfg.url}/rest/v1/${caminho}`, {
    ...init,
    headers: {
      apikey: cfg.chave,
      Authorization: `Bearer ${cfg.chave}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...((init.headers as Record<string, string>) || {}),
    },
  })
  const corpo = await res.text()
  if (!res.ok) throw new Error(`Supabase ${res.status} em ${caminho.split('?')[0]}: ${corpo.slice(0, 200)}`)
  if (!corpo) return []
  try {
    const dados = JSON.parse(corpo)
    return Array.isArray(dados) ? dados : [dados]
  } catch {
    return []
  }
}

/** `in.(...)` em lotes: uma lista longa de ids nao pode virar URL quilometrica. */
function emLotes(valores: string[], tamanho = 80): string[][] {
  const lotes: string[][] = []
  for (let i = 0; i < valores.length; i += tamanho) lotes.push(valores.slice(i, i + tamanho))
  return lotes
}

async function listarPorIds<T>(
  cfg: Rest,
  tabela: string,
  coluna: string,
  select: string,
  ids: string[]
): Promise<T[]> {
  const linhas: T[] = []
  for (const lote of emLotes(ids)) {
    const lista = lote.map((valor) => encodeURIComponent(valor)).join(',')
    const query = `select=${select}&${coluna}=in.(${lista})`
    linhas.push(...(await rest<T>(cfg, `${tabela}?${query}`)))
  }
  return linhas
}

/** Registra o resultado do aviso. O par (subscriber_id, event_key) e unico. */
async function registrar(
  cfg: Rest,
  subscriberId: string,
  eventKey: string,
  ok: boolean,
  erro: string | null
): Promise<void> {
  try {
    await rest(cfg, 'alert_log?on_conflict=subscriber_id,event_key', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ subscriber_id: subscriberId, event_key: eventKey, ok, erro }]),
    })
  } catch (problema) {
    // Log de entrega nao pode derrubar a entrega: o proximo cron tenta registrar.
    console.error(`  aviso: nao registrei ${eventKey} em alert_log (${mensagem(problema)})`)
  }
}

async function marcarEntrega(cfg: Rest, inscricao: Inscricao, ok: boolean): Promise<void> {
  try {
    await rest(cfg, `push_subs?id=eq.${encodeURIComponent(inscricao.id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(
        ok
          ? { last_ok_at: new Date().toISOString(), fails: 0 }
          : { fails: (inscricao.fails ?? 0) + 1 }
      ),
    })
  } catch {
    // contador de saude da inscricao: se falhar, a entrega segue valendo
  }
}

async function removerInscricao(cfg: Rest, endpoint: string): Promise<void> {
  await rest(cfg, `push_subs?endpoint=eq.${encodeURIComponent(endpoint)}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  })
}

// -------------------------------------------------------------------- dados

function mensagem(problema: unknown): string {
  return problema instanceof Error ? problema.message : String(problema)
}

function carregarEnvLocal(): void {
  // O cron chama `npm run record` numa shell sem essas variaveis: quem as define
  // e o .env.local. Variavel ja exportada no ambiente tem precedencia (o
  // loadEnvFile nao sobrescreve o que ja existe).
  for (const arquivo of ['.env.local', '.env']) {
    const caminho = path.join(process.cwd(), arquivo)
    if (!existsSync(caminho)) continue
    try {
      process.loadEnvFile(caminho)
    } catch {
      // arquivo torto/vazio nao pode derrubar o cron; o que faltar e reportado
    }
  }
}

function lerRatings(): RatingsPayload | null {
  const caminho = path.join(process.cwd(), 'public', 'data', 'ratings.json')
  if (!existsSync(caminho)) return null
  try {
    return JSON.parse(readFileSync(caminho, 'utf8')) as RatingsPayload
  } catch {
    return null
  }
}

function lerFixture(caminho: string): { dados: Dados } {
  const bruto = JSON.parse(readFileSync(caminho, 'utf8')) as {
    subscribers?: Assinante[]
    follows?: Seguido[]
    push_subs?: Inscricao[]
    alert_log?: Array<{ subscriber_id: string; event_key: string }>
  }
  // Mesmo filtro do banco (`plan=eq.pro&status=eq.active` e paid_until no futuro):
  // a fixture serve para inspecionar a regra, entao ela passa pela regra.
  const agora = Date.now()
  const proAtivos = (bruto.subscribers || []).filter(
    (a) => a && a.id && a.plan === 'pro' && a.status === 'active'
  )
  const assinantes = proAtivos.filter((a) => !a.paid_until || new Date(a.paid_until).getTime() > agora)

  return {
    dados: {
      assinantes,
      seguidos: bruto.follows || [],
      inscricoes: bruto.push_subs || [],
      paresAntigos: new Set((bruto.alert_log || []).map((l) => `${l.subscriber_id}|${l.event_key}`)),
      vencidos: proAtivos.length - assinantes.length,
    },
  }
}

// --------------------------------------------------------------------- main

function valorDe(args: string[], nome: string): string | null {
  const indice = args.indexOf(nome)
  if (indice === -1) return null
  const valor = args[indice + 1]
  return valor && !valor.startsWith('--') ? valor : null
}

async function main(): Promise<void> {
  carregarEnvLocal()

  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const fixture = valorDe(args, '--fixture')
  const dataArg = valorDe(args, '--date')
  const dia = dataArg && /^\d{4}-\d{2}-\d{2}$/.test(dataArg) ? dataArg : hojeEmSaoPaulo()

  console.log(`Alertas HypeFC — rodada de ${dia}${dryRun ? ' (dry-run: nada e enviado nem gravado)' : ''}`)

  const ratings = lerRatings()
  if (!ratings) console.log('aviso: public/data/ratings.json ausente — os avisos saem sem a probabilidade do modelo')

  // --- 1. quem recebe ---------------------------------------------------
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
  const chave = process.env.SUPABASE_SERVICE_KEY || ''
  const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
  const privada = process.env.VAPID_PRIVATE_KEY || ''
  const assunto = process.env.VAPID_SUBJECT || 'mailto:jean@je4ndev.com'

  let dados: Dados
  let cfg: Rest | null = null

  if (fixture) {
    if (!dryRun) {
      console.error('modo fixture serve so para inspecao: use junto com --dry-run (nao existe banco de verdade aqui).')
      process.exit(2)
    }
    if (!existsSync(fixture)) {
      console.error(`fixture nao encontrada: ${fixture}`)
      process.exit(2)
    }
    dados = lerFixture(fixture).dados
    console.log(`(fixture ${fixture}: ${dados.assinantes.length} assinantes de teste, sem banco, sem envio)`)
  } else {
    if (url.length < 20 || chave.length < 40) {
      console.log('config pendente: defina SUPABASE_URL e SUPABASE_SERVICE_KEY no .env.local (service key do projeto HypeFC).')
      console.log('nada foi enviado — o cron pode seguir sem falhar.')
      return
    }
    cfg = { url, chave }

    const todos = await rest<Assinante>(
      cfg,
      'subscribers?select=id,email,plan,status,paid_until&plan=eq.pro&status=eq.active'
    )
    // Mesma regra de `_limite_do`: pro ativo com paid_until vencido nao recebe.
    const agora = Date.now()
    const vencidos = todos.filter(
      (a) => a.paid_until && new Date(a.paid_until).getTime() <= agora
    ).length
    const assinantes = todos.filter((a) => !a.paid_until || new Date(a.paid_until).getTime() > agora)

    if (!assinantes.length) {
      console.log(`assinantes pro: ${todos.length} (${vencidos} com periodo vencido)`)
      console.log('nenhum assinante pro ativo — nada a enviar.')
      return
    }

    const ids = assinantes.map((a) => a.id)
    const seguidos = await listarPorIds<Seguido>(cfg, 'follows', 'subscriber_id', 'subscriber_id,league_id,team_id,team_name', ids)
    const inscricoes = await listarPorIds<Inscricao>(
      cfg,
      'push_subs',
      'subscriber_id',
      'id,subscriber_id,endpoint,p256dh,auth,fails',
      ids
    )

    dados = { assinantes, seguidos, inscricoes, paresAntigos: new Set(), vencidos }
  }

  console.log(
    `assinantes pro: ${dados.assinantes.length}${dados.vencidos ? ` (+${dados.vencidos} com periodo vencido)` : ''} · times seguidos: ${dados.seguidos.length} · inscricoes de push: ${dados.inscricoes.length}`
  )

  const porAssinante = new Map<string, Seguido[]>()
  for (const linha of dados.seguidos) {
    const lista = porAssinante.get(linha.subscriber_id) || []
    lista.push(linha)
    porAssinante.set(linha.subscriber_id, lista)
  }

  const inscricoesPorAssinante = new Map<string, Inscricao[]>()
  for (const linha of dados.inscricoes) {
    if (!linha.endpoint) continue
    const lista = inscricoesPorAssinante.get(linha.subscriber_id) || []
    lista.push(linha)
    inscricoesPorAssinante.set(linha.subscriber_id, lista)
  }

  // --- 2. quem joga hoje ------------------------------------------------
  const ligas = Array.from(new Set(dados.seguidos.map((s) => s.league_id))).sort()
  if (!ligas.length) {
    console.log('nenhum time seguido ainda — nada a enviar.')
    return
  }

  const jogosPorLiga = new Map<string, JogoHoje[]>()
  const semSlug: string[] = []
  for (const ligaId of ligas) {
    const liga = LIGAS[ligaId]
    if (!liga) {
      semSlug.push(ligaId)
      continue
    }
    const payload = await scoreboardDoDia(liga.path, dia)
    if (!payload) {
      console.log(`  aviso: ESPN sem resposta para ${ligaId} em ${dia}`)
      continue
    }
    jogosPorLiga.set(ligaId, jogosDoDia(payload, ligaId, liga.nome).filter((jogo) => !jaAcabou(jogo)))
  }
  if (semSlug.length) console.log(`  aviso: liga sem caminho na ESPN, pulada: ${semSlug.join(', ')}`)

  // Jogos de hoje que interessam a alguem (dedupe por liga+evento+time seguido).
  const jogosDoPovo = new Map<string, JogoHoje>()
  for (const [assinanteId, seguidos] of porAssinante) {
    for (const seguido of seguidos) {
      for (const jogo of jogosPorLiga.get(seguido.league_id) || []) {
        if (!jogoEhDoSeguido(jogo, seguido)) continue
        jogosDoPovo.set(`${assinanteId}|${jogo.eventId}`, jogo)
      }
    }
  }
  const jogosDistintos = new Set(Array.from(jogosDoPovo.values()).map((jogo) => jogo.eventId))

  if (!jogosDistintos.size) {
    console.log(`nenhum jogo hoje (${dia}) entre os times seguidos — nada a enviar.`)
    return
  }
  console.log(`jogos de hoje com time seguido: ${jogosDistintos.size}`)

  // --- 3. idempotencia: o que ja foi registrado ------------------------
  if (cfg) {
    const chaves = Array.from(new Set(Array.from(jogosDoPovo.values()).map((jogo) => eventKeyDe(jogo))))
    const existentes = await listarPorIds<{ subscriber_id: string; event_key: string }>(
      cfg,
      'alert_log',
      'event_key',
      'subscriber_id,event_key',
      chaves
    )
    for (const linha of existentes) dados.paresAntigos.add(`${linha.subscriber_id}|${linha.event_key}`)
  }

  // --- 4. envio ---------------------------------------------------------
  if (!dryRun) {
    if (publica.length < 20 || privada.length < 20) {
      console.log('config pendente: defina NEXT_PUBLIC_VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY no .env.local (par VAPID do HypeFC).')
      console.log('nada foi enviado — o cron pode seguir sem falhar.')
      return
    }
    if (!assunto.startsWith('mailto:') && !assunto.startsWith('https://')) {
      console.log(`config pendente: VAPID_SUBJECT precisa comecar com mailto: ou https:// (esta "${assunto}").`)
      return
    }
    webpush.setVapidDetails(assunto, publica, privada)
  }

  let enviados = 0
  let falhas = 0
  let pulados = 0
  let removidos = 0
  let semInscricao = 0
  const mostrados = new Set<string>()
  // Endpoint que a Apple/Google ja declarou morto nesta rodada nao e tentado de
  // novo no jogo seguinte (a remocao so vale a partir do proximo fetch).
  const encerrados = new Set<string>()

  for (const assinante of dados.assinantes) {
    const seguidos = porAssinante.get(assinante.id) || []
    if (!seguidos.length) continue

    const alvos = inscricoesPorAssinante.get(assinante.id) || []
    const jogos = new Map<string, JogoHoje>()
    for (const seguido of seguidos) {
      for (const jogo of jogosPorLiga.get(seguido.league_id) || []) {
        if (jogoEhDoSeguido(jogo, seguido)) jogos.set(jogo.eventId, jogo)
      }
    }

    for (const jogo of jogos.values()) {
      const chave = eventKeyDe(jogo)
      const par = `${assinante.id}|${chave}`

      if (dados.paresAntigos.has(par)) {
        pulados += 1
        continue
      }
      dados.paresAntigos.add(par) // duas inscricoes iguais no lote nao viram dois avisos

      if (!alvos.length) {
        semInscricao += 1
        continue
      }

      const payload = montarPayload(jogo, ratings)

      if (dryRun) {
        // Amostra do texto real que sairia (dedupe por corpo: 1 linha por jogo).
        if (!mostrados.has(payload.body) && mostrados.size < 12) {
          mostrados.add(payload.body)
          console.log(`  [dry-run] ${payload.title} — ${payload.body} → ${payload.url}`)
        }
        enviados += alvos.length
        continue
      }

      let sucesso = 0
      let erro: string | null = null
      for (const alvo of alvos) {
        if (encerrados.has(alvo.endpoint)) continue
        try {
          const resposta = await webpush.sendNotification(
            { endpoint: alvo.endpoint, keys: { p256dh: alvo.p256dh, auth: alvo.auth } },
            JSON.stringify(payload),
            { TTL: TTL_SEGUNDOS }
          )
          const status = resposta?.statusCode ?? 201
          if (status >= 200 && status < 300) {
            sucesso += 1
            enviados += 1
            await marcarEntrega(cfg as Rest, alvo, true)
          } else {
            erro = `http-${status}`
          }
        } catch (problema) {
          const status = Number((problema as { statusCode?: number }).statusCode || 0)
          if (status === 404 || status === 410) {
            // Inscricao morta (app desinstalado, permissao revogada): sai da tabela.
            encerrados.add(alvo.endpoint)
            await removerInscricao(cfg as Rest, alvo.endpoint).catch(() => undefined)
            removidos += 1
            erro = `endpoint-expirado-${status}`
            console.log(`  inscricao expirada removida: ${truncarEndpoint(alvo.endpoint)} (${status})`)
          } else if (status === 401 || status === 403) {
            // Chave de servidor errada: nao adianta insistir nos outros alvos.
            throw new Error(`VAPID recusado pela Apple/Google (HTTP ${status}) — confira o par no .env.local`)
          } else {
            erro = status ? `http-${status}` : `rede: ${mensagem(problema).slice(0, 80)}`
            await marcarEntrega(cfg as Rest, alvo, false)
            console.log(`  falha no endpoint ${truncarEndpoint(alvo.endpoint)}: ${erro}`)
          }
        }
      }

      if (!sucesso) falhas += 1
      // `erro` nulo sem sucesso significa que todo endpoint ja tinha sido dado
      // como morto nesta rodada: o log diz isso em vez de gravar linha muda.
      await registrar(cfg as Rest, assinante.id, chave, sucesso > 0, sucesso > 0 ? null : erro || 'sem-endpoint-ativo')
    }
  }

  // --- 5. resumo --------------------------------------------------------
  console.log('---')
  console.log(`assinantes pro: ${dados.assinantes.length}${dados.vencidos ? ` (+${dados.vencidos} vencidos)` : ''}`)
  console.log(`jogos de times seguidos hoje: ${jogosDistintos.size}`)
  console.log(`${dryRun ? 'pushes que sairiam' : 'pushes enviados'}: ${enviados}`)
  console.log(`pulados por idempotencia: ${pulados}`)
  console.log(`endpoints removidos (404/410): ${removidos}`)
  if (semInscricao) console.log(`avisos sem inscricao de push (ninguem autorizou ainda): ${semInscricao}`)
  if (falhas) console.log(`avisos com falha de entrega: ${falhas}`)
}

/**
 * Um jogo interessa ao assinante se um dos dois lados e o time seguido.
 *
 * O id da ESPN decide (e para isso que `follows.team_id` existe); o nome
 * normalizado entra so como rede quando o id nao veio. Nada de "contem": parecer
 * com o nome nao e ser o time — aviso errado e pior que aviso faltando.
 */
function jogoEhDoSeguido(jogo: JogoHoje, seguido: Seguido): boolean {
  const id = (seguido.team_id || '').trim()
  if (id && (jogo.homeId === id || jogo.awayId === id)) return true

  const nome = normalizeTeamKey(seguido.team_name)
  if (!nome) return false
  return normalizeTeamKey(jogo.home) === nome || normalizeTeamKey(jogo.away) === nome
}

const executadoDireto =
  !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (executadoDireto) {
  main().catch((problema) => {
    console.error('entrega de alertas falhou:', mensagem(problema))
    process.exit(1)
  })
}
