import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'

export const metadata: Metadata = {
  title: 'HypeFC - Dashboard de Futebol em Tempo Real',
  description: 'Dashboard inteligente que identifica times em alta, acompanha classificacoes e jogos do dia das principais ligas do mundo.',
  keywords: ['futebol', 'dashboard', 'premier league', 'brasileirao', 'la liga', 'champions league'],
  authors: [{ name: 'Jean Carlos', url: 'https://github.com/JE4NVRG' }],
  openGraph: {
    title: 'HypeFC - Dashboard de Futebol',
    description: 'Times em alta, jogos de hoje e classificacoes das maiores ligas do mundo.',
    type: 'website',
    locale: 'pt_BR',
  },
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
      </body>
    </html>
  )
}
