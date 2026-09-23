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

const PRECO = 'Pro R$ 9,90/mes ou R$ 79/ano: ate 20 times seguidos, alerta antes da rodada e historico do registro.'
const GRATIS = 'Gratis: painel completo e ate 3 times seguidos.'

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
        className="flex h-[52px] items-center rounded-xl border border-slate-800 bg-slate-900/30 px-3 text-[11px] text-slate-500"
      >
        Carregando…
      </div>
    )
  }

  if (pro) return <>{children}</>

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
        <Lock className="h-3 w-3" />
        {titulo}
      </div>
      <p className="mt-1 text-[11px] leading-snug text-slate-300">{motivo}</p>
      <p className="mt-1 text-[10px] leading-snug text-slate-500">
        {GRATIS} {PRECO}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {CHECKOUT_URL ? (
          <a
            href={CHECKOUT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60"
          >
            Assinar Pro
          </a>
        ) : onUpgrade ? (
          <button
            type="button"
            onClick={onUpgrade}
            className="inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-3 text-xs font-medium text-slate-200 transition hover:bg-slate-700/60 focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400/60"
          >
            vendas abrindo — entre na lista
          </button>
        ) : (
          <span className="text-[10px] text-slate-500">Vendas abrindo: a lista de espera esta na aba Pro.</span>
        )}
      </div>
      {!loja ? (
        <p className="mt-1.5 text-[10px] leading-snug text-amber-300/80">
          O registro online ainda nao esta ligado neste site: ativar acesso nao grava nada aqui.
        </p>
      ) : null}
    </div>
  )
}
