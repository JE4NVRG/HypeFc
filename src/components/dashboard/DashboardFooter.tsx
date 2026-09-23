import { Github } from 'lucide-react'

/**
 * Rodape do cockpit (DESIGN.md): o disclaimer legal e texto que o usuario le —
 * 11px no piso, em text-slate-400 (7,6:1), nunca slate-600/700. Os separadores
 * `|` viraram elementos decorativos (aria-hidden), que nao dependem de
 * contraste de texto. Links com alvo de 44px no mobile.
 */
const LINK_ALVO =
  'inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60 active:bg-white/10 sm:min-h-[36px]'

export function DashboardFooter({ source }: { source?: string }) {
  const label = source === 'football-data'
    ? 'Football-Data.org + ESPN'
    : source === 'espn'
      ? 'ESPN (dados públicos)'
      : 'Football-Data.org + ESPN'
  return (
    <footer className="border-t border-white/[0.06] px-3 py-3 sm:px-4 sm:py-4">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 text-center sm:gap-3">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-slate-400">
          <span>HypeFC Dashboard</span>
          <span aria-hidden="true" className="h-3 w-px bg-white/15" />
          <span>Atualiza a cada 1 min com jogo ao vivo</span>
          <span aria-hidden="true" className="h-3 w-px bg-white/15" />
          <span>Dados: {label}</span>
        </div>

        <nav aria-label="Projeto e documentos" className="flex flex-wrap items-center justify-center gap-1">
          <a
            href="https://github.com/JE4NVRG"
            target="_blank"
            rel="noopener noreferrer"
            className={LINK_ALVO}
          >
            <Github aria-hidden="true" className="h-4 w-4" />
            <span>JE4NVRG</span>
          </a>
          <a href="termos" className={LINK_ALVO}>
            Termos
          </a>
          <a href="privacidade" className={LINK_ALVO}>
            Privacidade
          </a>
        </nav>

        <p className="max-w-2xl text-[11px] leading-relaxed text-slate-400">
          Painel informativo. Não é casa de aposta e não promete resultado.
        </p>
      </div>
    </footer>
  )
}
