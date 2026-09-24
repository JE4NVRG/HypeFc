'use client'

import { useEffect, useState } from 'react'
import { contaConfigurada, entrarComoAssinante, estadoDaConta } from '@/lib/conta'
import { proConfigurado, resgatarSessao, temToken } from '@/lib/proStore'

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
        texto: 'Pagamento recebido. A liberação leva alguns minutos, recarregue a página daqui a pouco.',
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
            texto: contaConfigurada()
              ? 'Pro ativado neste navegador: alertas ligados e até 20 times seguidos. Dica: entre com o Google na aba Pro para levar este acesso a qualquer aparelho.'
              : 'Pro ativado neste navegador: alertas ligados e até 20 times seguidos.',
          })
          return
        }
        if (r.erro === 'ja-resgatado') {
          limparUrl()
          setAviso({
            tipo: 'ok',
            texto: 'Esta compra já foi ativada neste link. Abra a aba Pro; se não aparecer, recarregue a página.',
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
            texto: 'Ainda não encontramos essa compra. Recarregue esta página em alguns minutos, o link continua funcionando.',
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

  // Conta (login com Google): o Pro volta em qualquer aparelho.
  //
  // Roda depois do resgate por sessão e nunca briga com ele: se a licença já
  // está neste navegador, só confere o estado e não rotaciona nada. Rotaciona
  // apenas quando a conta tem assinatura e este navegador está sem acesso — que
  // é exatamente o caso de "troquei de celular".
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!contaConfigurada()) return

    const veioDoGoogle = new URLSearchParams(window.location.search).has('code')
    let vivo = true

    estadoDaConta()
      .then(async (r) => {
        if (!vivo) return
        if (!r.logado) {
          if (veioDoGoogle) {
            setAviso({ tipo: 'erro', texto: 'O login voltou sem sessão. Tente entrar de novo na aba Pro.' })
          }
          return
        }
        if (temToken()) {
          if (veioDoGoogle) {
            setAviso({ tipo: 'ok', texto: `Conta conectada (${r.email ?? 'Google'}). Pro ativo neste aparelho.` })
          }
          return
        }
        // Sem licença neste navegador: sempre tenta ligar. É aqui que entra quem
        // comprou ANTES de ter conta — `pro_conta_entrar` resgata a compra paga
        // pelo e-mail da conta. Checar `r.pro` antes disso deixaria essa pessoa
        // de fora para sempre (bug real, achado em teste).
        const ligou = await entrarComoAssinante()
        if (!vivo) return
        if (ligou.pro) {
          setAviso({
            tipo: 'ok',
            texto: veioDoGoogle
              ? `Pro ativado na conta ${ligou.email ?? ''}. Abra a aba Pro: este aparelho está liberado.`
              : `Pro restaurado na conta ${ligou.email ?? ''}: este aparelho está liberado.`,
          })
          return
        }
        if (veioDoGoogle) {
          setAviso({
            tipo: 'erro',
            texto: `Entramos com ${ligou.email ?? r.email ?? 'sua conta'}, mas essa conta ainda não tem assinatura Pro.`,
          })
        }
      })
      .catch(() => {
        // rede fora do ar: o resgate por sessão continua sendo o caminho
      })

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
