import { Github } from 'lucide-react'

export function DashboardFooter() {
  return (
    <footer className="border-t border-white/5 py-6">
      <div className="flex flex-col items-center gap-3 px-4 text-xs text-slate-600">
        <div className="flex items-center gap-4">
          <span>HypeFC Dashboard</span>
          <span className="text-slate-800">|</span>
          <span>Dados atualizados diariamente</span>
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
          <span className="text-slate-600">
            Powered by Football-Data.org
          </span>
        </div>
      </div>
    </footer>
  )
}
