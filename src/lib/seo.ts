import type { Metadata } from 'next'

/**
 * Metadados de uma rota publica do site.
 *
 * Por que existe: o card de compartilhamento (WhatsApp, X, Telegram) e o
 * canonical sao por rota, nao por site. Sem um lugar unico que monte os dois, a
 * rota nova herda o card da home (preview com titulo errado) e fica sem
 * canonical proprio, o que faz a versao servida de subpasta competir com o
 * dominio proprio na busca.
 *
 * O que toda rota ganha por aqui:
 * - `alternates.canonical` com o caminho da rota (o `metadataBase` do layout
 *   resolve para URL absoluta, sempre no dominio proprio);
 * - `openGraph` e `twitter` completos, com a mesma imagem 1200x630 do site;
 * - `robots`: por padrao indexavel; area privada passa `indexavel: false` e sai
 *   com `noindex, follow` (nao entra na busca, e os links dela continuam
 *   valendo para o rastreador).
 *
 * `caminho` e o valor combinado com o `metadataBase`: `/`, `/pro`, `/entrar`.
 */
const IMAGEM_OG = {
  url: 'og.png',
  width: 1200,
  height: 630,
  alt: 'HypeFC: rodada inteira em uma tela, com probabilidade de modelo e registro público',
}

export function metaDaRota(opcoes: {
  titulo: string
  descricao: string
  caminho: '/' | `/${string}`
  indexavel?: boolean
}): Metadata {
  const { titulo, descricao, caminho, indexavel = true } = opcoes

  return {
    title: titulo,
    description: descricao,
    alternates: { canonical: caminho },
    robots: indexavel ? undefined : { index: false, follow: true },
    openGraph: {
      title: titulo,
      description: descricao,
      url: caminho,
      type: 'website',
      locale: 'pt_BR',
      siteName: 'HypeFC',
      images: [IMAGEM_OG],
    },
    twitter: {
      card: 'summary_large_image',
      title: titulo,
      description: descricao,
      images: ['og.png'],
    },
  }
}
