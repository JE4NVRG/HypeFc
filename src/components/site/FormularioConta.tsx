'use client'

/**
 * Formulario de conta: Google (principal) e e-mail com senha (alternativa).
 *
 * O mesmo componente serve as duas paginas (`/entrar` e `/criar-conta`) porque a
 * unica diferenca real e a chamada do servidor; o resto (estados de carregando,
 * erro e confirmacao por e-mail) e identico e nao vale duplicar.
 *
 * Depois de autenticar, o acesso nao e decidido aqui: `criarContaEmail`/`entrarEmail`
 * chamam `pro_conta_entrar`, que devolve a licenca (pro ou gratuita) e o token.
 */

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

import { criarContaEmail, entrarEmail, reenviarConfirmacao } from '@/lib/auth'
import { clienteConta, entrarComGoogle } from '@/lib/conta'

import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAMPO, LINK, ROTULO } from './estilos'

type Modo = 'entrar' | 'criar'

function Recado({ tom, texto }: { tom: 'ok' | 'erro' | 'info'; texto: string }) {
  const cor =
    tom === 'erro'
      ? 'border-carimbo/30 bg-carimbo/10 text-carimbo'
      : tom === 'ok'
        ? 'border-verde/25 bg-verde/10 text-ink'
        : 'border-rule bg-paper-2/60 text-ink-2'
  return (
    <p role="status" aria-live="polite" className={`mt-3 rounded-lg border px-3 py-2 text-[12px] leading-snug ${cor}`}>
      {texto}
    </p>
  )
}

export function FormularioConta({ modo }: { modo: Modo }) {
  const router = useRouter()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [ocupado, setOcupado] = useState<'google' | 'form' | 'reenviar' | null>(null)
  const [recado, setRecado] = useState<{ tom: 'ok' | 'erro' | 'info'; texto: string } | null>(null)
  const [esperandoEmail, setEsperandoEmail] = useState(false)
  const [resetAberto, setResetAberto] = useState(false)
  const [jaConectado, setJaConectado] = useState<string | null>(null)

  // Quem ja esta conectado nao precisa ver o formulario de novo: mostra o atalho
  // para a conta (e a saida, caso queira trocar de e-mail).
  useEffect(() => {
    const c = clienteConta()
    if (!c) return
    let vivo = true
    void c.auth
      .getSession()
      .then(({ data }) => {
        if (vivo) setJaConectado(data.session?.user?.email ?? null)
      })
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [])

  async function comGoogle() {
    setOcupado('google')
    setRecado(null)
    const r = await entrarComGoogle()
    if (!r.ok) {
      setOcupado(null)
      setRecado({ tom: 'erro', texto: 'Não deu para abrir o login do Google agora. Tente de novo em instantes.' })
    }
    // Deu certo: a página sai do ar em direção ao Google.
  }

  async function enviar(event: React.FormEvent) {
    event.preventDefault()
    setOcupado('form')
    setRecado(null)
    const r = modo === 'criar' ? await criarContaEmail(email, senha, nome) : await entrarEmail(email, senha)
    setOcupado(null)
    if (!r.ok) {
      setRecado({ tom: 'erro', texto: r.erro ?? 'Não deu para concluir agora.' })
      return
    }
    if (r.confirmarEmail) {
      setEsperandoEmail(true)
      setRecado({ tom: 'info', texto: 'Conta criada. Falta confirmar o e-mail para entrar.' })
      return
    }
    router.push('/conta')
  }

  async function reenviar() {
    setOcupado('reenviar')
    const r = await reenviarConfirmacao(email)
    setOcupado(null)
    setRecado(
      r.ok
        ? { tom: 'ok', texto: 'Se esse e-mail tiver cadastro pendente, o link de confirmação chega em instantes.' }
        : { tom: 'erro', texto: r.erro ?? 'Não deu para reenviar agora.' }
    )
  }

  if (jaConectado) {
    return (
      <div>
        <p className={ROTULO}>Conectado</p>
        <h2 className="mt-2 truncate text-[16px] font-semibold text-ink">{jaConectado}</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
          Este navegador já está com a sua conta. Abra a página da conta para ver o plano, os times seguidos e os
          alertas.
        </p>
        <Link href="/conta" className={`${BOTAO_PRIMARIO} mt-4`}>
          Ir para a minha conta
        </Link>
      </div>
    )
  }

  if (esperandoEmail) {
    return (
      <div>
        <p className={ROTULO}>Confirme o e-mail</p>
        <h2 className="mt-2 text-[18px] font-semibold text-ink">Enviamos um link para {email}</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
          Abra o link no mesmo navegador para a conta ser liberada. Se não chegar em alguns minutos, confira o spam ou
          reenvie.
        </p>
        <button type="button" onClick={() => void reenviar()} disabled={ocupado !== null} className={`${BOTAO_PRIMARIO} mt-4`}>
          {ocupado === 'reenviar' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Reenviar o link
        </button>
        <Recado tom={recado?.tom ?? 'info'} texto={recado?.texto ?? ''} />
      </div>
    )
  }

  return (
    <div>
      <button type="button" onClick={() => void comGoogle()} disabled={ocupado !== null} className={BOTAO_PRIMARIO}>
        {ocupado === 'google' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Continuar com Google
      </button>
      <p className="mt-2 text-[12px] leading-snug text-ink-3">
        Um clique, sem senha. É o caminho mais rápido e o que já está pronto hoje.
      </p>

      <div className="my-5 flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-rule" />
        <span className="text-[11px] uppercase tracking-wider text-ink-3">ou com e-mail</span>
        <span className="h-px flex-1 bg-rule" />
      </div>

      <form onSubmit={(event) => void enviar(event)} noValidate>
        {modo === 'criar' ? (
          <div>
            <label htmlFor="conta-nome" className="text-[12px] text-ink-3">
              Nome (opcional)
            </label>
            <input
              id="conta-nome"
              type="text"
              autoComplete="name"
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              placeholder="Como quer ser chamado"
              className={CAMPO}
            />
          </div>
        ) : null}

        <div className={modo === 'criar' ? 'mt-3' : ''}>
          <label htmlFor="conta-email" className="text-[12px] text-ink-3">
            E-mail
          </label>
          <input
            id="conta-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="voce@email.com"
            className={CAMPO}
          />
        </div>

        <div className="mt-3">
          <label htmlFor="conta-senha" className="text-[12px] text-ink-3">
            Senha
          </label>
          <input
            id="conta-senha"
            type="password"
            autoComplete={modo === 'criar' ? 'new-password' : 'current-password'}
            required
            value={senha}
            onChange={(event) => setSenha(event.target.value)}
            placeholder={modo === 'criar' ? 'pelo menos 8 caracteres' : 'sua senha'}
            className={CAMPO}
          />
        </div>

        <button type="submit" disabled={ocupado !== null} className={`${BOTAO_SECUNDARIO} mt-4 w-full`}>
          {ocupado === 'form' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {modo === 'criar' ? 'Criar conta' : 'Entrar'}
        </button>
      </form>

      {recado ? <Recado tom={recado.tom} texto={recado.texto} /> : null}

      {modo === 'entrar' ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setResetAberto((v) => !v)}
            className={`${LINK} inline-flex min-h-[44px] items-center text-[12px] sm:min-h-[36px]`}
            aria-expanded={resetAberto}
          >
            Esqueci a senha
          </button>
          {resetAberto ? (
            <p className="mt-2 text-[12px] leading-snug text-ink-2">
              Sem senha, o caminho mais rápido é entrar com o Google ou pedir o link de acesso pelo e-mail{' '}
              <a className={LINK} href="mailto:jean@je4ndev.com">
                jean@je4ndev.com
              </a>
              .
            </p>
          ) : null}
        </div>
      ) : null}

      <p className="mt-5 text-[12px] text-ink-3">
        {modo === 'criar' ? (
          <>
            Já tem conta?{' '}
            <Link className={LINK} href="/entrar">
              Entrar
            </Link>
          </>
        ) : (
          <>
            Ainda não tem conta?{' '}
            <Link className={LINK} href="/criar-conta">
              Criar agora
            </Link>
          </>
        )}
      </p>
    </div>
  )
}
