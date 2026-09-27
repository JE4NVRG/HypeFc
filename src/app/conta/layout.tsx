import type { Metadata } from 'next'

/**
 * Metadados da area da conta.
 *
 * A pagina e um componente de cliente (tudo nela depende da sessao) e
 * componente de cliente nao exporta `metadata`. Este layout existe para isso:
 * dar titulo, canonical e `noindex` a rota sem transformar a pagina em servidor.
 *
 * `noindex` e o certo aqui: nao ha conteudo publico e o que a tela mostra muda
 * por pessoa. O `follow` fica ligado de proposito, porque os links que ela
 * carrega (termos, privacidade, painel) continuam valendo para o rastreador.
 */
export const metadata: Metadata = {
  title: 'Conta · HypeFC',
  description: 'O seu acesso no HypeFC: plano, times seguidos, alertas e histórico do registro.',
  alternates: { canonical: '/conta' },
  robots: { index: false, follow: true },
}

export default function ContaLayout({ children }: { children: React.ReactNode }) {
  return children
}
