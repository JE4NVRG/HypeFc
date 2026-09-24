import Link from 'next/link'

import { SiteFooter } from './SiteFooter'
import { SiteMarca } from './SiteMarca'

/**
 * Chrome das paginas de conteudo (termos, privacidade).
 *
 * Antes elas eram so um `<article>`: sem cabecalho, sem marca, sem rodape, e o
 * unico jeito de voltar era a `nav` no fim do texto. Quem chega por um link direto
 * (ou pelo rodape do painel) caia numa pagina sem cara de HypeFC.
 *
 * Agora usam a mesma marca e o mesmo rodape do painel, e o cabecalho carrega a
 * navegacao entre os documentos. A marca volta para o painel, porque aqui o `h1` e
 * o titulo do documento.
 */
type Doc = 'termos' | 'privacidade'

const LINK_NAV =
  'inline-flex min-h-[44px] items-center rounded-lg px-2.5 text-[13px] font-medium text-ink-2 transition-colors hover:bg-ink/5 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/60 sm:min-h-[36px]'

export function DocsShell({ children, atual }: { children: React.ReactNode; atual: Doc }) {
  const classe = (doc: Doc) => (atual === doc ? `${LINK_NAV} text-ink` : LINK_NAV)

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="sticky top-0 z-50 border-b border-ink/[0.06] bg-paper/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-5 py-2">
          <SiteMarca href="/" />
          <nav aria-label="Documentos" className="flex shrink-0 items-center gap-1">
            <Link href="/termos" className={classe('termos')} aria-current={atual === 'termos' ? 'page' : undefined}>
              Termos
            </Link>
            <Link
              href="/privacidade"
              className={classe('privacidade')}
              aria-current={atual === 'privacidade' ? 'page' : undefined}
            >
              Privacidade
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">{children}</main>

      <SiteFooter meta={false} />
    </div>
  )
}
