import Link from 'next/link'
import { Github } from 'lucide-react'

/**
 * Rodape padrao do site, um so para o painel e para as paginas de conteudo.
 *
 * Antes existiam dois rodapes diferentes: o do cockpit (meta + links + disclaimer)
 * e o das paginas de documento, que era uma `nav` com dois links. Agora e o mesmo
 * bloco, e a unica variacao e a linha de meta, que so faz sentido onde existe
 * painel (`meta={false}` nas paginas de conteudo).
 *
 * Regras que vieram do DESIGN.md e continuam valendo:
 *  - 11px no piso, em `ink-3`, nunca no cinza reprovado;
 *  - no mobile a linha de meta sai (o header ja diz quando atualizou) e a fonte dos
 *    dados desce para a linha do disclaimer;
 *  - alvo de 44px no mobile e safe-area embaixo, para nao cair na barra de gestos.
 *
 * Os links internos usam `next/link` com caminho absoluto: o site tambem roda
 * servido de subpasta no GitHub Pages, e o Next aplica o `basePath` sozinho. O
 * `href` relativo que existia aqui apontava para o lugar errado fora da raiz.
 */
const LINK_ALVO =
  'inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-2 transition-colors hover:bg-ink/5 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/60 active:bg-ink/10 sm:min-h-[36px]'

function fonteLabel(source?: string): string {
  if (source === 'football-data') return 'Football-Data.org + ESPN'
  if (source === 'espn') return 'ESPN (dados públicos)'
  return 'Football-Data.org + ESPN'
}

export function SiteFooter({ source, meta = true }: { source?: string; meta?: boolean }) {
  const label = fonteLabel(source)

  return (
    <footer className="border-t border-ink/[0.06] px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 sm:px-4 sm:pb-4 sm:pt-3">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-0.5 sm:gap-3">
        {meta ? (
          <div className="hidden flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-ink-3 sm:flex">
            <span>HypeFC Dashboard</span>
            <span aria-hidden="true" className="h-3 w-px bg-ink/15" />
            <span>Atualiza a cada 1 min com jogo ao vivo</span>
            <span aria-hidden="true" className="h-3 w-px bg-ink/15" />
            <span>Dados: {label}</span>
          </div>
        ) : null}

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
          <Link href="/termos" className={LINK_ALVO}>
            Termos
          </Link>
          <Link href="/privacidade" className={LINK_ALVO}>
            Privacidade
          </Link>
        </nav>

        <p className="max-w-2xl text-center text-[11px] leading-tight text-ink-3">
          Painel informativo. Não é casa de aposta e não promete resultado.
          {meta ? <span className="sm:hidden"> Dados: {label}.</span> : null}
        </p>
      </div>
    </footer>
  )
}
