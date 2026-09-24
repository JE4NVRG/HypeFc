#!/usr/bin/env node
/**
 * Publica no Supabase os payloads que o painel lê em runtime.
 *
 * Por que existe: até aqui o registro do dia só aparecia novo no site depois de
 * um build+deploy, porque os JSON viajavam dentro do pacote estático. Com o
 * payload no banco (tabela site_payloads), o job diário atualiza o número sem
 * publicar nada — o painel lê por RPC `payload_publico`.
 *
 * O deploy continua acontecendo (código novo precisa dele); o que deixa de
 * depender do deploy é o dado.
 *
 * Falha alto: se um payload esperado não existir, este script sai com erro e o
 * systemd avisa no grupo. Payload velho silencioso é pior que job vermelho.
 */

import { existsSync, readFileSync } from 'node:fs'
import { adminConfigurado, upsert } from './lib/supabaseAdmin.ts'

/** Espelho da lista fechada de public.payload_publico() — o que não está aqui não sai. */
const PAYLOADS = [
  'hype-record',
  'ratings',
  'title-odds',
  'probability-record',
  'probability-forward',
] as const

async function main(): Promise<void> {
  if (!adminConfigurado()) {
    console.error('ERRO: SUPABASE_URL/SUPABASE_SERVICE_KEY ausentes no ambiente (.env.local)')
    process.exit(1)
  }

  let publicados = 0
  for (const nome of PAYLOADS) {
    const caminho = `public/data/${nome}.json`
    if (!existsSync(caminho)) {
      console.error(`ERRO: ${caminho} ausente — o payload do dia não foi gerado`)
      process.exit(1)
    }

    const bruto = readFileSync(caminho, 'utf8')
    let payload: unknown
    try {
      payload = JSON.parse(bruto)
    } catch (erro) {
      console.error(`ERRO: ${caminho} não é JSON válido: ${(erro as Error).message}`)
      process.exit(1)
    }

    await upsert('site_payloads', { nome, payload, atualizado_em: new Date().toISOString() }, 'nome')
    console.log(`${nome}: ${bruto.length} bytes publicados`)
    publicados += 1
  }

  console.log(`payloads: ${publicados} de ${PAYLOADS.length} publicados no Supabase`)
}

main().catch((erro) => {
  console.error(`ERRO: ${(erro as Error).message}`)
  process.exit(1)
})
