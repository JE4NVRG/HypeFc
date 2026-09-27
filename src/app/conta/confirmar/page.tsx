'use client'

/**
 * Confirmação de e-mail (`/conta/confirmar/`) — onde os links de confirmação de
 * cadastro e de troca de e-mail aterrissam.
 *
 * O link traz `?token_hash=...&type=signup` (ou `email_change`). A sessão nasce
 * aqui, por `verifyOtp`, em vez de vir no fragmento da URL: com `flowType: 'pkce'`
 * a biblioteca recusa o fragmento de propósito, e o resultado era a pessoa clicar
 * no e-mail, cair na home conectada pela metade e o cadastro continuar pendente.
 *
 * Quem chega com sessão já aberta também vê a confirmação: é o caso de reabrir o
 * mesmo link no mesmo navegador.
 */

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

import { PublicShell } from '@/components/site/PublicShell'
import { BOTAO_PRIMARIO, CAIXA, LINK, ROTULO } from '@/components/site/estilos'
import { confirmarLinkDoEmail, type TipoDeLink } from '@/lib/auth'
import { clienteConta, entrarComoAssinante } from '@/lib/conta'

type Fase = 'checando' | 'confirmado' | 'falhou'

const TITULOS: Record<string, { titulo: string; texto: string }> = {
  signup: {
    titulo: 'E-mail confirmado',
    texto: 'O cadastro está completo: agora a conta entra por e-mail ou pelo Google, em qualquer aparelho.',
  },
  email_change: {
    titulo: 'Novo e-mail confirmado',
    texto: 'A conta passa a usar este endereço de agora em diante.',
  },
}

export default function Confirmar() {
  const [fase, setFase] = useState<Fase>('checando')
  const [tipo, setTipo] = useState<string>('signup')
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    const c = clienteConta()
    if (!c) {
      setFase('falhou')
      return
    }
    let vivo = true

    async function abrir() {
      const params = new URLSearchParams(window.location.search)
      const tokenHash = params.get('token_hash') ?? ''
      const tipoLink = (params.get('type') ?? 'signup') as TipoDeLink
      if (vivo) setTipo(tipoLink)

      const atual = await c!.auth.getSession()
      if (atual.data.session) {
        if (!vivo) return
        setFase('confirmado')
        return
      }

      if (!tokenHash) {
        if (!vivo) return
        setErro('Esse endereço não trouxe um link de confirmação.')
        setFase('falhou')
        return
      }

      const r = await confirmarLinkDoEmail(tokenHash, tipoLink)
      if (!vivo) return
      if (!r.ok) {
        setErro(r.erro ?? 'Não deu para confirmar esse link.')
        setFase('falhou')
        return
      }
      await entrarComoAssinante()
      if (vivo) setFase('confirmado')
    }

    void abrir().catch(() => {
      if (vivo) {
        setErro('Não deu para confirmar esse link agora.')
        setFase('falhou')
      }
    })
    return () => {
      vivo = false
    }
  }, [])

  const conteudo = TITULOS[tipo] ?? TITULOS.signup

  return (
    <PublicShell atual="entrar">
      <div className="mx-auto w-full max-w-md">
        <div className={CAIXA}>
          <p className={ROTULO}>Conta HypeFC</p>

          {fase === 'checando' ? (
            <>
              <h1 className="mt-2 text-[22px] font-bold leading-tight tracking-tight text-ink">Confirmando o link</h1>
              <p className="mt-2 flex items-center gap-2 text-[13px] text-ink-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Um instante.
              </p>
            </>
          ) : null}

          {fase === 'confirmado' ? (
            <>
              <h1 className="mt-2 text-[22px] font-bold leading-tight tracking-tight text-ink">{conteudo.titulo}</h1>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-2">{conteudo.texto}</p>
              <Link href="/conta" className={`${BOTAO_PRIMARIO} mt-4`}>
                Ir para a minha conta
              </Link>
            </>
          ) : null}

          {fase === 'falhou' ? (
            <>
              <h1 className="mt-2 text-[22px] font-bold leading-tight tracking-tight text-ink">
                Esse link não abriu
              </h1>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
                {erro ?? 'O link de confirmação não está mais valendo.'}
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
                Na página de entrada dá para pedir outro: entre com o e-mail e a senha e use o reenvio.
              </p>
              <Link href="/entrar" className={`${BOTAO_PRIMARIO} mt-4`}>
                Pedir outro link
              </Link>
              <p className="mt-4 text-[12px] text-ink-3">
                <Link className={LINK} href="/">
                  Voltar para o início
                </Link>
              </p>
            </>
          ) : null}
        </div>
      </div>
    </PublicShell>
  )
}
