"use client"

import { Flame, RefreshCw, Wifi, WifiOff } from 'lucide-react'

interface DashboardHeaderProps {
  isLoading: boolean
  lastUpdated: string
  hasLiveMatches: boolean
  onRefresh: () => void
}

/** Hora curta no formato HH:MM. */
const HORA = /(\d{2}:\d{2})/

/**
 * Segundos no cabecalho sao ruido: o painel atualiza a cada minuto (rodape), e
 * um relogio correndo da a impressao de tempo real que o dado nao tem. A hora
 * cheia continua disponivel no title, para quem quiser o instante exato.
 */
function horaCurta(lastUpdated: string): string {
  return HORA.exec(lastUpdated)?.[1] ?? ''
}

/**
 * Cabecalho do cockpit (DESIGN.md): h1 unico do produto, secundario em
 * text-ink-3 (7,6:1), botao com alvo de 44px no mobile e foco em anel
 * de tinta. O texto de atualizacao vive numa regiao aria-live: quem usa leitor
 * de tela ouve o refresh sem precisar procurar.
 *
 * Altura: uma linha so (36px de conteudo + 10px de respiro em cima e embaixo =
 * ~57px com a borda). O nome, o selo ao vivo e a assinatura dividem a mesma
 * linha em vez de empilhar tres faixas antes do primeiro numero.
 */
export function DashboardHeader({ isLoading, lastUpdated, hasLiveMatches, onRefresh }: DashboardHeaderProps) {
  const hora = horaCurta(lastUpdated)

  return (
    <header className="sticky top-0 z-50 border-b border-ink/[0.06] bg-paper/85 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3 px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <div
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-rule bg-paper-2"
          >
            <Flame className="h-4 w-4 text-ink-2" />
          </div>
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <h1 className="text-[22px] font-bold leading-none tracking-tight text-ink sm:text-[26px]">
              HypeFC
            </h1>
            {hasLiveMatches && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-verde/15 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-verde-2">
                <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-verde" />
                ao vivo
              </span>
            )}
            <p className="hidden min-w-0 truncate text-xs text-ink-3 md:block">
              Dashboard de futebol em tempo real
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div aria-live="polite" className="hidden items-center gap-2 text-xs text-ink-3 sm:flex">
            {hora ? (
              <>
                <Wifi aria-hidden="true" className="h-3.5 w-3.5 text-ink-3" />
                <span title={lastUpdated}>Atualizado às {hora}</span>
              </>
            ) : (
              <>
                <WifiOff aria-hidden="true" className="h-3.5 w-3.5 text-ink-3" />
                <span>Sem dados</span>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            aria-label="Atualizar dados"
            aria-busy={isLoading}
            className="group flex h-11 w-11 items-center justify-center gap-2 rounded-lg border border-ink/10 bg-ink/5 text-[13px] font-medium text-ink-2 transition-colors hover:border-ink/20 hover:bg-ink/10 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/60 active:bg-ink/[0.14] disabled:cursor-not-allowed disabled:opacity-50 sm:h-auto sm:min-h-[36px] sm:w-auto sm:px-3"
          >
            <RefreshCw
              aria-hidden="true"
              className={`h-4 w-4 transition-transform group-hover:text-ink ${isLoading ? 'animate-spin' : ''}`}
            />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
        </div>
      </div>
    </header>
  )
}
