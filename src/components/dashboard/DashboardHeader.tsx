"use client"

import { Flame, RefreshCw, Wifi, WifiOff } from 'lucide-react'

interface DashboardHeaderProps {
  isLoading: boolean
  lastUpdated: string
  hasLiveMatches: boolean
  onRefresh: () => void
}

export function DashboardHeader({ isLoading, lastUpdated, hasLiveMatches, onRefresh }: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl">
      <div className="flex items-center justify-between px-3 py-3 sm:px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-red-600 shadow-lg shadow-orange-500/25">
            <Flame className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                HypeFC
              </h1>
              {hasLiveMatches && (
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  ao vivo
                </span>
              )}
            </div>
            <p className="hidden text-xs text-slate-500 sm:block">
              Dashboard de futebol em tempo real
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-1.5 text-xs text-slate-500 sm:flex">
            {lastUpdated ? (
              <>
                <Wifi className="h-3 w-3 text-emerald-500" />
                <span>{lastUpdated}</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3 text-slate-600" />
                <span>Sem dados</span>
              </>
            )}
          </div>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="group flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 transition-transform group-hover:text-orange-400 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
        </div>
      </div>
    </header>
  )
}
