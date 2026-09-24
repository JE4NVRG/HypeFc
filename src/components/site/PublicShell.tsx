'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { contaConfigurada, clienteConta } from '@/lib/conta'

import { SiteFooter } from './SiteFooter'
import { SiteMarca } from './SiteMarca'
import { LINK_NAV } from './estilos'

/**
 * Chrome das paginas publicas: venda (`/pro`), entrada (`/entrar`), cadastro
 * (`/criar-conta`) e conta (`/conta`).
 *
 * Mesma marca e mesmo rodape do painel, para o site nao ter duas caras. A unica
 * diferenca e a navegacao: quem ja tem sessao ve "Conta" no lugar de "Entrar".
 * A leitura da sessao e local (`auth.getSession` le o `localStorage`), nao gasta
 * requisicao e nao decide direito de ninguem: quem decide e a RPC no servidor.
 */
type Pagina = 'painel' | 'pro' | 'entrar' | 'criar-conta' | 'conta'

export function PublicShell({
  children,
  atual,
}: {
  children: React.ReactNode
  atual?: Pagina
}) {
  const [logado, setLogado] = useState(false)

  useEffect(() => {
    if (!contaConfigurada()) return
    const c = clienteConta()
    if (!c) return
    let vivo = true
    void c.auth
      .getSession()
      .then(({ data }) => {
        if (vivo) setLogado(Boolean(data.session))
      })
      .catch(() => {
        // sem sessao legivel: a navegacao segue como deslogado
      })
    return () => {
      vivo = false
    }
  }, [])

  const classe = (pagina: Pagina) =>
    atual === pagina ? `${LINK_NAV} bg-ink/[0.07] text-ink` : LINK_NAV

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="sticky top-0 z-50 border-b border-ink/[0.06] bg-paper/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-2">
          <SiteMarca href="/" />
          <nav aria-label="Navegação do site" className="flex shrink-0 items-center gap-0.5 sm:gap-1">
            <Link href="/" className={classe('painel')} aria-current={atual === 'painel' ? 'page' : undefined}>
              Painel
            </Link>
            <Link href="/pro" className={classe('pro')} aria-current={atual === 'pro' ? 'page' : undefined}>
              Pro
            </Link>
            {logado ? (
              <Link href="/conta" className={classe('conta')} aria-current={atual === 'conta' ? 'page' : undefined}>
                Conta
              </Link>
            ) : (
              <Link href="/entrar" className={classe('entrar')} aria-current={atual === 'entrar' ? 'page' : undefined}>
                Entrar
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main id="conteudo" className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 sm:py-12">
        {children}
      </main>

      <SiteFooter meta={false} />
    </div>
  )
}
