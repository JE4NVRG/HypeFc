import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import PwaRegister from '@/components/dashboard/PwaRegister'
import './globals.css'

export const metadata: Metadata = {
  title: 'HypeFC - Dashboard de Futebol em Tempo Real',
  description: 'Dashboard inteligente que identifica times em alta, acompanha classificacoes e jogos do dia das principais ligas do mundo.',
  keywords: ['futebol', 'dashboard', 'premier league', 'brasileirao', 'la liga', 'champions league'],
  authors: [{ name: 'Jean Carlos', url: 'https://github.com/JE4NVRG' }],
  // Relativo de proposito: o site tambem roda servido de subpasta no GitHub
  // Pages (/HypeFc/), e href relativo e resolvido contra a URL da pagina.
  // O icone instalavel sai do link rel=icon gerado por src/app/icon.svg.
  manifest: './manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'HypeFC',
    statusBarStyle: 'black',
  },
  openGraph: {
    title: 'HypeFC - Dashboard de Futebol',
    description: 'Times em alta, jogos de hoje e classificacoes das maiores ligas do mundo.',
    type: 'website',
    locale: 'pt_BR',
  },
}

// No Next 14 themeColor mora no viewport (no metadata virou deprecated).
export const viewport: Viewport = {
  themeColor: '#020617',
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
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}>
        {children}
        <PwaRegister />
      </body>
    </html>
  )
}
