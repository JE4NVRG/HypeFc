'use client'

import { useEffect } from 'react'

/**
 * Registra o service worker (public/sw.js) que faz o HypeFC ser instalavel e
 * abrir offline com a ultima rodada salva.
 *
 * So roda em producao: com o service worker ativo no dev, cache velho de
 * bundle mascara hot reload e a gente acaba depurando cache em vez de codigo.
 *
 * Nao renderiza nada e nao pode quebrar a pagina: navegador sem suporte,
 * contexto nao seguro (http fora de localhost) ou sw.js ausente falham em
 * silencio.
 */
export default function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    const register = () => {
      // O site pode ser servido de subpasta (GitHub Pages sem dominio
      // proprio), entao a URL do sw sai do <link rel="manifest">, que ja
      // esta resolvido contra a pagina. Sem manifest, cai no caminho raiz.
      const link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null
      const swUrl = link ? new URL('sw.js', link.href).pathname : '/sw.js'

      navigator.serviceWorker.register(swUrl).catch(() => {
        // registro falhou: segue online, sem offline. Nada para o usuario ver.
      })
    }

    if (document.readyState === 'complete') {
      register()
      return
    }

    window.addEventListener('load', register)
    return () => window.removeEventListener('load', register)
  }, [])

  return null
}
