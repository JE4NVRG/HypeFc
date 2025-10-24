import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'HypeFC Dashboard',
  description: 'Dashboard de times em alta para vender hoje',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.className} min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 antialiased`}>
        {children}
      </body>
    </html>
  )
}
