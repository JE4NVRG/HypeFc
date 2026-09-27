#!/usr/bin/env node
/**
 * Prova de entrega do alerta pago (Web Push), sem depender de haver jogo hoje.
 *
 * Por que existe: o `npm run alertas` so envia quando um time seguido joga naquele
 * dia e o jogo ainda nao acabou. Isso e o certo em producao e pessimo para
 * conferir o canal: depois de trocar o par VAPID, mexer no service worker ou
 * perder uma inscricao, nao havia como saber se ainda entrega sem esperar uma
 * rodada inteira.
 *
 * O que este script faz, em uma passada:
 *   1. le os assinantes com Pro ativo e as inscricoes de `push_subs` deles;
 *   2. monta UM aviso com o mesmo `montarPayload` do cron (os numeros saem de
 *      `public/data/ratings.json`, nada inventado);
 *   3. marca o texto como teste e envia pela mesma biblioteca e pelo mesmo par
 *      VAPID do cron;
 *   4. registra o resultado em `alert_log` com `event_key` terminando em
 *      `:teste-entrega`, que nao colide com o alerta do jogo (`<eventId>:rodada`);
 *   5. atualiza `push_subs.last_ok_at`/`fails` igual ao cron.
 *
 * O texto sai marcado como teste de proposito: quem recebe precisa saber que
 * aquilo nao e o alerta da rodada.
 *
 * Uso (da raiz do repo):
 *   npm run alerta:teste                    todas as inscricoes de assinante Pro ativo
 *   npm run alerta:teste -- --email a@b.com  so as inscricoes daquele assinante
 *   npm run alerta:teste -- --seco           mostra o que sairia, sem enviar nem gravar
 *
 * Sai com codigo 1 quando nenhuma inscricao aceitou a entrega (o cron nao usa
 * este script; ele existe para conferir o canal na mao).
 */

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import webpush from 'web-push'
import { montarPayload, truncarEndpoint, type JogoHoje } from './send-alerts.ts'
import type { RatingsPayload } from '../src/lib/ratings.ts'

interface Assinante {
  id: string
  email: string
  plan: string
  status: string
  paid_until: string | null
}

interface Inscricao {
  id: string
  subscriber_id: string
  endpoint: string
  p256dh: string
  auth: string
  fails: number | null
}

interface Rest {
  url: string
  chave: string
}

function arg(nome: string): string | null {
  const i = process.argv.indexOf(nome)
  if (i === -1) return null
  const valor = process.argv[i + 1]
  return valor && !valor.startsWith('--') ? valor : 'sim'
}

const seco = process.argv.includes('--seco')
const soEmail = arg('--email')

/** Cliente REST minimo (PostgREST) com a service key; a service key nunca sai daqui. */
async function rest<T>(cfg: Rest, caminho: string, init: RequestInit = {}): Promise<T[]> {
  const res = await fetch(`${cfg.url}/rest/v1/${caminho}`, {
    ...init,
    headers: {
      apikey: cfg.chave,
      Authorization: `Bearer ${cfg.chave}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...((init.headers as Record<string, string>) || {}),
    },
  })
  const corpo = await res.text()
  if (!res.ok) throw new Error(`Supabase ${res.status} em ${caminho.split('?')[0]}: ${corpo.slice(0, 200)}`)
  if (!corpo) return []
  try {
    const dados = JSON.parse(corpo)
    return Array.isArray(dados) ? dados : [dados]
  } catch {
    return []
  }
}

function cfgSupabase(): Rest | null {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const chave = process.env.SUPABASE_SERVICE_KEY || ''
  if (!url || !chave) return null
  return { url: url.replace(/\/+$/, ''), chave }
}

function lerRatings(): RatingsPayload | null {
  const caminho = path.join(process.cwd(), 'public', 'data', 'ratings.json')
  if (!existsSync(caminho)) return null
  try {
    return JSON.parse(readFileSync(caminho, 'utf8')) as RatingsPayload
  } catch {
    return null
  }
}

/** Dois times reais do ratings, para a linha "modelo: ..." sair com numero verdadeiro. */
function jogoDeTeste(ratings: RatingsPayload | null): JogoHoje {
  const ligas = (ratings as unknown as { leagues?: Record<string, { ratings?: Record<string, number> }> }).leagues || {}
  const liga = ['BSA', 'PL', 'PD', 'SA'].find((id) => ligas[id]?.ratings) || Object.keys(ligas)[0] || 'BSA'
  const times = Object.keys(ligas[liga]?.ratings || {})
  const casa = times.includes('Flamengo') ? 'Flamengo' : times[0] || 'Time da casa'
  const fora = times.find((t) => t !== casa) || 'Time de fora'

  return {
    eventId: `teste-entrega-${Date.now()}`,
    leagueId: liga,
    leagueName: ligas[liga] ? liga : liga,
    kickoff: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    home: casa,
    away: fora,
    homeId: null,
    awayId: null,
    status: 'STATUS_SCHEDULED',
  }
}

async function main(): Promise<void> {
  const cfg = cfgSupabase()
  const publica = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '').trim()
  const privada = (process.env.VAPID_PRIVATE_KEY || '').trim()
  const assunto = (process.env.VAPID_SUBJECT || '').trim()

  if (!cfg) {
    console.log('config pendente: SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_KEY.')
    process.exit(1)
  }
  if (publica.length < 20 || privada.length < 20 || !assunto) {
    console.log('config pendente: par VAPID (NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY) e VAPID_SUBJECT.')
    process.exit(1)
  }

  console.log(`entrega de teste do alerta${seco ? ' (seco: nada e enviado nem gravado)' : ''}`)

  const filtro = soEmail ? `&email=eq.${encodeURIComponent(soEmail)}` : ''
  const assinantes = await rest<Assinante>(
    cfg,
    `subscribers?select=id,email,plan,status,paid_until&plan=eq.pro&status=eq.active${filtro}`
  )
  const agora = Date.now()
  const validos = assinantes.filter((a) => !a.paid_until || new Date(a.paid_until).getTime() > agora)
  if (!validos.length) {
    console.log('nenhum assinante Pro ativo para testar.')
    process.exit(1)
  }

  const ids = validos.map((a) => a.id)
  const inscricoes = await rest<Inscricao>(
    cfg,
    `push_subs?select=id,subscriber_id,endpoint,p256dh,auth,fails&subscriber_id=in.(${ids.join(',')})`
  )
  console.log(`assinantes pro ativos: ${validos.length} · inscricoes de push: ${inscricoes.length}`)
  if (!inscricoes.length) {
    console.log('nenhuma inscricao: ligue os alertas em /conta no navegador que deve receber.')
    process.exit(1)
  }

  const ratings = lerRatings()
  const jogo = jogoDeTeste(ratings)
  const base = montarPayload(jogo, ratings)
  const payload = {
    title: 'Teste de entrega do HypeFC',
    body: `Teste de entrega (nao e da rodada). ${base.body}`,
    tag: 'hypefc-teste-entrega',
    url: base.url,
  }
  console.log(`texto: ${payload.title} · ${payload.body}`)

  if (seco) {
    console.log(`seco: enviaria para ${inscricoes.length} inscricao(oes); nada foi enviado.`)
    return
  }

  webpush.setVapidDetails(assunto, publica, privada)

  let aceitas = 0
  for (const inscricao of inscricoes) {
    const email = validos.find((a) => a.id === inscricao.subscriber_id)?.email || 'sem-email'
    const eventKey = `${jogo.eventId}:${inscricao.id.slice(0, 8)}:teste-entrega`
    let ok = false
    let erro: string | null = null

    try {
      const res = await webpush.sendNotification(
        { endpoint: inscricao.endpoint, keys: { p256dh: inscricao.p256dh, auth: inscricao.auth } },
        JSON.stringify(payload),
        { TTL: 60 * 30 }
      )
      ok = res.statusCode >= 200 && res.statusCode < 300
      console.log(`  ${email} · ${truncarEndpoint(inscricao.endpoint)} -> ${res.statusCode}`)
    } catch (problema) {
      const e = problema as { statusCode?: number; body?: string; message?: string }
      erro = `status=${e.statusCode ?? 'sem'} ${(e.body || e.message || '').slice(0, 120)}`
      console.log(`  ${email} · ${truncarEndpoint(inscricao.endpoint)} -> falhou: ${erro}`)
    }

    if (ok) aceitas += 1

    try {
      await rest(cfg, 'alert_log?on_conflict=subscriber_id,event_key', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([{ subscriber_id: inscricao.subscriber_id, event_key: eventKey, ok, erro }]),
      })
    } catch (problema) {
      console.log(`  aviso: nao registrei ${eventKey} em alert_log (${String(problema).slice(0, 120)})`)
    }

    try {
      await rest(cfg, `push_subs?id=eq.${encodeURIComponent(inscricao.id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(ok ? { last_ok_at: new Date().toISOString(), fails: 0 } : { fails: (inscricao.fails ?? 0) + 1 }),
      })
    } catch {
      /* contador de saude da inscricao: se falhar, a entrega segue valendo */
    }
  }

  console.log(`entregas aceitas: ${aceitas} de ${inscricoes.length}`)
  if (!aceitas) process.exit(1)
}

main().catch((problema) => {
  console.error('entrega de teste falhou:', problema instanceof Error ? problema.message : problema)
  process.exit(1)
})
