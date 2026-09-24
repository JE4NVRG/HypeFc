"use client"

/**
 * Cadeado reutilizavel para os recursos Pro (ex.: passar de 3 times seguidos).
 *
 * O painel publico gratuito continua inteiro: o gate envolve so o pedaco que
 * depende do acesso. Enquanto a verificacao do token corre, nada pisca — a area
 * mantem a altura e o cadeado aparece so quando a resposta chega.
 */

import { useEffect, useState } from 'react'
import { Lock } from 'lucide-react'
import { LIMITE_PLANO, eu, proConfigurado, temToken, type Perfil } from '@/lib/proStore'

const CHECKOUT_URL = (process.env.NEXT_PUBLIC_CHECKOUT_URL ?? '').trim()

const PRECO = 'Pro R$ 9,90/mês ou R$ 79/ano: até 20 times seguidos, alerta antes da rodada e histórico do registro.'
const GRATIS = 'Grátis: painel completo e até 3 times seguidos.'

/* Mesmo padrao de acao do resto do produto: alvo de 44px no mobile e 36px no
   desktop, foco em anel de tinta unico. */
const ACAO =
  'inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-lg px-4 text-[12px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/60 sm:min-h-[36px]'

export interface ProGateProps {
  children: React.ReactNode
  /** Por que este pedaco esta bloqueado, em uma frase (ex: "mais de 3 times seguidos"). */
  motivo: string
  /** Titulo do cadeado. Default: "Recurso Pro". */
  titulo?: string
  /** Resultado ja conhecido pelo pai. Sem ele, o gate consulta o proprio acesso. */
  liberado?: boolean
  /** Caminho de upgrade (normalmente trocar para a aba Pro). */
  onUpgrade?: () => void
}

function ePro(perfil: Perfil | null): boolean {
  if (!perfil) return false
  if (typeof perfil.limite === 'number') return perfil.limite > LIMITE_PLANO.free
  return perfil.plan === 'pro'
}

export function ProGate({ children, motivo, titulo = 'Recurso Pro', liberado, onUpgrade }: ProGateProps) {
  const loja = proConfigurado()
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [checando, setChecando] = useState(liberado === undefined)

  useEffect(() => {
    if (liberado !== undefined) {
      setChecando(false)
      return
    }
    if (!temToken()) {
      setPerfil(null)
      setChecando(false)
      return
    }
    let vivo = true
    eu()
      .then((dados) => {
        if (!vivo) return
        setPerfil(dados)
        setChecando(false)
      })
      .catch(() => {
        if (!vivo) return
        setPerfil(null)
        setChecando(false)
      })
    return () => {
      vivo = false
    }
  }, [liberado])

  const pro = liberado ?? ePro(perfil)

  if (checando) {
    return (
      <div
        aria-busy="true"
        className="flex min-h-[44px] items-center rounded-xl border border-paper-3 bg-paper-2/30 px-3 text-[11px] text-ink-3"
      >
        Carregando…
      </div>
    )
  }

  if (pro) return <>{children}</>

  return (
    <div className="rounded-xl border border-paper-3 bg-paper-2/40 p-3">
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-ink-3">
        <Lock aria-hidden="true" className="h-3.5 w-3.5" />
        {titulo}
      </div>
      <p className="mt-1 text-[12px] leading-snug text-ink">{motivo}</p>
      <p className="mt-1 text-[11px] leading-snug text-ink-3">
        {GRATIS} {PRECO}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {CHECKOUT_URL ? (
          <a
            href={CHECKOUT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`${ACAO} bg-sinal text-paper hover:bg-sinal/90`}
          >
            Assinar Pro
          </a>
        ) : onUpgrade ? (
          <button
            type="button"
            onClick={onUpgrade}
            className={`${ACAO} border border-line bg-paper-3/60 font-medium text-ink hover:bg-line/60`}
          >
            Vendas abrindo — entre na lista
          </button>
        ) : (
          <span className="text-[11px] text-ink-3">Vendas abrindo: a lista de espera está na aba Pro.</span>
        )}
      </div>
      {!loja ? (
        <p className="mt-2 text-[11px] leading-snug text-carimbo">
          O registro online ainda não está ligado neste site: ativar acesso não grava nada aqui.
        </p>
      ) : null}
    </div>
  )
}
