'use client'

import { useEffect, useState } from 'react'
import { proConfigurado, resgatarSessao } from '@/lib/proStore'

/**
 * Retorno do Checkout da Stripe.
 *
 * O link de pagamento devolve o comprador para
 *   https://hypefc.je4ndev.com/?pro=ok&session_id=cs_live_...
 * Este componente troca o id da sessão pelo token da licença (RPC
 * `pro_claim_session` no Supabase), guarda no navegador e limpa a URL. Sem
 * conta, sem e-mail: o id da sessão é secreto e de uso único.
 *
 * Fica montado no layout (não na aba Pro) porque o comprador volta para a raiz
 * do site. A URL é limpa imediatamente para o id não sobrar no histórico nem
 * em print de tela.
 */
export default function ResgatePro() {
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro' | 'indo'; texto: string } | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const params = new URLSearchParams(window.location.search)
    const sessao = (params.get('session_id') ?? '').trim()
    const voltouDoCheckout = params.get('pro') === 'ok' || sessao !== ''
    if (!voltouDoCheckout) return

    // limpa a query sem recarregar (o id da sessão é secreto)
    const limparUrl = () => {
      try {
        const u = new URL(window.location.href)
        u.searchParams.delete('session_id')
        u.searchParams.delete('pro')
        window.history.replaceState({}, '', `${u.pathname}${u.search}${u.hash}`)
      } catch {
        // sem history: segue, só não limpa
      }
    }

    if (sessao === '') {
      limparUrl()
      setAviso({
        tipo: 'ok',
        texto: 'Pagamento recebido. A liberação leva alguns minutos — recarregue a página daqui a pouco.',
      })
      return
    }

    if (!proConfigurado()) {
      limparUrl()
      setAviso({ tipo: 'erro', texto: 'Registro online ainda não ligado neste site: nada foi gravado aqui.' })
      return
    }

    let vivo = true
    let tentativas = 0
    setAviso({ tipo: 'indo', texto: 'Confirmando o pagamento e liberando o Pro…' })

    // A compra entra no banco pela sincronização da Stripe (a cada poucos
    // minutos). Se o comprador chegar antes disso, tenta de novo algumas vezes
    // SEM limpar a URL — é ela que permite o resgate depois.
    const tentar = (): void => {
      tentativas += 1
      resgatarSessao(sessao).then((r) => {
        if (!vivo) return
        if (r.ok) {
          limparUrl()
          setAviso({
            tipo: 'ok',
            texto: 'Pro ativado neste navegador: alertas ligados e até 20 times seguidos.',
          })
          return
        }
        if (r.erro === 'ja-resgatado') {
          limparUrl()
          setAviso({
            tipo: 'ok',
            texto: 'Esta compra já foi ativada neste link. Abra a aba Pro — se não aparecer, recarregue a página.',
          })
          return
        }
        if (r.erro === 'sessao-nao-encontrada' && tentativas < 4) {
          setAviso({ tipo: 'indo', texto: 'Confirmando o pagamento… (a Stripe ainda não avisou a gente)' })
          setTimeout(tentar, 20000)
          return
        }
        if (r.erro === 'sessao-nao-encontrada') {
          setAviso({
            tipo: 'erro',
            texto: 'Ainda não encontramos essa compra. Recarregue esta página em alguns minutos — o link continua funcionando.',
          })
          return
        }
        setAviso({ tipo: 'erro', texto: 'Não deu para ativar agora. Tente de novo em instantes.' })
      })
    }

    tentar()

    return () => {
      vivo = false
    }
  }, [])

  if (!aviso) return null

  const cor =
    aviso.tipo === 'erro'
      ? 'border-red-500/20 bg-red-500/10 text-red-200'
      : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'

  return (
    <div
      role="status"
      aria-live="polite"
      className={`mx-2 mt-2 rounded-xl border px-3 py-2 text-[12px] leading-tight sm:mx-4 ${cor}`}
    >
      {aviso.texto}
    </div>
  )
}
