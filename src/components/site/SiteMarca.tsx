import Link from 'next/link'
import { Flame } from 'lucide-react'

/**
 * Marca do HypeFC em um lugar so.
 *
 * O mesmo bloco (prato com o flame + nome + linha de apoio) aparecia escrito duas
 * vezes: aqui no cockpit, como `h1`, e de novo nas paginas de documento, como um
 * rotulo "HYPEFC" solto. Duas copias divergem: uma ganha peso novo, a outra nao.
 *
 * No cockpit ele e o `h1` do produto. Nas paginas de conteudo o `h1` e o titulo do
 * documento, entao a marca vira link para o painel (`href`).
 */
type Props = {
  /** Presente nas paginas de conteudo: a marca vira link para a raiz. */
  href?: string
  /** Linha de apoio ao lado do nome, visivel a partir de md. */
  subtitulo?: string
}

export function SiteMarca({ href, subtitulo }: Props) {
  const conteudo = (
    <>
      <span
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-rule bg-paper-2"
      >
        <Flame className="h-4 w-4 text-ink-2" />
      </span>
      <span className="flex min-w-0 items-baseline gap-2 sm:gap-3">
        <span className="text-[22px] font-bold leading-none tracking-tight text-ink sm:text-[26px]">HypeFC</span>
        {subtitulo ? (
          <span className="hidden min-w-0 truncate text-xs text-ink-3 md:inline">{subtitulo}</span>
        ) : null}
      </span>
    </>
  )

  if (href) {
    return (
      <Link
        href={href}
        className="flex min-h-[44px] min-w-0 items-center gap-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/60 sm:min-h-[36px] sm:gap-3"
      >
        {conteudo}
      </Link>
    )
  }

  return <h1 className="flex min-w-0 items-center gap-2 sm:gap-3">{conteudo}</h1>
}
