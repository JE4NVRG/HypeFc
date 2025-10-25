'use client'

import { Github } from 'lucide-react'

export function Footer() {
  return (
    <footer className="mt-12 text-center space-y-3 py-6 border-t border-slate-800">
      <div className="flex justify-center items-center gap-4 text-xs text-slate-500">
        <span>HypeFC Dashboard</span>
        <span>•</span>
        <span>Dados atualizados diariamente às 6:00 (horário de Brasília)</span>
      </div>
      
      <div className="flex justify-center items-center gap-6 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span>Criado por</span>
          <a 
            href="https://github.com/JE4NVRG" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
          >
            <Github size={14} />
            <span className="font-medium">JEANVRG</span>
          </a>
        </div>
        
        <span>•</span>
        
        <div className="text-slate-500">
          <span>Sistema criado para empresa </span>
          <span className="font-medium text-slate-400">DEBAJEYU</span>
        </div>
      </div>
    </footer>
  )
}