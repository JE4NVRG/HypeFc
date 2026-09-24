"use client"

import { useRef } from 'react'

/**
 * A home e um cockpit, nao um pergaminho: o container tem altura de tela e cada
 * view rola por dentro (ou nem isso). Trocar de view substitui o conteudo em vez
 * de empilhar mais 2.000px de rolagem embaixo.
 *
 * Apresentacao (DESIGN.md): alvo de 44px no mobile, texto de UI em 13px,
 * secundario nunca abaixo de text-ink-3, foco em anel de tinta unico e
 * navegacao por setas conforme o padrao ARIA de tablist.
 */
export type ViewId = 'rodada' | 'liga' | 'record' | 'esportes' | 'pro'

interface ViewTabsProps {
  view: ViewId
  onChange: (view: ViewId) => void
  counts?: Partial<Record<ViewId, number | null>>
}

const VIEWS: Array<{ id: ViewId; label: string }> = [
  { id: 'rodada', label: 'Rodada' },
  { id: 'liga', label: 'Liga' },
  { id: 'record', label: 'Recorde' },
  { id: 'esportes', label: 'Esportes' },
  { id: 'pro', label: 'Pro' },
]

const ABA_BASE =
  'flex min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 text-[13px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/60 sm:min-h-[36px] sm:px-3'

export function ViewTabs({ view, onChange, counts }: ViewTabsProps) {
  const abas = useRef<Array<HTMLButtonElement | null>>([])

  function irPara(indice: number) {
    const i = (indice + VIEWS.length) % VIEWS.length
    onChange(VIEWS[i].id)
    abas.current[i]?.focus()
  }

  function aoTeclar(evento: React.KeyboardEvent<HTMLButtonElement>, indice: number) {
    if (evento.key === 'ArrowRight') {
      evento.preventDefault()
      irPara(indice + 1)
    } else if (evento.key === 'ArrowLeft') {
      evento.preventDefault()
      irPara(indice - 1)
    } else if (evento.key === 'Home') {
      evento.preventDefault()
      irPara(0)
    } else if (evento.key === 'End') {
      evento.preventDefault()
      irPara(VIEWS.length - 1)
    }
  }

  return (
    <div
      role="tablist"
      aria-label="Views do painel"
      className="flex items-center gap-1 overflow-x-auto rounded-xl border border-ink/[0.06] bg-ink/[0.02] p-1"
    >
      {VIEWS.map(({ id, label }, indice) => {
        const ativo = view === id
        const count = counts?.[id]
        return (
          <button
            key={id}
            ref={(el) => {
              abas.current[indice] = el
            }}
            type="button"
            id={`view-tab-${id}`}
            role="tab"
            aria-selected={ativo}
            aria-current={ativo ? 'page' : undefined}
            tabIndex={ativo ? 0 : -1}
            onClick={() => onChange(id)}
            onKeyDown={(evento) => aoTeclar(evento, indice)}
            className={`${ABA_BASE} ${
              ativo
                ? 'border-line bg-paper-3 font-semibold text-ink'
                : 'border-transparent font-medium text-ink-3 hover:bg-ink/[0.05] hover:text-ink active:bg-ink/[0.08]'
            }`}
          >
            {label}
            {typeof count === 'number' && count > 0 ? (
              <span
                className={`rounded px-1 py-0.5 font-mono text-[11px] leading-none ${
                  ativo ? 'bg-ink/10 text-ink' : 'bg-ink/5 text-ink-2'
                }`}
              >
                {count}
                <span className="sr-only"> jogos</span>
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
