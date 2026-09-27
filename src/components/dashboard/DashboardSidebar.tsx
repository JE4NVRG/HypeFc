'use client'

import Link from 'next/link'

import { useContaResumo } from './contaResumo'
import type { ViewId } from './ViewTabs'

/**
 * Navegacao lateral do cockpit (padrao dos produtos JE4NDEV): as views viram
 * secoes na coluna da esquerda e o bloco de conta mora no pe dela.
 *
 * Antes a home nao tinha nenhuma entrada de conta: quem nao conhecia a URL
 * `/conta` nao descobria que existe login, alerta e plano. Agora o visitante ve
 * "Entrar" na propria navegacao e quem esta logado ve o e-mail e o plano.
 *
 * Abaixo de `lg` a coluna desaparece e as abas horizontais (ViewTabs) seguem
 * valendo, com o botao de conta no cabecalho.
 */
const SECOES: Array<{ id: ViewId; label: string; dica: string }> = [
  { id: 'rodada', label: 'Rodada', dica: 'jogos do dia' },
  { id: 'liga', label: 'Liga', dica: 'tabela, artilharia e titulo' },
  { id: 'record', label: 'Recorde', dica: 'registro do que o modelo previu' },
  { id: 'esportes', label: 'Esportes', dica: 'outras modalidades' },
  { id: 'pro', label: 'Pro', dica: 'alerta do seu time antes da rodada' },
]

interface DashboardSidebarProps {
  view: ViewId
  onChange: (view: ViewId) => void
  counts?: Partial<Record<ViewId, number | null>>
}

export function DashboardSidebar({ view, onChange, counts }: DashboardSidebarProps) {
  const { conta, pronto } = useContaResumo()

  return (
    <aside
      aria-label="Navegacao do painel"
      className="hidden w-56 shrink-0 flex-col gap-1 border-r border-ink/[0.06] bg-ink/[0.015] px-2 py-3 lg:flex"
    >
      <nav className="flex flex-col gap-0.5">
        {SECOES.map(({ id, label, dica }) => {
          const ativo = view === id
          const count = counts?.[id]
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              aria-current={ativo ? 'page' : undefined}
              className={`group flex min-h-[40px] w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 text-left text-[13px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/60 ${
                ativo
                  ? 'bg-ink/[0.07] font-semibold text-ink'
                  : 'font-medium text-ink-3 hover:bg-ink/[0.05] hover:text-ink'
              }`}
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate">{label}</span>
                <span className="truncate text-[11px] font-normal text-ink-3 group-hover:text-ink-2">
                  {dica}
                </span>
              </span>
              {typeof count === 'number' && count > 0 ? (
                <span className="shrink-0 rounded bg-ink/5 px-1 py-0.5 font-mono text-[11px] leading-none text-ink-2">
                  {count}
                </span>
              ) : null}
            </button>
          )
        })}
      </nav>

      <div className="flex-1" />

      <section aria-label="Conta" className="rounded-xl border border-ink/[0.06] bg-paper p-2.5">
        {!pronto ? (
          <p className="text-[12px] text-ink-3">conta…</p>
        ) : conta?.logado ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              {conta.foto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={conta.foto}
                  alt=""
                  width={28}
                  height={28}
                  className="h-7 w-7 shrink-0 rounded-full border border-ink/10"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink/[0.08] text-[12px] font-semibold text-ink-2"
                >
                  {(conta.email ?? '?').slice(0, 1).toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-[12px] font-medium text-ink" title={conta.email}>
                  {conta.email ?? 'conta'}
                </p>
                <p className="text-[11px] text-ink-3">
                  {conta.pro ? 'plano Pro ativo' : 'plano gratuito'}
                  {conta.paidUntil ? ` · até ${conta.paidUntil.slice(0, 10).split('-').reverse().join('/')}` : ''}
                </p>
              </div>
            </div>
            <Link
              href="/conta"
              className="flex min-h-[36px] items-center justify-center rounded-lg border border-line bg-paper-3 px-2 text-[12px] font-semibold text-ink transition-colors hover:bg-ink/[0.05] focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/60"
            >
              Minha conta e alertas
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-[11px] leading-snug text-ink-3">
              Alerta antes da rodada quando o seu time joga.
            </p>
            <Link
              href="/entrar"
              className="flex min-h-[36px] items-center justify-center rounded-lg bg-ink px-2 text-[12px] font-semibold text-paper transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/60"
            >
              Entrar
            </Link>
            <Link
              href="/criar-conta"
              className="flex min-h-[32px] items-center justify-center rounded-lg px-2 text-[12px] font-medium text-ink-2 transition-colors hover:bg-ink/[0.05] focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/60"
            >
              Criar conta grátis
            </Link>
          </div>
        )}
      </section>
    </aside>
  )
}
