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
 * Componente de servidor de proposito: o rodape nao depende da sessao. A versao
 * que lia a sessao para trocar "Entrar" por "Conta" piscava depois da hidratacao
 * (o HTML estatico dizia Entrar e o cliente trocava na frente de quem olhava) e
 * ainda empurrava a navegacao para duas linhas no celular, quatro links em cima e
 * um sozinho embaixo. Quem leva para a conta e a navegacao do cabecalho das
 * paginas publicas, que ja sabe da sessao antes de pintar.
 *
 * Regras que vieram do DESIGN.md e continuam valendo:
 *  - 11px no piso, em `ink-3`, nunca no cinza reprovado;
 *  - no mobile a linha de meta sai (o header ja diz quando atualizou) e a fonte dos
 *    dados desce para a linha do disclaimer;
 *  - alvo de 44px no mobile e safe-area embaixo, para nao cair na barra de gestos;
 *  - o rodape nao come a tela: o cockpit da home nao rola, entao cada linha aqui
 *    custa espaco da lista de jogos. Por isso os produtos entram como links em
 *    linha (11px, sem caixa), que e o unico formato que nao gasta 44px por item.
 *
 * Os links internos usam `next/link` com caminho absoluto: o site tambem roda
 * servido de subpasta no GitHub Pages, e o Next aplica o `basePath` sozinho. O
 * `href` relativo que existia aqui apontava para o lugar errado fora da raiz.
 */
const LINK_ALVO =
  'inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-2 transition-colors hover:bg-ink/5 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/60 active:bg-ink/10 sm:min-h-[36px]'

const LINK_PRODUTO =
  'text-ink-2 underline decoration-ink/20 underline-offset-2 transition-colors hover:text-ink hover:decoration-ink/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/60'

/**
 * Outros produtos do mesmo dono. Ancoras de marca, uma linha, `rel="noopener"` e
 * sem `nofollow` de proposito: sao produtos reais, nao fazenda de palavra-chave.
 * Mesma lista que o rodape do VegaSec usa, para o rodape ser o mesmo em todo lugar.
 */
const PRODUTOS: ReadonlyArray<{ href: string; label: string }> = [
  { href: 'https://vegasec.je4ndev.com', label: 'VegaSec' },
  { href: 'https://urlpivot.app', label: 'URLPivot' },
  { href: 'https://archscene.com', label: 'ArchScene' },
  { href: 'https://www.fullcommerce360.com', label: 'FullCommerce' },
  { href: 'https://je4ndev.com', label: 'Je4nDev' },
]

function fonteLabel(source?: string): string {
  if (source === 'football-data') return 'Football-Data.org + ESPN'
  if (source === 'espn') return 'ESPN (dados públicos)'
  return 'Football-Data.org + ESPN'
}

export function SiteFooter({ source, meta = true }: { source?: string; meta?: boolean }) {
  const label = fonteLabel(source)

  return (
    <footer className="border-t border-ink/[0.06] px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 sm:px-4 sm:pb-4 sm:pt-3">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-0.5 sm:gap-2">
        {meta ? (
          <div className="hidden flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-ink-3 sm:flex">
            <span>HypeFC Dashboard</span>
            <span aria-hidden="true" className="h-3 w-px bg-ink/15" />
            <span>Atualiza a cada 1 min com jogo ao vivo</span>
            <span aria-hidden="true" className="h-3 w-px bg-ink/15" />
            <span>Dados: {label}</span>
          </div>
        ) : null}

        <nav aria-label="Navegação do rodapé" className="flex flex-wrap items-center justify-center gap-0 sm:gap-1">
          <a
            href="https://github.com/JE4NVRG"
            target="_blank"
            rel="noopener noreferrer"
            title="Projeto no GitHub"
            className={LINK_ALVO}
          >
            <Github aria-hidden="true" className="h-4 w-4" />
            <span>JE4NVRG</span>
          </a>
          <Link href="/pro" className={LINK_ALVO}>
            Pro
          </Link>
          <Link href="/termos" className={LINK_ALVO}>
            Termos
          </Link>
          <Link href="/privacidade" className={LINK_ALVO}>
            Privacidade
          </Link>
        </nav>

        <p className="text-center text-[11px] leading-snug text-ink-3">
          <span className="uppercase tracking-wider">Produtos JE4NDEV</span>
        </p>
        <p className="max-w-3xl text-center text-[11px] leading-snug text-ink-3">
          {PRODUTOS.map((produto, indice) => (
            <span
              key={produto.href}
              className="[&:not(:first-child)]:before:mr-1 [&:not(:first-child)]:before:text-ink-3/60 [&:not(:first-child)]:before:content-['·']"
            >
              {indice > 0 ? ' ' : null}
              <a href={produto.href} target="_blank" rel="noopener" className={LINK_PRODUTO}>
                {produto.label}
              </a>
            </span>
          ))}
        </p>

        <div className="flex flex-col items-center gap-0 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-3 sm:gap-y-1">
          <p className="inline-flex items-center gap-1.5 text-[11px] leading-tight text-ink-3">
            <span
              aria-hidden="true"
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border border-ink/20 bg-paper-2/60"
            >
              <Github className="h-3.5 w-3.5 text-ink-2" />
            </span>
            Criado por <span className="font-semibold text-ink">Je4nDev</span>
          </p>
          <p className="text-center text-[11px] leading-tight text-ink-3">
            Painel informativo. Não é casa de aposta e não promete resultado.
            {meta ? <span className="sm:hidden"> Dados: {label}.</span> : null}
          </p>
        </div>
      </div>
    </footer>
  )
}
