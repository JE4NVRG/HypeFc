"use client"

/**
 * Aba Pro do painel.
 *
 * E uma VIEW (aba) como Rodada/Liga/Recorde: o container da home nao rola, quem
 * rola e este bloco por dentro. Nada aqui empurra o cockpit para baixo.
 *
 * O que a tela vende e o que ela recusa a vender esta no mesmo lugar de
 * proposito: o alerta e o registro medido sao o produto; o palpite nao existe.
 * Preco e limites vem do contrato do produto, nunca calculados na tela.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BellOff,
  BellRing,
  Check,
  Loader2,
  Plus,
  ShieldQuestion,
  Square,
} from 'lucide-react'
import ContaPro from './ContaPro'
import { VAPID_PUBLIC_KEY, pushDisponivel } from '@/lib/push'
import {
  LIMITE_PLANO,
  assinarPush,
  ativar,
  cancelarPush,
  entrarLista,
  eu,
  parar,
  proConfigurado,
  sair,
  seguir,
  seguidos,
  temToken,
  type Perfil,
  type Seguido,
} from '@/lib/proStore'

/** URL de checkout: quando existe, o botao principal vira assinatura de verdade. */
const CHECKOUT_URL = (process.env.NEXT_PUBLIC_CHECKOUT_URL ?? '').trim()

type Tom = 'ok' | 'erro' | 'info'
interface Recado {
  tom: Tom
  texto: string
}

/* Piso de toque 44px no mobile e foco visivel no anel de tinta (a cor de --ring
   tema): o botao de seguir time, os CTAs e os campos seguem o mesmo desenho. */
/* O CTA de assinatura e o unico acento acido da tela (direcao 002). Sem
   checkout aberto, o botao vira neutro: nao se vende o que nao esta ligado. */
const CTA =
  'inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-sinal px-4 text-[13px] font-semibold text-paper transition hover:bg-sinal/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/60 disabled:cursor-not-allowed disabled:opacity-50'
const CTA_NEUTRO =
  'inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-line bg-paper-3/60 px-4 text-[13px] font-semibold text-ink transition hover:bg-line/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/60 disabled:cursor-not-allowed disabled:opacity-50'
const BOTAO_SECUNDARIO =
  'inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-lg border border-line bg-paper-3/60 px-4 text-[13px] font-medium text-ink transition hover:bg-line/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/60 disabled:cursor-not-allowed disabled:opacity-50'
const BOTAO_FANTASMA =
  'inline-flex min-h-[44px] shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-line bg-paper-2/40 px-3 text-[13px] text-ink-2 transition hover:bg-paper-3/60 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/60 disabled:cursor-not-allowed disabled:opacity-50'
const CAMPO =
  'mt-1 h-11 w-full rounded-lg border border-line bg-paper/60 px-3 text-[14px] text-ink placeholder:text-ink-3 focus:border-ink/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/60'
const CAIXA = 'rounded-lg border border-paper-3 bg-paper/30 p-3.5'
const ROTULO = 'text-[11px] font-semibold uppercase tracking-wider text-ink-3'

/** Erro da loja -> frase curta. Nunca promete sucesso que nao aconteceu. */
const TEXTO_ERRO: Record<string, string> = {
  'loja-offline': 'Registro online ainda não ligado neste site: nada foi gravado aqui.',
  rede: 'Não deu para falar com o servidor agora. Tente de novo em instantes.',
  'sem-acesso': 'Este navegador não tem acesso ativo. Ative o código acima.',
  'email-invalido': 'Confira o e-mail: precisa ser um endereço válido.',
  limite: 'Limite do plano atingido.',
  'codigo-invalido': 'Código não confere com esse e-mail.',
  'codigo-ja-usado': 'Esse código já foi usado. Cada código ativa um navegador.',
  'codigo-expirado': 'Esse código passou da validade.',
  'acesso-cancelado': 'Esse acesso está cancelado.',
  'time-invalido': 'Time sem identificação na fonte: não dá para seguir.',
  'inscricao-invalida': 'O navegador não devolveu a inscrição de alerta completa.',
}

function textoErro(erro?: string): string {
  if (!erro) return 'Não deu certo agora.'
  return TEXTO_ERRO[erro] ?? `Não deu certo (${erro}).`
}

function emailValido(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())
}

function limiteDe(perfil: Perfil | null): number {
  if (!perfil) return LIMITE_PLANO.free
  if (typeof perfil.limite === 'number') return perfil.limite
  return perfil.plan === 'pro' ? LIMITE_PLANO.pro : LIMITE_PLANO.free
}

/**
 * Chave VAPID base64url -> Uint8Array (o formato que o pushManager aceita).
 * O buffer e criado explicitamente como ArrayBuffer: o applicationServerKey nao
 * aceita o ArrayBufferLike (SharedArrayBuffer) que a inferencia larga devolve.
 */
function chaveParaBytes(chave: string): Uint8Array<ArrayBuffer> {
  const base64 = chave.trim()
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalizado = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  try {
    const bruto = atob(normalizado)
    const bytes = new Uint8Array(new ArrayBuffer(bruto.length))
    for (let i = 0; i < bruto.length; i += 1) bytes[i] = bruto.charCodeAt(i)
    return bytes
  } catch {
    return new Uint8Array(new ArrayBuffer(0))
  }
}

/**
 * Cache curto da lista de seguidos: o painel tem uma penca de SeguirTimeBotao e
 * nao faz sentido uma RPC por botao. Qualquer mudanca local invalida o cache.
 */
let cacheLista: { em: number; itens: Seguido[] } | null = null
const CACHE_MS = 15000
const ouvintes = new Set<() => void>()

async function listaSeguida(forcar = false): Promise<Seguido[]> {
  const agora = Date.now()
  if (!forcar && cacheLista && agora - cacheLista.em < CACHE_MS) return cacheLista.itens
  const itens = await seguidos()
  cacheLista = { em: Date.now(), itens }
  return itens
}

export function avisarMudanca(): void {
  cacheLista = null
  // forEach em vez de for..of: o tsconfig nao define target es2015+.
  ouvintes.forEach((ouvinte) => ouvinte())
}

function RecadoLinha({ recado }: { recado: Recado | null }) {
  return (
    <p
      role="status"
      aria-live="polite"
      className={`mt-2 min-h-[16px] text-[12px] leading-snug ${
        recado?.tom === 'ok' ? 'text-ink-2' : recado?.tom === 'erro' ? 'text-carimbo' : 'text-ink-3'
      }`}
    >
      {recado?.texto ?? ''}
    </p>
  )
}

export function ProView() {
  // Constante do build: servidor e cliente leem o mesmo valor, sem divergencia.
  const loja = proConfigurado()

  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [lista, setLista] = useState<Seguido[]>([])
  const [carregando, setCarregando] = useState(true)
  const [pushOk, setPushOk] = useState<boolean | null>(null)
  const [inscricao, setInscricao] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [nome, setNome] = useState('')
  const [codigo, setCodigo] = useState('')

  const [recadoLista, setRecadoLista] = useState<Recado | null>(null)
  const [recadoAcesso, setRecadoAcesso] = useState<Recado | null>(null)
  const [recadoPush, setRecadoPush] = useState<Recado | null>(null)
  const [recadoTimes, setRecadoTimes] = useState<Recado | null>(null)
  const [ocupado, setOcupado] = useState<'lista' | 'acesso' | 'push' | 'times' | null>(null)

  const emailRef = useRef<HTMLInputElement | null>(null)

  // pushDisponivel() so existe no cliente: resolver depois de montar evita
  // divergencia entre o HTML exportado e o primeiro render do navegador.
  useEffect(() => {
    setPushOk(pushDisponivel())
  }, [])

  const recarregar = useCallback(async (forcar = false) => {
    if (!temToken()) {
      setPerfil(null)
      setLista([])
      setCarregando(false)
      return
    }
    const dados = await eu()
    setPerfil(dados)
    setLista(dados ? await listaSeguida(forcar) : [])
    setCarregando(false)
  }, [])

  useEffect(() => {
    void recarregar(true)
  }, [recarregar])

  // Seguir/parar em qualquer botao do painel atualiza o contador daqui.
  useEffect(() => {
    const ouvinte = () => {
      void recarregar(true)
    }
    ouvintes.add(ouvinte)
    return () => {
      ouvintes.delete(ouvinte)
    }
  }, [recarregar])

  // Ja existe inscricao de push neste navegador?
  useEffect(() => {
    if (pushOk !== true || !temToken()) return
    let vivo = true
    navigator.serviceWorker.ready
      .then((registro) => registro.pushManager.getSubscription())
      .then((sub) => {
        if (vivo) setInscricao(sub ? sub.endpoint : null)
      })
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [pushOk])

  const limite = limiteDe(perfil)
  const seguindo = lista.length

  const situacao = !loja
    ? 'Modo lista de espera'
    : perfil
      ? limite > LIMITE_PLANO.free
        ? 'Pro ativo'
        : 'Plano gratuito'
      : 'Acesso gratuito'

  async function pedirLista() {
    if (ocupado) return
    if (!emailValido(email)) {
      setRecadoLista({ tom: 'info', texto: 'Confira o e-mail antes de entrar na lista.' })
      emailRef.current?.focus()
      return
    }
    setOcupado('lista')
    setRecadoLista(null)
    try {
      const r = await entrarLista(email, nome, 'aba-pro')
      setRecadoLista(
        r.ok
          ? { tom: 'ok', texto: `Inscrição registrada para ${email.trim()}. O aviso das vendas sai por esse e-mail.` }
          : { tom: 'erro', texto: textoErro(r.erro) }
      )
    } finally {
      setOcupado(null)
    }
  }

  async function ativarAcesso(event: React.FormEvent) {
    event.preventDefault()
    if (ocupado) return
    setOcupado('acesso')
    setRecadoAcesso(null)
    try {
      const r = await ativar(email, codigo)
      if (!r.ok) {
        setRecadoAcesso({ tom: 'erro', texto: textoErro(r.erro) })
        return
      }
      setCodigo('')
      const dados = await eu()
      setPerfil(dados)
      setLista(await listaSeguida(true))
      setRecadoAcesso({
        tom: 'ok',
        texto: `Acesso ativo${dados?.nome ? `: ${dados.nome}` : ''}, plano ${
          dados?.plan === 'pro' ? 'Pro' : 'Gratuito'
        }, até ${limiteDe(dados)} times seguidos.`,
      })
    } finally {
      setOcupado(null)
    }
  }

  async function ligarAlertas() {
    if (ocupado) return
    if (pushOk !== true) {
      setRecadoPush({ tom: 'info', texto: 'Alertas indisponíveis neste navegador.' })
      return
    }
    if (!temToken()) {
      setRecadoPush({ tom: 'erro', texto: 'Ative o acesso antes de ligar os alertas.' })
      return
    }
    setOcupado('push')
    setRecadoPush(null)
    try {
      if (typeof Notification === 'undefined') {
        setRecadoPush({ tom: 'info', texto: 'Alertas indisponíveis neste navegador.' })
        return
      }
      const permissao = await Notification.requestPermission()
      if (permissao !== 'granted') {
        setRecadoPush({
          tom: 'erro',
          texto: 'O navegador não autorizou as notificações. Dá para liberar nas configurações do site.',
        })
        return
      }
      const registro = await navigator.serviceWorker.ready
      const existente = await registro.pushManager.getSubscription()
      const nova = existente ?? (await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: chaveParaBytes(VAPID_PUBLIC_KEY),
      }))
      const json = nova.toJSON()
      const endpoint = json.endpoint ?? nova.endpoint
      const p256dh = json.keys?.p256dh ?? ''
      const auth = json.keys?.auth ?? ''
      const r = await assinarPush({ endpoint, p256dh, auth })
      if (r.ok) {
        setInscricao(endpoint)
        setRecadoPush({ tom: 'ok', texto: 'Alertas ligados neste navegador.' })
        return
      }
      setRecadoPush({ tom: 'erro', texto: textoErro(r.erro) })
    } catch {
      setRecadoPush({ tom: 'erro', texto: 'Não deu para ligar os alertas neste navegador.' })
    } finally {
      setOcupado(null)
    }
  }

  async function desligarAlertas() {
    if (ocupado || !inscricao) return
    setOcupado('push')
    setRecadoPush(null)
    try {
      const registro = await navigator.serviceWorker.ready
      const sub = await registro.pushManager.getSubscription()
      if (sub) await sub.unsubscribe()
      const r = await cancelarPush(inscricao)
      setInscricao(null)
      setRecadoPush(
        r.ok
          ? { tom: 'ok', texto: 'Alertas desligados neste navegador.' }
          : { tom: 'erro', texto: textoErro(r.erro) }
      )
    } catch {
      setRecadoPush({ tom: 'erro', texto: 'Não deu para desligar os alertas agora.' })
    } finally {
      setOcupado(null)
    }
  }

  async function pararTime(teamId: string) {
    if (ocupado) return
    setOcupado('times')
    setRecadoTimes(null)
    try {
      const r = await parar(teamId)
      if (!r.ok) {
        setRecadoTimes({ tom: 'erro', texto: textoErro(r.erro) })
        return
      }
      avisarMudanca()
      setLista(await listaSeguida(true))
    } finally {
      setOcupado(null)
    }
  }

  function sairDaqui() {
    sair()
    setPerfil(null)
    setLista([])
    setInscricao(null)
    avisarMudanca()
    setRecadoAcesso({ tom: 'info', texto: 'Token removido deste navegador. Com o código você ativa de novo.' })
  }

  return (
    <div className="h-full overflow-y-auto pr-0.5">
      <section className="rounded-xl border border-paper-3 bg-paper-2/40 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-2">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-ink">Pro</h2>
            <p className="mt-1 text-[13px] leading-snug text-ink-2">
              Alerta antes da rodada e registro do que foi previsto — o palpite não está à venda.
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
              situacao === 'Pro ativo'
                ? 'border-ink/20 bg-ink/[0.08] text-ink'
                : 'border-line bg-paper-3/60 text-ink-2'
            }`}
          >
            {situacao}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {/* (a) gratis vs Pro, com o preco exato do contrato */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className={CAIXA}>
              <div className={ROTULO}>Grátis</div>
              <ul className="mt-2 space-y-1.5 text-[13px] leading-snug text-ink-2">
                <li>Painel completo: rodada, ligas, esportes e recorde público.</li>
                <li>Até 3 times seguidos.</li>
                <li>Sem alertas.</li>
              </ul>
            </div>
            <div className="rounded-lg border border-line bg-paper-3/40 p-3.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ink">Pro</span>
                <span className="font-mono text-base font-semibold text-ink">R$ 9,90/mês · R$ 79/ano</span>
              </div>
              <ul className="mt-2 space-y-1.5 text-[13px] leading-snug text-ink">
                <li>Até 20 times seguidos.</li>
                <li>Alerta antes da rodada.</li>
                <li>Histórico do registro: o que o modelo previa para quem você segue.</li>
              </ul>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {/* (b) a prova, com os numeros medidos e a leitura honesta */}
            <div className={CAIXA}>
              <div className={`flex items-center gap-1.5 ${ROTULO}`}>
                <ShieldQuestion className="h-4 w-4" />
                O que o modelo entrega (medido)
              </div>
              <div className="mt-2.5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-ink-3">Brier do modelo</div>
                  <div className="mt-0.5 font-mono text-xl font-semibold tabular-nums text-ink">0,629</div>
                  <div className="text-[11px] text-ink-3">n=1.203 jogos</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-ink-3">Chute uniforme</div>
                  <div className="mt-0.5 font-mono text-xl font-semibold tabular-nums text-ink">0,667</div>
                  <div className="text-[11px] text-ink-3">1/3 para cada lado</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-ink-3">Favorito do modelo</div>
                  <div className="mt-0.5 font-mono text-xl font-semibold tabular-nums text-ink">46,5%</div>
                  <div className="text-[11px] text-ink-3">acerto do palpite</div>
                </div>
                <div className="rounded-lg border border-rule bg-paper-2/40 px-2.5 py-1.5">
                  <div className="text-[11px] uppercase tracking-wider text-ink-3">Âncora melhor colocado</div>
                  <div className="mt-0.5 font-mono text-xl font-semibold tabular-nums text-ink">46,5%</div>
                  <div className="text-[11px] text-ink-3">mesma taxa, sem modelo</div>
                </div>
              </div>
              <p className="mt-3 rounded-lg border border-rule bg-paper-2/40 p-3 text-[13px] leading-snug text-ink-2">
                Prova de honestidade: calibrado, sem edge no palpite — o que vendemos é alerta e registro, não palpite.
              </p>
              <p className="mt-2 text-[12px] leading-snug text-ink-3">
                O favorito do modelo acerta a mesma taxa de olhar a classificação. A probabilidade vale como
                frequência, não como vantagem contra ninguém.
              </p>
            </div>

            {/* (g) o que o alerta e e o que ele nao e */}
            <div className={CAIXA}>
              <div className={`flex items-center gap-1.5 ${ROTULO}`}>
                <BellRing className="h-4 w-4" />
                O que o alerta faz
              </div>
              <ul className="mt-2 space-y-1.5 text-[13px] leading-snug text-ink-2">
                <li>
                  Avisa <span className="text-ink">quando o time joga</span> e a{' '}
                  <span className="text-ink">probabilidade do modelo</span> para aquele jogo.
                </li>
                <li>Não é palpite de aposta e não diz para apostar em nada.</li>
                <li>O HypeFC não é casa de aposta, não recebe aposta e não promete retorno financeiro.</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {/* (c) e (d) lista de espera, ativacao de acesso e estado do acesso */}
          <div className="grid grid-cols-1 gap-3">
            {/* Ordem da area de acesso: primeiro a assinatura (unico CTA acido da
                aba), depois a conta, e o codigo de compra atras de um detalhe.
                Antes eram dois cartoes de identidade e dois "Sair" no mesmo bloco. */}
            {CHECKOUT_URL ? (
              <a href={CHECKOUT_URL} target="_blank" rel="noopener noreferrer" className={CTA}>
                Assinar Pro
              </a>
            ) : (
              <button type="button" onClick={() => void pedirLista()} disabled={ocupado !== null} className={CTA_NEUTRO}>
                {ocupado === 'lista' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Vendas abrindo — entre na lista
              </button>
            )}

            <ContaPro plano={perfil?.plan} seguindo={seguindo} limite={limite} onSairLocal={sairDaqui} />

            {!loja ? (
              <p className="text-[12px] leading-snug text-carimbo">
                O registro online ainda não está ligado neste site: sua inscrição não é gravada aqui. O painel
                gratuito continua funcionando normalmente.
              </p>
            ) : null}

            <details className={CAIXA}>
              <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wider text-ink-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/60 [&::-webkit-details-marker]:hidden">
                Já comprei: tenho um código
                <span className="text-[11px] font-normal normal-case tracking-normal text-ink-3">abrir</span>
              </summary>
              <form onSubmit={(event) => void ativarAcesso(event)} className="mt-2.5">
              <p className="text-[12px] leading-snug text-ink-3">
                Quem comprou recebe um código de uso único por e-mail. Ele ativa este navegador.
              </p>
              <div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="pro-acesso-email" className="text-[12px] text-ink-3">
                    E-mail da compra
                  </label>
                  <input
                    id="pro-acesso-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="voce@email.com"
                    className={CAMPO}
                  />
                </div>
                <div>
                  <label htmlFor="pro-acesso-codigo" className="text-[12px] text-ink-3">
                    Código
                  </label>
                  <input
                    id="pro-acesso-codigo"
                    value={codigo}
                    onChange={(event) => setCodigo(event.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="ex: 8F3C1A9B"
                    className={`${CAMPO} font-mono uppercase tracking-widest`}
                  />
                </div>
              </div>
              <button type="submit" disabled={ocupado !== null} className={`${BOTAO_SECUNDARIO} mt-3 w-full`}>
                {ocupado === 'acesso' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Ativar acesso
              </button>
              <RecadoLinha recado={recadoAcesso} />
              </form>
            </details>

            <form onSubmit={(event) => { event.preventDefault(); void pedirLista() }} className={CAIXA}>
              <div className={ROTULO}>{CHECKOUT_URL ? 'Avisos do Pro' : 'Lista de espera'}</div>
              <p className="mt-1 text-[12px] leading-snug text-ink-3">
                {CHECKOUT_URL
                  ? 'A assinatura já está aberta. Se preferir esperar, deixe o e-mail: a gente avisa de novidade do Pro. Nada de cobrança aqui.'
                  : 'Sem checkout aberto ainda: a lista avisa quando as vendas começarem. Nada de cobrança aqui.'}
              </p>
              <div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="pro-lista-email" className="text-[12px] text-ink-3">
                    E-mail
                  </label>
                  <input
                    ref={emailRef}
                    id="pro-lista-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="voce@email.com"
                    className={CAMPO}
                  />
                </div>
                <div>
                  <label htmlFor="pro-lista-nome" className="text-[12px] text-ink-3">
                    Nome (opcional)
                  </label>
                  <input
                    id="pro-lista-nome"
                    value={nome}
                    onChange={(event) => setNome(event.target.value)}
                    autoComplete="name"
                    placeholder="Como te chamamos"
                    className={CAMPO}
                  />
                </div>
              </div>
              <button type="submit" disabled={ocupado !== null} className={`${BOTAO_SECUNDARIO} mt-3 w-full`}>
                {ocupado === 'lista' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Entrar na lista
              </button>
              <RecadoLinha recado={recadoLista} />
            </form>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {/* (e) alertas no navegador */}
            <div className={CAIXA}>
              <div className={`flex items-center gap-1.5 ${ROTULO}`}>
                <BellRing className="h-4 w-4" />
                Alertas no navegador
              </div>
              {pushOk === null ? (
                <p className="mt-2 text-[13px] text-ink-3">Verificando este navegador…</p>
              ) : pushOk ? (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {/* Um botao de cada vez: com inscricao viva, "ativar" de novo nao
                      faz sentido — o que o usuario precisa e poder desligar. */}
                  {inscricao ? (
                    <button
                      type="button"
                      onClick={() => void desligarAlertas()}
                      disabled={ocupado !== null}
                      className={BOTAO_SECUNDARIO}
                      aria-label="Desligar alertas neste navegador"
                    >
                      {ocupado === 'push' ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellOff className="h-4 w-4" />}
                      Desligar alertas neste navegador
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void ligarAlertas()}
                      disabled={ocupado !== null}
                      className={BOTAO_SECUNDARIO}
                      aria-label="Ativar alertas no navegador"
                    >
                      {ocupado === 'push' ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
                      Ativar alertas no navegador
                    </button>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-[13px] text-ink-2">Alertas indisponíveis neste navegador.</p>
              )}
              <p className="mt-2 text-[12px] leading-snug text-ink-3">
                O alerta chega antes da rodada com o horário do jogo e a probabilidade medida. É informativo: não
                sugere aposta.
              </p>
              <RecadoLinha recado={recadoPush} />
            </div>

            {/* (f) times seguidos com contador e botao de parar */}
            <div className={CAIXA}>
              <div className="flex items-baseline justify-between gap-2">
                <span className={ROTULO}>Times seguidos</span>
                <span className="font-mono text-[13px] tabular-nums text-ink">
                  {seguindo} de {limite} times
                </span>
              </div>
              {carregando ? (
                <p className="mt-2 text-[13px] text-ink-3">Carregando…</p>
              ) : lista.length === 0 ? (
                <p className="mt-2 text-[13px] leading-snug text-ink-2">
                  {temToken()
                    ? 'Nenhum time seguido ainda. Use Seguir no confronto do time.'
                    : 'Seguir time é recurso Pro: ative o acesso acima para usar.'}
                </p>
              ) : (
                <ul className="mt-2.5 space-y-2">
                  {lista.map((item) => (
                    <li key={item.team_id} className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{item.team_name}</span>
                      <span className="hidden shrink-0 font-mono text-[11px] text-ink-3 sm:inline">
                        {item.league_id}
                      </span>
                      <button
                        type="button"
                        onClick={() => void pararTime(item.team_id)}
                        disabled={ocupado !== null}
                        className={BOTAO_FANTASMA}
                        aria-label={`Parar de seguir ${item.team_name}`}
                      >
                        <Square className="h-3.5 w-3.5" />
                        Parar
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <RecadoLinha recado={recadoTimes} />
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

/**
 * Botao de seguir time para usar no confronto (RoundView/NextFixtures).
 * Estados: idle, seguindo e limite. Fica fora do fluxo de clique do card
 * (stopPropagation) porque a linha toda abre o detalhe do jogo.
 */
export function SeguirTimeBotao({
  leagueId,
  teamName,
  teamId,
}: {
  leagueId: string
  teamName: string
  teamId: string
}) {
  const [estado, setEstado] = useState<'idle' | 'seguindo' | 'limite'>('idle')
  const [nota, setNota] = useState('')
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    let vivo = true
    listaSeguida()
      .then((itens) => {
        if (vivo && itens.some((item) => item.team_id === teamId)) setEstado('seguindo')
      })
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [teamId])

  async function alternar(event: React.MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    if (ocupado || estado === 'limite') return
    setOcupado(true)
    setNota('')
    try {
      if (estado === 'seguindo') {
        const r = await parar(teamId)
        if (!r.ok) {
          setNota(textoErro(r.erro))
          return
        }
        avisarMudanca()
        setEstado('idle')
        return
      }

      if (!temToken()) {
        setNota('Seguir time é do Pro: ative o acesso na aba Pro.')
        return
      }

      const r = await seguir(leagueId, teamId, teamName)
      if (r.ok) {
        avisarMudanca()
        setEstado('seguindo')
        if (r.limite !== undefined && r.seguidos !== undefined && r.seguidos >= r.limite) {
          setNota(`Você chegou ao limite do plano: ${r.limite} times.`)
        }
        return
      }
      if (r.codigoErro === 'limite') {
        avisarMudanca()
        setEstado('limite')
        setNota(`Limite do plano: ${r.seguidos ?? '?'} de ${r.limite ?? '?'} times.`)
        return
      }
      setNota(textoErro(r.erro))
    } finally {
      setOcupado(false)
    }
  }

  const rotulo = estado === 'seguindo' ? 'Seguindo' : estado === 'limite' ? 'Limite' : 'Seguir'
  const classes =
    estado === 'seguindo'
      ? 'border-ink/20 bg-ink/[0.08] text-ink'
      : estado === 'limite'
        ? 'border-carimbo/30 bg-carimbo/10 text-carimbo'
        : 'border-line bg-paper-3/60 text-ink hover:bg-line/60'

  return (
    <button
      type="button"
      onClick={(event) => void alternar(event)}
      disabled={ocupado || estado === 'limite'}
      aria-pressed={estado === 'seguindo'}
      aria-label={`${rotulo}: ${teamName}${nota ? `, ${nota}` : ''}`}
      title={nota || undefined}
      className={`inline-flex min-h-[44px] w-full shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3 text-[13px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/60 disabled:cursor-not-allowed disabled:opacity-50 ${classes}`}
    >
      {ocupado ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : estado === 'seguindo' ? (
        <Check className="h-4 w-4" />
      ) : estado === 'limite' ? (
        <ShieldQuestion className="h-4 w-4" />
      ) : (
        <Plus className="h-4 w-4" />
      )}
      {rotulo}
    </button>
  )
}
