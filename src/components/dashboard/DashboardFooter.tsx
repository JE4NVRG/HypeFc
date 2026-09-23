import { Github } from 'lucide-react'

/**
 * Rodape do cockpit (DESIGN.md): o disclaimer legal e texto que o usuario le —
 * 11px no piso, em text-slate-400 (7,6:1), nunca slate-600/700.
 *
 * No mobile ele empilhava tres blocos (meta + links + disclaimer) e ocupava
 * 139px, 16% da tela; numa tela de 600px de altura isso zerava o painel de
 * jogos. Duas mudancas:
 *  1. a linha de meta ("HypeFC Dashboard · Atualiza a cada 1 min · Dados: ...")
 *     fica so a partir de sm — no celular ela repete o que o header ja mostra
 *     ("Atualizado as HH:MM" + o selo ao vivo);
 *  2. padding de baixo com safe-area, para o rodape nao cair na barra de gestos
 *     do iPhone.
 * Os links mantem o alvo de 44px no mobile: e o piso de toque do contrato.
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
    <footer className="border-t border-white/[0.06] px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 sm:px-4 sm:pb-4 sm:pt-3">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-0.5 sm:gap-3">
        {/* redundante no mobile: o header ja diz quando atualizou */}
        <div className="hidden flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-slate-400 sm:flex">
          <span>HypeFC Dashboard</span>
          <span aria-hidden="true" className="h-3 w-px bg-white/15" />
          <span>Atualiza a cada 1 min com jogo ao vivo</span>
          <span aria-hidden="true" className="h-3 w-px bg-white/15" />
          <span>Dados: {label}</span>
        </div>

        <nav aria-label="Projeto e documentos" className="flex flex-wrap items-center justify-center gap-0 sm:gap-1">
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

        <p className="max-w-2xl text-center text-[11px] leading-tight text-slate-400">
          Painel informativo. Não é casa de aposta e não promete resultado.
          {/* fonte dos dados: no mobile fica aqui, porque a linha de meta sai */}
          <span className="sm:hidden"> Dados: {label}.</span>
        </p>
      </div>
    </footer>
  )
}
