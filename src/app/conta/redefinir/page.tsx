'use client'

/**
 * Nova senha (`/conta/redefinir/`) — onde o link do e-mail de recuperacao aterrissa.
 *
 * Dois caminhos chegam aqui:
 *   1. `?token_hash=...&type=recovery` — o link do e-mail. A sessao nasce nesta
 *      pagina (`verifyOtp`), o que faz o link valer em qualquer aparelho;
 *   2. sessao ja aberta — quem so quer trocar a senha, ou quem veio por um link
 *      antigo (antes deste formato).
 *
 * Sem sessao e sem token, a tela pede outro link em vez de mostrar um formulario
 * que vai falhar.
 *
 * A senha nova e definida pelo proprio usuario logado (`updateUser`): o hash fica
 * no servidor do Supabase, esta camada nunca ve senha de ninguem.
 */

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

import { PublicShell } from '@/components/site/PublicShell'
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAIXA, CAMPO, LINK, ROTULO } from '@/components/site/estilos'
import { confirmarLinkDoEmail, definirNovaSenha, pedirNovaSenha, type TipoDeLink } from '@/lib/auth'
import { clienteConta, entrarComoAssinante } from '@/lib/conta'

type Fase = 'checando' | 'formulario' | 'sem-sessao' | 'pronta'
type Recado = { tom: 'ok' | 'erro' | 'info'; texto: string }

const MENOR_SENHA = 8

/** Mensagem que o Supabase deixa na URL quando o link não vale mais. */
function erroDaUrl(): string {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const busca = new URLSearchParams(window.location.search)
  const descricao = hash.get('error_description') || busca.get('error_description') || ''
  const codigo = hash.get('error_code') || busca.get('error_code') || ''
  if (!descricao && !codigo) return ''
  return 'Esse link já venceu ou foi usado. Peça outro abaixo.'
}

export default function Redefinir() {
  const [fase, setFase] = useState<Fase>('checando')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [email, setEmail] = useState('')
  const [ocupado, setOcupado] = useState<'salvar' | 'pedir' | null>(null)
  const [recado, setRecado] = useState<Recado | null>(null)

  useEffect(() => {
    const c = clienteConta()
    if (!c) {
      setFase('sem-sessao')
      return
    }
    let vivo = true

    async function abrir() {
      const params = new URLSearchParams(window.location.search)
      const tokenHash = params.get('token_hash') ?? ''
      const tipo = (params.get('type') ?? 'recovery') as TipoDeLink

      const atual = await c!.auth.getSession()
      if (atual.data.session) {
        if (!vivo) return
        setEmail(atual.data.session.user?.email ?? '')
        setFase('formulario')
        return
      }

      if (tokenHash) {
        const r = await confirmarLinkDoEmail(tokenHash, tipo === 'recovery' ? 'recovery' : tipo)
        if (!vivo) return
        if (r.ok) {
          const nova = await c!.auth.getSession()
          if (!vivo) return
          setEmail(nova.data.session?.user?.email ?? '')
          setFase('formulario')
          return
        }
        setFase('sem-sessao')
        setRecado({ tom: 'erro', texto: r.erro ?? 'Esse link já venceu ou foi usado. Peça outro abaixo.' })
        return
      }

      if (!vivo) return
      setFase('sem-sessao')
      const aviso = erroDaUrl()
      if (aviso) setRecado({ tom: 'erro', texto: aviso })
    }

    void abrir().catch(() => {
      if (vivo) setFase('sem-sessao')
    })
    return () => {
      vivo = false
    }
  }, [])

  async function salvar(event: React.FormEvent) {
    event.preventDefault()
    if (senha.length < MENOR_SENHA) {
      setRecado({ tom: 'erro', texto: `A senha precisa de pelo menos ${MENOR_SENHA} caracteres.` })
      return
    }
    if (senha !== confirmacao) {
      setRecado({ tom: 'erro', texto: 'As duas senhas precisam ser iguais.' })
      return
    }
    setOcupado('salvar')
    setRecado(null)
    const r = await definirNovaSenha(senha)
    if (!r.ok) {
      setOcupado(null)
      setRecado({ tom: 'erro', texto: r.erro ?? 'Não deu para trocar a senha agora.' })
      return
    }
    // A sessão da recuperação já vale: ligar a licença aqui evita pedir login de
    // novo logo depois de trocar a senha.
    await entrarComoAssinante()
    setOcupado(null)
    setFase('pronta')
  }

  async function pedirOutro() {
    if (!email.trim()) {
      setRecado({ tom: 'erro', texto: 'Digite o e-mail da conta para receber outro link.' })
      return
    }
    setOcupado('pedir')
    setRecado(null)
    const r = await pedirNovaSenha(email)
    setOcupado(null)
    setRecado(
      r.ok
        ? { tom: 'ok', texto: 'Se existir conta com esse e-mail, o link novo chega em instantes. Confira o spam.' }
        : { tom: 'erro', texto: r.erro ?? 'Não deu para pedir outro link agora.' }
    )
  }

  return (
    <PublicShell atual="entrar">
      <div className="mx-auto w-full max-w-md">
        <div className={CAIXA}>
          <p className={ROTULO}>Conta HypeFC</p>

          {fase === 'checando' ? (
            <>
              <h1 className="mt-2 text-[22px] font-bold leading-tight tracking-tight text-ink">Conferindo o link</h1>
              <p className="mt-2 flex items-center gap-2 text-[13px] text-ink-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Um instante.
              </p>
            </>
          ) : null}

          {fase === 'formulario' ? (
            <>
              <h1 className="mt-2 text-[22px] font-bold leading-tight tracking-tight text-ink">Escolha a senha nova</h1>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
                {email ? (
                  <>
                    Conta <span className="text-ink">{email}</span>. A senha antiga deixa de valer assim que você
                    salvar.
                  </>
                ) : (
                  'A senha antiga deixa de valer assim que você salvar.'
                )}
              </p>

              <form onSubmit={(event) => void salvar(event)} noValidate className="mt-5">
                <label htmlFor="nova-senha" className="text-[12px] text-ink-3">
                  Nova senha
                </label>
                <input
                  id="nova-senha"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={MENOR_SENHA}
                  value={senha}
                  onChange={(event) => setSenha(event.target.value)}
                  placeholder={`pelo menos ${MENOR_SENHA} caracteres`}
                  className={CAMPO}
                />

                <div className="mt-3">
                  <label htmlFor="nova-senha-2" className="text-[12px] text-ink-3">
                    Repita a senha
                  </label>
                  <input
                    id="nova-senha-2"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={MENOR_SENHA}
                    value={confirmacao}
                    onChange={(event) => setConfirmacao(event.target.value)}
                    placeholder="a mesma senha"
                    className={CAMPO}
                  />
                </div>

                <button type="submit" disabled={ocupado !== null} className={`${BOTAO_PRIMARIO} mt-4 w-full`}>
                  {ocupado === 'salvar' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Salvar senha nova
                </button>
              </form>

              {recado ? (
                <p
                  role="status"
                  aria-live="polite"
                  className={`mt-3 border px-3 py-2 text-[12px] leading-snug ${
                    recado.tom === 'erro' ? 'border-carimbo/30 text-carimbo' : 'border-rule text-ink-2'
                  }`}
                >
                  {recado.texto}
                </p>
              ) : null}

              <p className="mt-4 text-[12px] text-ink-3">
                <Link className={LINK} href="/conta">
                  Ir para a minha conta
                </Link>
              </p>
            </>
          ) : null}

          {fase === 'pronta' ? (
            <>
              <h1 className="mt-2 text-[22px] font-bold leading-tight tracking-tight text-ink">Senha salva</h1>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
                É a senha que vale de agora em diante, em qualquer aparelho. A sessão deste navegador já está com a sua
                conta.
              </p>
              <Link href="/conta" className={`${BOTAO_PRIMARIO} mt-4`}>
                Ir para a minha conta
              </Link>
            </>
          ) : null}

          {fase === 'sem-sessao' ? (
            <>
              <h1 className="mt-2 text-[22px] font-bold leading-tight tracking-tight text-ink">Esse link não abriu</h1>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
                {recado?.texto ?? 'O link de nova senha não está mais valendo.'} Digite o e-mail da conta e peça outro.
              </p>

              <div className="mt-4">
                <label htmlFor="email-outro-link" className="text-[12px] text-ink-3">
                  E-mail da conta
                </label>
                <input
                  id="email-outro-link"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="voce@email.com"
                  className={CAMPO}
                />
                <button
                  type="button"
                  onClick={() => void pedirOutro()}
                  disabled={ocupado !== null}
                  className={`${BOTAO_SECUNDARIO} mt-3 w-full`}
                >
                  {ocupado === 'pedir' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Pedir outro link
                </button>
              </div>

              {recado?.tom === 'ok' ? (
                <p
                  role="status"
                  aria-live="polite"
                  className="mt-3 border border-verde/25 px-3 py-2 text-[12px] leading-snug text-ink"
                >
                  {recado.texto}
                </p>
              ) : null}

              <p className="mt-5 text-[12px] text-ink-3">
                <Link className={LINK} href="/entrar">
                  Voltar para a entrada
                </Link>
              </p>
            </>
          ) : null}
        </div>
      </div>
    </PublicShell>
  )
}
