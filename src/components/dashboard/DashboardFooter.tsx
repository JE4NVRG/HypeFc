import { Github } from 'lucide-react'

export function DashboardFooter({ source }: { source?: string }) {
  const label = source === 'football-data'
    ? 'Football-Data.org + ESPN'
    : source === 'espn'
      ? 'ESPN (dados publicos)'
      : 'Football-Data.org + ESPN'
  return (
    <footer className="border-t border-white/5 py-6">
      <div className="flex flex-col items-center gap-3 px-4 text-xs text-slate-600">
        <div className="flex items-center gap-4">
          <span>HypeFC Dashboard</span>
          <span className="text-slate-800">|</span>
          <span>Atualiza a cada 1 min com jogo ao vivo</span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/JE4NVRG"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-slate-500 transition-colors hover:text-white"
          >
            <Github className="h-3.5 w-3.5" />
            <span className="font-medium">JE4NVRG</span>
          </a>
          <span className="text-slate-800">|</span>
          <span className="text-slate-600">Dados: {label}</span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="text-slate-700">Painel informativo. Não é casa de aposta e não promete resultado.</span>
          <a href="termos" className="text-slate-500 underline decoration-slate-700 underline-offset-2 transition hover:text-slate-300">
            Termos
          </a>
          <a href="privacidade" className="text-slate-500 underline decoration-slate-700 underline-offset-2 transition hover:text-slate-300">
            Privacidade
          </a>
        </div>
      </div>
    </footer>
  )
}
