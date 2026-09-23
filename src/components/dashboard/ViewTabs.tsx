"use client"

/**
 * A home e um cockpit, nao um pergaminho: o container tem altura de tela e cada
 * view rola por dentro (ou nem isso). Trocar de view substitui o conteudo em vez
 * de empilhar mais 2.000px de rolagem embaixo.
 */
export type ViewId = 'rodada' | 'liga' | 'record' | 'esportes'

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
]

export function ViewTabs({ view, onChange, counts }: ViewTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Views do painel"
      className="flex items-center gap-1 overflow-x-auto rounded-xl border border-white/[0.06] bg-white/[0.02] p-1"
    >
      {VIEWS.map(({ id, label }) => {
        const ativo = view === id
        const count = counts?.[id]
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={ativo}
            onClick={() => onChange(id)}
            className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400/50 ${
              ativo ? 'bg-white/[0.09] text-slate-100' : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
            }`}
          >
            {label}
            {typeof count === 'number' && count > 0 ? (
              <span className={`rounded px-1 font-mono text-[10px] ${ativo ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-slate-500'}`}>
                {count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
