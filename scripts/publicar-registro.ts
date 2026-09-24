#!/usr/bin/env node
/**
 * Publica o livro-razao do registro: le os snapshots do dia (data/snapshots/*.json)
 * e grava um card por jogo/time na tabela public.registro.
 *
 * Por que existe: o painel mostra o registro agregado, e a pagina de venda promete
 * "o que o modelo previa para os jogos dos times que voce segue, gravado antes do
 * apito e liquidado depois". Isso so e verificavel se cada card ficar guardado com
 * o carimbo de quando foi publicado. Os snapshots ja tem esse carimbo
 * (`captured_at`) e o placar; aqui eles viram linhas consultaveis por conta.
 *
 * Regra de auditoria (a mesma do gatilho registro_imutavel, no banco): o que o
 * modelo publicou nao pode ser editado. Este script sempre manda o mesmo corpo, e
 * o upsert casa por `ref`. Um campo de previsao que mudar faz o banco recusar a
 * linha inteira e o job falhar alto — de proposito. Liquidacao so avanca.
 *
 * Falha alto: snapshot ausente ou ilegivel derruba o job (registro silencioso
 * incompleto e pior que job vermelho, mesma regra do publicar-payloads).
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { adminConfigurado, selecionar, upsert } from './lib/supabaseAdmin.ts'

const SNAPSHOT_DIR = path.join(process.cwd(), 'data', 'snapshots')
const LOTE = 400

interface Card {
  league_id?: string
  league_name?: string
  home?: string
  away?: string
  team?: string
  venue?: 'home' | 'away'
  score?: number
  flags?: string[]
  hit?: boolean | null
  outcome?: 'home' | 'draw' | 'away' | null
  score_home?: number | null
  score_away?: number | null
}

interface Snapshot {
  date?: string
  captured_at?: string
  cards?: Card[]
}

interface Linha {
  ref: string
  dia: string
  capturado_em: string
  league_id: string
  league_name: string
  team: string
  home_team: string
  away_team: string
  venue: 'home' | 'away'
  score: number | null
  flags: string[]
  liquidado: boolean
  outcome: string | null
  gols_casa: number | null
  gols_fora: number | null
  acertou: boolean | null
}

function arquivosDeSnapshot(): string[] {
  if (!existsSync(SNAPSHOT_DIR)) return []
  return readdirSync(SNAPSHOT_DIR)
    .filter((nome) => nome.endsWith('.json'))
    .sort()
    .map((nome) => path.join(SNAPSHOT_DIR, nome))
}

function linhasDoSnapshot(caminho: string): Linha[] {
  let bruto: Snapshot
  try {
    bruto = JSON.parse(readFileSync(caminho, 'utf8')) as Snapshot
  } catch (erro) {
    throw new Error(`${path.basename(caminho)} nao e JSON valido: ${(erro as Error).message}`)
  }

  const dia = bruto.date
  // O carimbo do apito: sem ele o card nao entra (nao daria para provar a ordem).
  const capturado = bruto.captured_at
  if (!dia || !capturado) {
    throw new Error(`${path.basename(caminho)} sem date/captured_at`)
  }

  const linhas: Linha[] = []
  for (const card of bruto.cards ?? []) {
    const { league_id: liga, home, away, team, venue } = card
    if (!liga || !home || !away || !team || (venue !== 'home' && venue !== 'away')) continue

    const liquidado = card.hit === true || card.hit === false
    linhas.push({
      ref: `${dia}|${liga}|${home}|${away}|${team}`,
      dia,
      capturado_em: capturado,
      league_id: liga,
      league_name: card.league_name ?? liga,
      team,
      home_team: home,
      away_team: away,
      venue,
      score: typeof card.score === 'number' ? card.score : null,
      flags: Array.isArray(card.flags) ? card.flags : [],
      liquidado,
      outcome: liquidado ? (card.outcome ?? null) : null,
      gols_casa: liquidado ? (card.score_home ?? null) : null,
      gols_fora: liquidado ? (card.score_away ?? null) : null,
      acertou: liquidado ? card.hit === true : null,
    })
  }
  return linhas
}

async function main(): Promise<void> {
  if (!adminConfigurado()) {
    console.error('ERRO: SUPABASE_URL/SUPABASE_SERVICE_KEY ausentes no ambiente (.env.local)')
    process.exit(1)
  }

  const arquivos = arquivosDeSnapshot()
  if (!arquivos.length) {
    console.error(`ERRO: nenhum snapshot em ${SNAPSHOT_DIR}`)
    process.exit(1)
  }

  const porRef = new Map<string, Linha>()
  for (const caminho of arquivos) {
    for (const linha of linhasDoSnapshot(caminho)) porRef.set(linha.ref, linha)
  }

  const linhas = [...porRef.values()]
  if (!linhas.length) {
    console.error('ERRO: nenhum card com jogo/time identificavel nos snapshots')
    process.exit(1)
  }

  let gravadas = 0
  for (let i = 0; i < linhas.length; i += LOTE) {
    const lote = linhas.slice(i, i + LOTE)
    await upsert('registro', lote, 'ref')
    gravadas += lote.length
  }

  const amostra = await selecionar<{ ref: string; dia: string; liquidado: boolean; acertou: boolean | null }>(
    'registro',
    'select=ref,dia,liquidado,acertou&order=dia.desc&limit=3'
  )

  console.log(`registro: ${gravadas} cards enviados de ${arquivos.length} snapshots`)
  console.log(`registro: leitura de volta trouxe ${amostra.length} linhas; exemplo: ${amostra[0]?.ref ?? 'nada'}`)
}

main().catch((erro) => {
  console.error(`ERRO: ${(erro as Error).message}`)
  process.exit(1)
})
