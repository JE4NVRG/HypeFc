'use client'

/**
 * Web Push do HypeFC: inscricao do aparelho para receber o alerta ("seu time
 * joga hoje"), que e o produto pago.
 *
 * Regras que este arquivo respeita:
 * - Nada de window/navigator no topo do modulo: ele e importado por componente
 *   que tambem e renderizado no servidor (o site e export estatico, entao o
 *   HTML e gerado no build). Todo acesso a browser acontece dentro das funcoes.
 * - A chave publica VAPID vem de NEXT_PUBLIC_VAPID_PUBLIC_KEY (inline do build).
 *   Ela e publica por definicao; a privada NUNCA aparece aqui — ela vive so no
 *   .env.local do Mac que roda o cron de entrega.
 * - Sem acesso pro (token do proStore) nao se grava inscricao: `inscrever`
 *   devolve { ok: false, erro: 'sem-acesso' } antes de pedir permissao.
 * - Push v1 e titulo + corpo + url (sem acoes): quem monta o texto e o cron.
 */

import { assinarPush, cancelarPush, temToken } from '@/lib/proStore'

/** Chave publica VAPID do par gerado para o HypeFC (base64url). */
export const VAPID_PUBLIC_KEY: string = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

export type StatusPermissao = 'default' | 'granted' | 'denied' | 'indisponivel'

export interface ResultadoInscricao {
  ok: boolean
  endpoint?: string
  erro?: string
}

/** O navegador tem tudo que o Web Push exige? (service worker + Push + chave) */
export function pushDisponivel(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  if (!('serviceWorker' in navigator)) return false
  if (!('PushManager' in window)) return false
  if (!('Notification' in window)) return false
  // Chave ausente/placeholder nao serve: sem ela o subscribe falha no navegador
  // com um erro generico, entao a checagem acontece antes.
  return VAPID_PUBLIC_KEY.length > 20
}

/** Permissao atual de notificacao (o produto nao mostra alerta sem 'granted'). */
export function statusPermissao(): StatusPermissao {
  if (!pushDisponivel()) return 'indisponivel'
  return Notification.permission as 'default' | 'granted' | 'denied'
}

/** base64url -> Uint8Array (applicationServerKey e bytes, nao string). */
function base64UrlParaBytes(valor: string): Uint8Array {
  const normalizado = valor.replace(/-/g, '+').replace(/_/g, '/')
  const comPadding = normalizado.padEnd(Math.ceil(normalizado.length / 4) * 4, '=')
  const bruto = atob(comPadding)
  const bytes = new Uint8Array(bruto.length)
  for (let i = 0; i < bruto.length; i += 1) bytes[i] = bruto.charCodeAt(i)
  return bytes
}

/** ArrayBuffer -> base64url (e o formato que o Web Push usa nas chaves). */
function bytesParaBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binario = ''
  for (let i = 0; i < bytes.length; i += 1) binario += String.fromCharCode(bytes[i] as number)
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Pede permissao, cria a inscricao no navegador e grava no banco.
 *
 * A ordem importa: sem acesso pro nao se pede permissao (nao faz sentido a
 * pessoa autorizar notificacao para um produto que ela nao tem) e sem permissao
 * nao existe inscricao.
 */
export async function inscrever(): Promise<ResultadoInscricao> {
  if (!pushDisponivel()) return { ok: false, erro: 'indisponivel' }
  if (!temToken()) return { ok: false, erro: 'sem-acesso' }

  try {
    const permissao = await Notification.requestPermission()
    if (permissao !== 'granted') return { ok: false, erro: 'permissao-negada' }

    // `ready` resolve com o service worker que controla a pagina (o PwaRegister
    // ja registrou o sw.js); se ainda nao houver registro ativo, fica pendente
    // em vez de falhar na primeira visita.
    const registro = await navigator.serviceWorker.ready
    const inscricao = await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlParaBytes(VAPID_PUBLIC_KEY) as BufferSource,
    })

    const p256dh = inscricao.getKey('p256dh')
    const auth = inscricao.getKey('auth')
    if (!p256dh || !auth) {
      await inscricao.unsubscribe().catch(() => false)
      return { ok: false, erro: 'sem-chaves' }
    }

    const gravou = await assinarPush({
      endpoint: inscricao.endpoint,
      p256dh: bytesParaBase64Url(p256dh),
      auth: bytesParaBase64Url(auth),
    })

    if (!gravou.ok) {
      // Inscricao criada no navegador mas nao gravada no banco: desfaz para nao
      // deixar um endpoint orfao (o cron nunca o encontraria).
      await inscricao.unsubscribe().catch(() => false)
      return { ok: false, erro: gravou.erro || 'nao-gravou' }
    }

    return { ok: true, endpoint: inscricao.endpoint }
  } catch (error) {
    return { ok: false, erro: mensagemDe(error) }
  }
}

/**
 * Desliga os alertas neste navegador: cancela a inscricao local e apaga a linha
 * de `push_subs` (senao o cron continuaria tentando entregar aqui).
 */
export async function desinscrever(): Promise<{ ok: boolean; erro?: string }> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { ok: false, erro: 'indisponivel' }
  }
  if (!('serviceWorker' in navigator)) return { ok: false, erro: 'indisponivel' }

  try {
    const registro = await navigator.serviceWorker.ready
    const inscricao = await registro.pushManager.getSubscription()
    if (!inscricao) return { ok: true }

    const endpoint = inscricao.endpoint
    await inscricao.unsubscribe()
    const apagou = await cancelarPush(endpoint)
    // O navegador ja nao recebe nada; a linha orfa no banco nao e motivo para
    // reportar falha para o usuario (o proximo push_save sobrescreve o endpoint).
    return apagou.ok ? { ok: true } : { ok: false, erro: apagou.erro || 'nao-apagou' }
  } catch (error) {
    return { ok: false, erro: mensagemDe(error) }
  }
}

function mensagemDe(error: unknown): string {
  if (error instanceof Error && error.message) return error.message.slice(0, 120)
  return 'falha'
}
