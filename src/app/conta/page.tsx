'use client'

/**
 * Area da conta (`/conta`): o lugar onde a pessoa ve o proprio acesso.
 *
 * Por que existe separado da aba Pro do painel: a aba Pro e a vitrine dentro do
 * painel; aqui e o "meu acesso" (plano, times seguidos, alerta e sair), que e o
 * que a pessoa procura depois de entrar. Mesmos componentes e mesmas RPCs: o que
 * decide o direito e o servidor, a tela so mostra o que voltou.
 *
 * Esta pagina nao rotaciona licenca sozinha: quem faz isso e o `ResgatePro`, montado
 * na home. Aqui, se a conta estiver sem licenca neste navegador, existe um botao
 * explicito de restaurar (rotacao dupla em duas telas ao mesmo tempo derrubaria o
 * token uma da outra).
 */

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { BellOff, BellRing, Loader2, LogOut } from 'lucide-react'

import { PublicShell } from '@/components/site/PublicShell'
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAIXA, LINK, ROTULO } from '@/components/site/estilos'
import { entrarComoAssinante, estadoDaConta, sairDaConta, type ContaEstado } from '@/lib/conta'
import { desinscrever, inscrever, pushDisponivel } from '@/lib/push'
import { eu, parar, seguidos, temToken, type Perfil, type Seguido } from '@/lib/proStore'

type Recado = { tom: 'ok' | 'erro' | 'info'; texto: string }

const CHECKOUT_URL = (process.env.NEXT_PUBLIC_CHECKOUT_URL ?? '').trim()

function dataCurta(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function RecadoLinha({ recado }: { recado: Recado | null }) {
  if (!recado) return null
  const cor =
    recado.tom === 'erro'
      ? 'border-carimbo/30 bg-carimbo/10 text-carimbo'
      : recado.tom === 'ok'
        ? 'border-verde/25 bg-verde/10 text-ink'
        : 'border-rule bg-paper-2/60 text-ink-2'
  return (
    <p role="status" aria-live="polite" className={`mt-3 rounded-lg border px-3 py-2 text-[12px] leading-snug ${cor}`}>
      {recado.texto}
    </p>
  )
}

export default function Conta() {
  const router = useRouter()
  const [carregando, setCarregando] = useState(true)
  const [estado, setEstado] = useState<ContaEstado | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [lista, setLista] = useState<Seguido[]>([])
  const [alerta, setAlerta] = useState<string | null>(null)
  const [alertaOk, setAlertaOk] = useState<boolean | null>(null)
  const [recado, setRecado] = useState<Recado | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [fotoOk, setFotoOk] = useState(true)

  const carregar = useCallback(async () => {
    setCarregando(true)
    const e = await estadoDaConta()
    setEstado(e)
    if (e.logado) {
      setPerfil(await eu())
      setLista(await seguidos())
      setAlertaOk(pushDisponivel())
      try {
        const registro = await navigator.serviceWorker.ready
        const sub = await registro.pushManager.getSubscription()
        setAlerta(sub ? sub.endpoint : null)
      } catch {
        setAlerta(null)
      }
    }
    setCarregando(false)
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  async function restaurar() {
    setOcupado('restaurar')
    setRecado(null)
    const r = await entrarComoAssinante()
    setOcupado(null)
    if (!r.logado) {
      setRecado({ tom: 'erro', texto: 'Não deu para carregar o acesso agora.' })
      return
    }
    if (r.erro) {
      setRecado({
        tom: 'erro',
        texto:
          r.erro === 'sem-assinatura'
            ? 'Essa conta ainda não tem assinatura ativa. O acesso gratuito continua no painel.'
            : 'Não deu para falar com o servidor agora. Tente de novo em instantes.',
      })
      return
    }
    setRecado({
      tom: 'ok',
      texto: r.pro
        ? 'Acesso Pro ligado à sua conta neste navegador.'
        : 'Acesso gratuito ligado à sua conta: até 3 times, sem alerta.',
    })
    await carregar()
  }

  async function soltar(teamId: string, nome: string) {
    setOcupado(teamId)
    setRecado(null)
    const r = await parar(teamId)
    setOcupado(null)
    if (!r.ok) {
      setRecado({ tom: 'erro', texto: `Não deu para parar de seguir ${nome} agora.` })
      return
    }
    setLista((atual) => atual.filter((item) => item.team_id !== teamId))
  }

  async function ligarAlerta() {
    setOcupado('alerta')
    setRecado(null)
    const r = await inscrever()
    setOcupado(null)
    if (!r.ok) {
      setRecado({
        tom: 'erro',
        texto:
          r.erro === 'permissao-negada'
            ? 'O navegador não autorizou as notificações. Dá para liberar nas configurações do site.'
            : 'Não deu para ligar os alertas neste navegador.',
      })
      return
    }
    setAlerta(r.endpoint ?? null)
    setRecado({ tom: 'ok', texto: 'Alertas ligados neste navegador.' })
  }

  async function desligarAlerta() {
    setOcupado('alerta')
    setRecado(null)
    const r = await desinscrever()
    setOcupado(null)
    if (!r.ok) {
      setRecado({ tom: 'erro', texto: 'Não deu para desligar os alertas agora.' })
      return
    }
    setAlerta(null)
    setRecado({ tom: 'ok', texto: 'Alertas desligados neste navegador.' })
  }

  async function sair() {
    setOcupado('sair')
    await sairDaConta()
    setOcupado(null)
    router.push('/')
  }

  const limite = perfil?.limite ?? 0
  const planoPro = perfil?.plan === 'pro'

  return (
    <PublicShell atual="conta">
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="text-[22px] font-bold tracking-tight text-ink sm:text-[26px]">Minha conta</h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">
          O acesso fica na conta, não no aparelho. Entrando em outro navegador, o plano e os times seguidos voltam.
        </p>

        {carregando ? (
          <p className="mt-6 flex items-center gap-2 text-[13px] text-ink-3">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando o seu acesso…
          </p>
        ) : !estado?.logado ? (
          <div className={`mt-6 ${CAIXA}`}>
            <p className={ROTULO}>Sem conta conectada</p>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
              Você não está conectado neste navegador. Entre com a sua conta para ver o plano, os times que segue e os
              alertas.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Link href="/entrar" className={BOTAO_PRIMARIO}>
                Entrar
              </Link>
              <Link href="/criar-conta" className={BOTAO_SECUNDARIO}>
                Criar conta grátis
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-3">
            {/* (a) identidade e plano */}
            <div className={CAIXA}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  {estado.foto && fotoOk ? (
                    // eslint-disable-next-line @next/next/no-img-element -- foto do provedor
                    <img
                      src={estado.foto}
                      alt=""
                      width={40}
                      height={40}
                      decoding="async"
                      referrerPolicy="no-referrer"
                      onError={() => setFotoOk(false)}
                      className="h-10 w-10 shrink-0 border border-rule object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="flex h-10 w-10 shrink-0 items-center justify-center border border-rule bg-paper-3/40 font-mono text-[15px] text-ink-2"
                    >
                      {(estado.email ?? '·').slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className={ROTULO}>Conta</p>
                    <p className="truncate text-[14px] font-medium text-ink">{estado.email ?? 'conta conectada'}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span
                        className={`inline-flex items-center border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${
                          planoPro ? 'border-verde/30 text-verde-2' : 'border-line text-ink-2'
                        }`}
                      >
                        {planoPro ? 'Pro' : perfil ? 'Gratuito' : 'Sem licença'}
                      </span>
                      <span className="text-[12px] text-ink-2">
                        {planoPro
                          ? `ativo até ${dataCurta(estado.paidUntil) || 'o fim do período'}`
                          : perfil
                            ? 'até 3 times seguidos, sem alerta'
                            : 'restaure o acesso abaixo'}
                      </span>
                    </p>
                  </div>
                </div>
                <button type="button" onClick={() => void sair()} disabled={ocupado !== null} className={BOTAO_SECUNDARIO}>
                  {ocupado === 'sair' ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                  Sair
                </button>
              </div>

              {!temToken() || !perfil ? (
                <div className="mt-3 border-t border-rule pt-3">
                  <p className="text-[12px] leading-snug text-ink-2">
                    Esta conta ainda não tem licença neste navegador.
                  </p>
                  <button
                    type="button"
                    onClick={() => void restaurar()}
                    disabled={ocupado !== null}
                    className={`${BOTAO_SECUNDARIO} mt-2`}
                  >
                    {ocupado === 'restaurar' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Restaurar o acesso neste navegador
                  </button>
                </div>
              ) : null}
            </div>

            {/* (b) assinatura quando não é Pro */}
            {!planoPro ? (
              <div className={CAIXA}>
                <p className={ROTULO}>Plano Pro</p>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
                  O Pro sobe para 20 times seguidos, liga o alerta antes da rodada e abre o histórico do registro. R$
                  9,90/mês ou R$ 79/ano.
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Link href="/pro" className={BOTAO_PRIMARIO}>
                    Ver o que o Pro libera
                  </Link>
                  {CHECKOUT_URL ? (
                    <a href={CHECKOUT_URL} target="_blank" rel="noopener noreferrer" className={BOTAO_SECUNDARIO}>
                      Assinar agora
                    </a>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* (c) times seguidos */}
            <div className={CAIXA}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className={ROTULO}>Times seguidos</p>
                <p className="font-mono text-[12px] text-ink-2">
                  {lista.length} de {limite || 3}
                </p>
              </div>
              {lista.length === 0 ? (
                <div className="mt-2">
                  <p className="text-[13px] leading-relaxed text-ink-2">
                    Você ainda não segue nenhum time. No painel, abra o confronto de um jogo e use o botão Seguir do
                    time.
                  </p>
                  <Link href="/" className={`${BOTAO_SECUNDARIO} mt-3`}>
                    Abrir o painel
                  </Link>
                </div>
              ) : (
                <ul className="mt-2 divide-y divide-rule">
                  {lista.map((item) => (
                    <li key={item.team_id} className="flex items-center justify-between gap-3 py-2">
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium text-ink">{item.team_name}</span>
                        <span className="text-[11px] text-ink-3">{item.league_id}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => void soltar(item.team_id, item.team_name)}
                        disabled={ocupado !== null}
                        aria-label={`Parar de seguir ${item.team_name}`}
                        className="inline-flex min-h-[44px] shrink-0 items-center rounded-lg border border-line bg-paper-2/40 px-3 text-[12px] text-ink-2 transition hover:bg-paper-3/60 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/60 disabled:opacity-50 sm:min-h-[36px]"
                      >
                        {ocupado === item.team_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Parar'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {!planoPro ? (
                <p className="mt-3 border-t border-rule pt-3 text-[12px] leading-snug text-ink-3">
                  No plano gratuito o teto é 3 times. O Pro acompanha até 20.
                </p>
              ) : null}
            </div>

            {/* (d) alertas */}
            <div className={CAIXA}>
              <div className="flex items-center gap-2">
                <BellRing className="h-4 w-4 text-ink-3" />
                <p className={ROTULO}>Alertas no navegador</p>
              </div>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
                O aviso chega antes da rodada, com o horário do jogo e a probabilidade medida. É informativo: não sugere
                aposta.
              </p>
              {alertaOk === null ? null : !alertaOk ? (
                <p className="mt-2 text-[13px] text-ink-2">Este navegador não aceita notificação do site.</p>
              ) : !planoPro ? (
                <p className="mt-2 text-[13px] leading-snug text-ink-2">
                  Alertas entram no Pro. Na conta gratuita você segue até 3 times, sem aviso antes da rodada.
                </p>
              ) : (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  {alerta ? (
                    <button
                      type="button"
                      onClick={() => void desligarAlerta()}
                      disabled={ocupado !== null}
                      className={BOTAO_SECUNDARIO}
                    >
                      {ocupado === 'alerta' ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellOff className="h-4 w-4" />}
                      Desligar alertas neste navegador
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void ligarAlerta()}
                      disabled={ocupado !== null}
                      className={BOTAO_SECUNDARIO}
                    >
                      {ocupado === 'alerta' ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
                      Ativar alertas neste navegador
                    </button>
                  )}
                </div>
              )}
              <p className="mt-2 text-[12px] leading-snug text-ink-3">
                Os alertas dependem da permissão deste navegador. O acesso à conta não.
              </p>
            </div>

            <RecadoLinha recado={recado} />

            <p className="text-[12px] leading-snug text-ink-3">
              Cobrança, cancelamento ou reembolso:{' '}
              <a className={LINK} href="mailto:jean@je4ndev.com">
                jean@je4ndev.com
              </a>
              . Detalhes em{' '}
              <Link className={LINK} href="/termos">
                Termos
              </Link>{' '}
              e{' '}
              <Link className={LINK} href="/privacidade">
                Privacidade
              </Link>
              .
            </p>
          </div>
        )}
      </div>
    </PublicShell>
  )
}
