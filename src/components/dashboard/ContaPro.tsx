'use client'

import { useCallback, useEffect, useState } from 'react'
import { BadgeCheck, Loader2, LogIn, LogOut } from 'lucide-react'

import {
  contaConfigurada,
  entrarComGoogle,
  estadoDaConta,
  sairDaConta,
  type ContaEstado,
} from '@/lib/conta'

/**
 * Conta HypeFC (Google) na aba Pro.
 *
 * Por que existe: o token do navegador resolve o acesso, mas não tem dono — se o
 * cliente limpar os dados ou trocar de celular, perde o Pro. Entrando com a
 * conta, o e-mail passa a ser o dono e o acesso volta em qualquer aparelho.
 *
 * O botão não libera nada por si: quem decide é a RPC `pro_conta_entrar`, que lê
 * o e-mail de dentro do JWT assinado pelo Supabase.
 *
 * Um bloco, um estado, um "Sair": este é o único cartão que fala de conta na
 * aba, e o CTA primário (ácido) continua sendo o de assinatura. Aqui o login é
 * apoio, não a ação principal.
 */

const ROTULO = 'text-[11px] font-semibold uppercase tracking-wider text-ink-3'
const CAIXA = 'rounded-lg border border-line bg-paper-2/40 p-3.5'
const BOTAO =
  'inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-line bg-paper-3/60 px-4 text-[13px] font-medium text-ink transition hover:bg-line/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/60 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-[36px]'
const BOTAO_FANTASMA =
  'inline-flex min-h-[44px] shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-line bg-paper-2/40 px-3 text-[13px] text-ink-2 transition hover:bg-paper-3/60 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/60 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-[36px]'

type Props = {
  /** Plano do acesso deste navegador (token local), quando existe. */
  plano?: 'free' | 'pro'
  seguindo?: number
  limite?: number
  /** Chamado ao sair, para a aba recarregar o acesso que vive no navegador. */
  onSairLocal?: () => void
}

function dataCurta(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR')
}

export default function ContaPro({ plano, seguindo, limite, onSairLocal }: Props) {
  const [estado, setEstado] = useState<ContaEstado | null>(null)
  const [ocupado, setOcupado] = useState<'entrar' | 'sair' | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const recarregar = useCallback(async () => {
    if (!contaConfigurada()) return
    setEstado(await estadoDaConta())
  }, [])

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  if (!contaConfigurada()) return null

  const entrar = async () => {
    setOcupado('entrar')
    const r = await entrarComGoogle()
    if (!r.ok) {
      setOcupado(null)
      setAviso('Não deu para abrir o login do Google agora. Tente de novo em instantes.')
    }
    // se deu certo, a página sai do ar em direção ao Google — nada a fazer aqui
  }

  const sair = async () => {
    setOcupado('sair')
    await sairDaConta()
    setEstado({ logado: false })
    setOcupado(null)
    onSairLocal?.()
    setAviso('Você saiu da conta. Para voltar a ter o Pro, entre de novo com o Google.')
  }

  if (estado?.logado) {
    const validade = estado.pro && estado.paidUntil ? dataCurta(estado.paidUntil) : ''
    return (
      <div className={CAIXA}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            {estado.foto ? (
              // eslint-disable-next-line @next/next/no-img-element -- foto do provedor; o next/image nao carrega no cockpit
              <img
                src={estado.foto}
                alt=""
                width={32}
                height={32}
                decoding="async"
                referrerPolicy="no-referrer"
                className="h-8 w-8 shrink-0 border border-rule object-cover"
              />
            ) : (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-rule bg-paper-3/60 text-ink-2">
                <BadgeCheck className="h-4 w-4" />
              </span>
            )}
            <div className="min-w-0">
              <div className={ROTULO}>Conta</div>
              <p className="truncate text-[13px] font-medium text-ink">{estado.email || 'conta Google'}</p>
              <p className="mt-0.5 text-[12px] text-ink-2">
                {estado.pro
                  ? `Pro ativo${validade ? ` até ${validade}` : ''}`
                  : 'esta conta ainda não tem assinatura'}
              </p>
              {typeof seguindo === 'number' && typeof limite === 'number' ? (
                <p className="mt-0.5 text-[11px] text-ink-3">
                  Neste navegador: {plano === 'pro' ? 'Pro' : 'Gratuito'} · {seguindo} de {limite} times seguidos
                </p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void sair()}
            disabled={ocupado !== null}
            className={BOTAO_FANTASMA}
            aria-label="Sair da conta Google"
          >
            {ocupado === 'sair' ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            Sair
          </button>
        </div>
        {aviso ? <p className="mt-2 text-[11px] leading-snug text-ink-3">{aviso}</p> : null}
      </div>
    )
  }

  return (
    <div className={CAIXA}>
      <div className={ROTULO}>Conta</div>
      <p className="mt-1.5 text-[13px] leading-snug text-ink-2">
        A assinatura fica na conta Google, não neste navegador. Entrando, o Pro volta em qualquer aparelho.
      </p>
      <button
        type="button"
        onClick={() => void entrar()}
        disabled={ocupado !== null}
        className={`${BOTAO} mt-2.5`}
      >
        {ocupado === 'entrar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
        Entrar com Google
      </button>
      <p className="mt-2 text-[11px] leading-snug text-ink-3">
        Sem conta, o painel gratuito continua funcionando normalmente.
      </p>
      {aviso ? <p className="mt-2 text-[11px] leading-snug text-carimbo">{aviso}</p> : null}
    </div>
  )
}
