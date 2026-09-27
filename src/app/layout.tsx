import type { Metadata, Viewport } from 'next'
import { Inter_Tight, JetBrains_Mono } from 'next/font/google'
import PwaRegister from '@/components/dashboard/PwaRegister'
import './globals.css'

/*
 * Fontes da direcao 002: self-hosted pelo next/font (nao CDN externo), com
 * preload e ajuste de metrica de fallback. Isso e o que impede o layout shift
 * de fonte fria que o mockup apresentou (CLS 0,0739) enquanto a webfont baixava.
 */
const interTight = Inter_Tight({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter-tight',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  // Base absoluta: preview de link (WhatsApp, X, Telegram) exige URL completa da
  // imagem. O site tambem roda em subpasta no GitHub Pages, mas o card aponta
  // para o dominio proprio — e o canonical que vale para compartilhar.
  metadataBase: new URL('https://hypefc.je4ndev.com'),
  title: 'HypeFC · Dashboard de Futebol em Tempo Real',
  description: 'Dashboard inteligente que identifica times em alta, acompanha classificações e jogos do dia das principais ligas do mundo.',
  // Canonical da home. Cada rota filha declara o proprio em src/lib/seo.ts.
  alternates: { canonical: '/' },
  keywords: ['futebol', 'dashboard', 'premier league', 'brasileirão', 'la liga', 'champions league'],
  authors: [{ name: 'Jean Carlos', url: 'https://github.com/JE4NVRG' }],
  // Absoluto a partir da raiz do site, com o basePath do build do Pages quando
  // existe. Antes era relativo ('./manifest.webmanifest') para funcionar tambem
  // na subpasta do GitHub Pages, mas href relativo e resolvido contra a URL DA
  // PAGINA: em rota aninhada ele virava /conta/manifest.webmanifest (404), e o
  // navegador registrava o manifest so quando a visita comecava na home.
  manifest: `${process.env.PAGES_BASE_PATH ?? ''}/manifest.webmanifest`,
  appleWebApp: {
    capable: true,
    title: 'HypeFC',
    statusBarStyle: 'black',
  },
  openGraph: {
    title: 'HypeFC - Dashboard de Futebol',
    description: 'Times em alta, jogos de hoje e classificacoes das maiores ligas do mundo.',
    url: '/',
    type: 'website',
    locale: 'pt_BR',
    siteName: 'HypeFC',
    images: [
      {
        url: 'og.png',
        width: 1200,
        height: 630,
        alt: 'HypeFC: rodada inteira em uma tela, com probabilidade de modelo e registro público',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HypeFC - Dashboard de Futebol',
    description: 'Rodada inteira em uma tela. Probabilidade do modelo com registro público.',
    images: ['og.png'],
  },
}

// No Next 14 themeColor mora no viewport (no metadata virou deprecated).
export const viewport: Viewport = {
  themeColor: '#0B0E11',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={`${interTight.variable} ${jetbrainsMono.variable} font-mono antialiased`}>
        {children}
        <PwaRegister />
      </body>
    </html>
  )
}
