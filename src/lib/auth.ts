'use client'

/**
 * Entrada por e-mail e senha, ao lado do Google.
 *
 * Por que existe: o produto vendia licenca anonima (codigo de uso unico trocado por
 * uma chave no navegador) e a conta foi o caminho de recuperacao. Cadastro com senha
 * e o que permite recuperar o acesso sem depender de novo do e-mail de compra.
 *
 * Regra de ouro: quem decide se a conta tem direito e o servidor (`pro_conta_entrar`),
 * nunca o navegador. Depois de autenticar, esta camada so chama a mesma funcao que o
 * login do Google usa e guarda o token que voltou.
 *
 * Detalhe de configuracao do projeto: com "Confirm email" ligado, o Supabase cria o
 * usuario e devolve `session: null` ate a pessoa clicar no link. A tela trata os dois
 * casos (`confirmarEmail`).
 */

import { clienteConta, entrarComoAssinante } from './conta'

export type ResultadoAuth = { ok: boolean; confirmarEmail?: boolean; erro?: string }

const MENSAGENS: { teste: RegExp; texto: string }[] = [
  { teste: /invalid login credentials/i, texto: 'E-mail ou senha não conferem.' },
  { teste: /email not confirmed/i, texto: 'Confirme o e-mail antes de entrar: o link foi enviado na inscrição.' },
  { teste: /user already registered|already been registered/i, texto: 'Esse e-mail já tem conta. Entre por aqui.' },
  { teste: /password should be at least/i, texto: 'A senha precisa de pelo menos 8 caracteres.' },
  { teste: /unable to validate email|invalid format/i, texto: 'Esse e-mail não parece válido.' },
  { teste: /over_email_send_rate_limit|rate limit|too many requests/i, texto: 'Muitas tentativas em pouco tempo. Espere um minuto e tente de novo.' },
  { teste: /signups not allowed|signup is disabled/i, texto: 'Cadastro por e-mail está desligado neste momento. Use o Google.' },
]

function textoDoErro(mensagem: string): string {
  for (const regra of MENSAGENS) {
    if (regra.teste.test(mensagem)) return regra.texto
  }
  return 'Não deu para concluir agora. Tente de novo em instantes.'
}

function emailValido(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)
}

export async function criarContaEmail(email: string, senha: string, nome?: string): Promise<ResultadoAuth> {
  const c = clienteConta()
  if (!c) return { ok: false, erro: 'Registro online ainda não ligado neste site.' }
  const limpo = email.trim().toLowerCase()
  if (!emailValido(limpo)) return { ok: false, erro: 'Digite um e-mail válido.' }
  if (senha.length < 8) return { ok: false, erro: 'A senha precisa de pelo menos 8 caracteres.' }

  const { data, error } = await c.auth.signUp({
    email: limpo,
    password: senha,
    options: nome && nome.trim() ? { data: { full_name: nome.trim() } } : undefined,
  })
  if (error) return { ok: false, erro: textoDoErro(error.message) }

  // Sem sessao, o projeto esta pedindo confirmacao por e-mail antes de liberar entrada.
  if (!data.session) return { ok: true, confirmarEmail: true }

  const licenca = await entrarComoAssinante()
  return { ok: licenca.logado, confirmarEmail: false, erro: licenca.logado ? undefined : 'Conta criada, mas não deu para ligar o acesso agora. Entre pela página de entrada.' }
}

export async function entrarEmail(email: string, senha: string): Promise<ResultadoAuth> {
  const c = clienteConta()
  if (!c) return { ok: false, erro: 'Registro online ainda não ligado neste site.' }
  const limpo = email.trim().toLowerCase()
  if (!emailValido(limpo)) return { ok: false, erro: 'Digite um e-mail válido.' }
  if (senha === '') return { ok: false, erro: 'Digite a senha.' }

  const { error } = await c.auth.signInWithPassword({ email: limpo, password: senha })
  if (error) return { ok: false, erro: textoDoErro(error.message) }

  const licenca = await entrarComoAssinante()
  if (!licenca.logado) return { ok: false, erro: 'Entramos, mas não deu para carregar o acesso. Recarregue a página.' }
  return { ok: true }
}

/** Reenvia o link de confirmacao (o projeto limita o envio por hora). */
export async function reenviarConfirmacao(email: string): Promise<ResultadoAuth> {
  const c = clienteConta()
  if (!c) return { ok: false, erro: 'Registro online ainda não ligado neste site.' }
  const { error } = await c.auth.resend({ type: 'signup', email: email.trim().toLowerCase() })
  if (error) return { ok: false, erro: textoDoErro(error.message) }
  return { ok: true }
}
