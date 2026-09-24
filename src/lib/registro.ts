'use client'

/**
 * Registro da conta: os cards dos times que a pessoa segue, publicados antes do
 * apito e liquidados depois.
 *
 * Quem responde e a RPC `conta_registro` (Supabase, security definer): ela lê o
 * dono de dentro do JWT e filtra `public.registro` pelos times que ele segue. O
 * navegador não escolhe de quem é o histórico e não fala com a tabela: a tabela
 * tem RLS sem policy, como o resto do projeto.
 *
 * Devolve `null` quando não há conta ou quando o servidor não respondeu; a tela
 * trata a ausência como "ainda não tem registro", nunca como zero mentiroso.
 */

import { clienteConta } from './conta'

export interface LinhaRegistro {
  dia: string
  league_name: string
  home_team: string
  away_team: string
  team: string
  venue: 'home' | 'away'
  score: number | null
  liquidado: boolean
  outcome: 'home' | 'draw' | 'away' | null
  gols_casa: number | null
  gols_fora: number | null
  acertou: boolean | null
  capturado_em: string
}

export interface RegistroConta {
  jogos: number
  acertos: number
  pendentes: number
  times: number
  linhas: LinhaRegistro[]
}

export async function carregarRegistro(limite = 40): Promise<RegistroConta | null> {
  const cliente = clienteConta()
  if (!cliente) return null

  const { data, error } = await cliente.rpc('conta_registro', { p_limite: limite })
  if (error || !data) return null

  const bruto = data as Partial<RegistroConta>
  return {
    jogos: Number(bruto.jogos ?? 0),
    acertos: Number(bruto.acertos ?? 0),
    pendentes: Number(bruto.pendentes ?? 0),
    times: Number(bruto.times ?? 0),
    linhas: Array.isArray(bruto.linhas) ? bruto.linhas : [],
  }
}
