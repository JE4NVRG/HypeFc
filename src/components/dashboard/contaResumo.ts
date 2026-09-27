'use client'

import { useEffect, useState } from 'react'

import { contaConfigurada, estadoDaConta, type ContaEstado } from '@/lib/conta'

/**
 * Estado de conta para a navegacao (sidebar e cabecalho do cockpit).
 *
 * Uma leitura por carregamento: a sessao vem do localStorage e o plano de uma
 * RPC barata (`pro_conta_estado`), que so informa — quem libera acesso e a RPC
 * de resgate. Sem Supabase configurado o resumo fica vazio e a navegacao segue
 * como visitante, sem erro na cara de ninguem.
 */
export function useContaResumo(): { conta: ContaEstado | null; pronto: boolean } {
  const [conta, setConta] = useState<ContaEstado | null>(null)
  const [pronto, setPronto] = useState(false)

  useEffect(() => {
    if (!contaConfigurada()) {
      setPronto(true)
      return
    }
    let vivo = true
    estadoDaConta()
      .then((estado) => {
        if (vivo) setConta(estado)
      })
      .catch(() => {
        if (vivo) setConta({ logado: false })
      })
      .finally(() => {
        if (vivo) setPronto(true)
      })
    return () => {
      vivo = false
    }
  }, [])

  return { conta, pronto }
}
