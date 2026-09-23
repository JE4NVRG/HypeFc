/**
 * Camada de cliente do HypeFC Pro.
 *
 * Regras que valem para tudo aqui:
 * - Sem NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY o modulo degrada
 *   em silencio: proConfigurado() = false e toda chamada devolve
 *   { ok: false, erro: 'loja-offline' }. Nada lanca excecao nao tratada.
 * - O token de acesso vive em localStorage['hypefc.token']. Ele e a unica
 *   credencial do navegador: as RPC validam o hash dele no banco.
 * - Erro de rede nunca sobe para a tela: vira { ok: false, erro: 'rede' }.
 * - Falamos com a API REST do Supabase (/rest/v1/rpc/<fn>) via fetch puro, que e
 *   exatamente o que o supabase-js faz por baixo. Sem dependencia nova, o bundle
 *   do painel publico nao cresce por causa de uma tela opcional.
 */

/** Chave do token no localStorage. Nao mude: e o que o resto do painel le. */
export const TOKEN_KEY = 'hypefc.token'

/** Limites do servidor (public._limite_do), espelhados so para rotular a UI. */
export const LIMITE_PLANO = { free: 3, pro: 20 } as const

export type Plano = 'free' | 'pro'

export interface Resultado {
  ok: boolean
  /** Codigo de erro do servidor (ex 'limite', 'codigo-invalido') ou do cliente
   *  ('loja-offline', 'rede', 'email-invalido', 'sem-acesso'). */
  erro?: string
}

export interface Perfil {
  email?: string
  nome?: string
  plan?: Plano
  status?: string
  seguidos?: number
  limite?: number
}

export interface Seguido {
  league_id: string
  team_id: string
  team_name: string
}

/** Resposta crua de uma RPC: sempre jsonb, sempre com ok:boolean. */
type Resposta = Resultado & Record<string, unknown>

const TIMEOUT_MS = 10000

function lerAmbiente(chave: 'NEXT_PUBLIC_SUPABASE_URL' | 'NEXT_PUBLIC_SUPABASE_ANON_KEY'): string {
  // Referencia literal: o Next inlina as NEXT_PUBLIC_* no build.
  const valor = chave === 'NEXT_PUBLIC_SUPABASE_URL'
    ? process.env.NEXT_PUBLIC_SUPABASE_URL
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return (valor ?? '').trim()
}

/** A loja (Supabase) esta configurada neste build? Sem isso, modo lista de espera. */
export function proConfigurado(): boolean {
  return lerAmbiente('NEXT_PUBLIC_SUPABASE_URL') !== '' && lerAmbiente('NEXT_PUBLIC_SUPABASE_ANON_KEY') !== ''
}

function urlApi(): string {
  return lerAmbiente('NEXT_PUBLIC_SUPABASE_URL').replace(/\/+$/, '')
}

/** Base do PostgREST: sem barra no fim, para nao gerar // no caminho do RPC. */
function texto(valor: unknown): string | undefined {
  return typeof valor === 'string' && valor.trim() !== '' ? valor : undefined
}

function numero(valor: unknown): number | undefined {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : undefined
}

function plano(valor: unknown): Plano | undefined {
  return valor === 'pro' || valor === 'free' ? valor : undefined
}

function emailValido(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
}

function lerToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(TOKEN_KEY)
  } catch {
    // localStorage bloqueado (modo privado, politica do navegador): segue sem token.
    return null
  }
}

function gravarToken(token: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // Sem storage o acesso simplesmente nao persiste; a sessao atual continua valida.
  }
}

/** O navegador tem token guardado? (nao valida no servidor — quem valida e pro_me) */
export function temToken(): boolean {
  return lerToken() !== null
}

/** Esquece o token neste navegador. O acesso no servidor continua, basta reativar. */
export function sair(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(TOKEN_KEY)
  } catch {
    // nada a fazer
  }
}

/**
 * Grava o token vindo da conta (login com Google). Existe separado de `sair`
 * porque a origem e outra: aqui o servidor ja autenticou o e-mail no JWT, e o
 * navegador so guarda o que voltou — nada e decidido do lado do cliente.
 */
export function aplicarToken(token: string): void {
  gravarToken(token)
}

/**
 * Limpa o que diz respeito à conta: o token local e a sessão do supabase-js.
 * Usado no "sair da conta" — sem isso a sessão do Google continuaria viva e o
 * próximo carregamento devolveria o acesso sem ninguém pedir.
 */
export function limparContaLocal(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(TOKEN_KEY)
    for (const chave of Object.keys(window.localStorage)) {
      if (chave.startsWith('hypefc.conta')) window.localStorage.removeItem(chave)
    }
  } catch {
    // storage indisponivel: a sessao expira sozinha
  }
}

/**
 * POST /rest/v1/rpc/<nome>. Devolve sempre uma Resposta; nunca lanca.
 * `ok` e recalculado de `=== true` porque jsonb de terceiro pode vir torto e
 * um "ok" nao-booleano seria tratado como sucesso silencioso.
 */
async function rpc(nome: string, params: Record<string, unknown>): Promise<Resposta> {
  if (!proConfigurado()) return { ok: false, erro: 'loja-offline' }

  const chave = lerAmbiente('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  const controller = typeof AbortController === 'undefined' ? null : new AbortController()
  const timer = controller ? setTimeout(() => controller.abort(), TIMEOUT_MS) : null

  try {
    const resposta = await fetch(`${urlApi()}/rest/v1/rpc/${nome}`, {
      method: 'POST',
      headers: {
        apikey: chave,
        Authorization: `Bearer ${chave}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(params),
      signal: controller ? controller.signal : undefined,
    })

    if (!resposta.ok) return { ok: false, erro: 'rede' }

    const dados: unknown = await resposta.json().catch(() => null)
    if (!dados || typeof dados !== 'object' || Array.isArray(dados)) return { ok: false, erro: 'rede' }

    const bruto = dados as Record<string, unknown>
    return { ...bruto, ok: bruto.ok === true }
  } catch {
    // Offline, DNS, CORS, timeout: a tela mostra "nao deu para falar com o servidor".
    return { ok: false, erro: 'rede' }
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function simples(bruto: Resposta): Resultado {
  return bruto.ok ? { ok: true } : { ok: false, erro: bruto.erro ?? 'rede' }
}

/**
 * Resgate pós-checkout: troca o id da sessão paga (que a Stripe devolve na URL
 * de retorno) pelo token da licença. É o que faz o Pro ligar sozinho, sem conta
 * e sem e-mail configurado. O id é secreto e só vale uma vez; o token fica no
 * navegador como em `ativar`.
 */
export async function resgatarSessao(sessionId: string): Promise<Resultado & { plan?: Plano }> {
  const sess = (sessionId ?? '').trim()
  if (sess === '') return { ok: false, erro: 'sessao-invalida' }
  if (!proConfigurado()) return { ok: false, erro: 'loja-offline' }

  const r = await rpc('pro_claim_session', { p_session: sess })
  if (!r.ok) return { ok: false, erro: r.erro ?? 'rede' }

  const token = texto(r.token)
  if (!token) return { ok: false, erro: 'rede' }

  gravarToken(token)
  return { ok: true, plan: plano(r.plano) }
}

/**
 * Lista de espera. E publica por design (nao precisa de acesso ativo).
 * Com a loja offline devolve 'loja-offline' sem tentar rede.
 */
export async function entrarLista(email: string, nome?: string, source?: string): Promise<Resultado> {
  if (!proConfigurado()) return { ok: false, erro: 'loja-offline' }
  const limpo = email.trim()
  if (!emailValido(limpo)) return { ok: false, erro: 'email-invalido' }
  const apelido = (nome ?? '').trim()
  const origem = (source ?? 'site').trim() || 'site'
  return simples(await rpc('join_waitlist', { p_email: limpo, p_nome: apelido || null, p_source: origem }))
}

/**
 * Troca o codigo de uso unico pelo token do acesso. Deu certo: o token fica em
 * localStorage e as chamadas seguintes se identificam por ele.
 */
export async function ativar(email: string, codigo: string): Promise<Resultado & { plan?: Plano }> {
  if (!proConfigurado()) return { ok: false, erro: 'loja-offline' }
  const limpo = email.trim()
  const cod = codigo.trim()
  if (!emailValido(limpo) || cod.length < 6) return { ok: false, erro: 'codigo-invalido' }

  const bruto = await rpc('pro_setup', { p_email: limpo, p_codigo: cod })
  if (!bruto.ok) return { ok: false, erro: bruto.erro ?? 'codigo-invalido' }

  const token = texto(bruto.token)
  if (!token) return { ok: false, erro: 'codigo-invalido' }

  gravarToken(token)
  return { ok: true, plan: plano(bruto.plan) }
}

/** Perfil do acesso atual. null = sem token, loja offline ou token que o servidor nao conhece. */
export async function eu(): Promise<Perfil | null> {
  const token = lerToken()
  if (!token || !proConfigurado()) return null

  const bruto = await rpc('pro_me', { p_token: token })
  if (!bruto.ok) {
    // 'sem-acesso' e definitivo (token desconhecido/revogado): limpa o storage.
    if (bruto.erro === 'sem-acesso') sair()
    return null
  }

  return {
    email: texto(bruto.email),
    nome: texto(bruto.nome),
    plan: plano(bruto.plan),
    status: texto(bruto.status),
    seguidos: numero(bruto.seguidos),
    limite: numero(bruto.limite),
  }
}

/**
 * Segue um time. erro='limite' quando o plano ja lotou — nesse caso os campos
 * seguidos/limite vem preenchidos para a tela explicar o teto sem chutar.
 */
export async function seguir(
  leagueId: string,
  teamId: string,
  teamName: string
): Promise<Resultado & { seguidos?: number; limite?: number; codigoErro?: 'limite' }> {
  const token = lerToken()
  if (!proConfigurado()) return { ok: false, erro: 'loja-offline' }
  if (!token) return { ok: false, erro: 'sem-acesso' }

  const id = teamId.trim()
  const nome = teamName.trim()
  if (!id || !nome) return { ok: false, erro: 'time-invalido' }

  const bruto = await rpc('follow_set', {
    p_token: token,
    p_league_id: leagueId.trim(),
    p_team_id: id,
    p_team_name: nome,
  })

  const seguidos = numero(bruto.seguidos)
  const limite = numero(bruto.limite)

  if (!bruto.ok) {
    return {
      ok: false,
      erro: bruto.erro ?? 'rede',
      seguidos,
      limite,
      codigoErro: bruto.erro === 'limite' ? 'limite' : undefined,
    }
  }

  return { ok: true, seguidos, limite }
}

/** Para de seguir um time. Idempotente: sumir da lista sem estar nela tambem da ok. */
export async function parar(teamId: string): Promise<Resultado> {
  const token = lerToken()
  if (!proConfigurado()) return { ok: false, erro: 'loja-offline' }
  if (!token) return { ok: false, erro: 'sem-acesso' }

  const id = teamId.trim()
  if (!id) return { ok: false, erro: 'time-invalido' }

  return simples(await rpc('follow_remove', { p_token: token, p_team_id: id }))
}

/** Times seguidos. Sem acesso/loja devolve [] em vez de erro — a lista simplesmente esta vazia. */
export async function seguidos(): Promise<Seguido[]> {
  const token = lerToken()
  if (!token || !proConfigurado()) return []

  const bruto = await rpc('follow_list', { p_token: token })
  if (!bruto.ok) return []

  const lista = bruto.follows
  if (!Array.isArray(lista)) return []

  const saida: Seguido[] = []
  for (const item of lista) {
    if (!item || typeof item !== 'object') continue
    const linha = item as Record<string, unknown>
    const team_id = texto(linha.team_id)
    const team_name = texto(linha.team_name)
    if (!team_id || !team_name) continue
    saida.push({ league_id: texto(linha.league_id) ?? '', team_id, team_name })
  }
  return saida
}

/** Guarda a inscricao push deste navegador no servidor (endpoint + chaves da inscricao). */
export async function assinarPush(s: { endpoint: string; p256dh: string; auth: string }): Promise<Resultado> {
  const token = lerToken()
  if (!proConfigurado()) return { ok: false, erro: 'loja-offline' }
  if (!token) return { ok: false, erro: 'sem-acesso' }
  if (!s.endpoint || !s.p256dh || !s.auth) return { ok: false, erro: 'inscricao-invalida' }

  const agente = typeof navigator === 'undefined' ? '' : navigator.userAgent

  return simples(
    await rpc('push_save', {
      p_token: token,
      p_endpoint: s.endpoint,
      p_p256dh: s.p256dh,
      p_auth: s.auth,
      p_user_agent: agente.slice(0, 200),
    })
  )
}

/** Desliga os alertas deste navegador. */
export async function cancelarPush(endpoint: string): Promise<Resultado> {
  const token = lerToken()
  if (!proConfigurado()) return { ok: false, erro: 'loja-offline' }
  if (!token) return { ok: false, erro: 'sem-acesso' }
  if (!endpoint) return { ok: false, erro: 'inscricao-invalida' }

  return simples(await rpc('push_delete', { p_token: token, p_endpoint: endpoint }))
}
