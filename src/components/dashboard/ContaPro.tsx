'use client'

import { useCallback, useEffect, useState } from 'react'
import { BadgeCheck, Loader2, LogIn, LogOut } from 'lucide-react'

import {
  contaConfigurada,
  entrarComGoogle,
  estadoDaConta,
  sairDaConta,
  type ContaEstado,
} from '@/lib/conta'

/**
 * Conta HypeFC (Google) na aba Pro.
 *
 * Por que existe: o token do navegador resolve o acesso, mas não tem dono — se o
 * cliente limpar os dados ou trocar de celular, perde o Pro. Entrando com a
 * conta, o e-mail passa a ser o dono e o acesso volta em qualquer aparelho.
 *
 * O botão não libera nada por si: quem decide é a RPC `pro_conta_entrar`, que lê
 * o e-mail de dentro do JWT assinado pelo Supabase.
 */
export default function ContaPro() {
  const [estado, setEstado] = useState<ContaEstado | null>(null)
  const [ocupado, setOcupado] = useState<'entrar' | 'sair' | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const recarregar = useCallback(async () => {
    if (!contaConfigurada()) return
    setEstado(await estadoDaConta())
  }, [])

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  if (!contaConfigurada()) return null

  const entrar = async () => {
    setOcupado('entrar')
    const r = await entrarComGoogle()
    if (!r.ok) {
      setOcupado(null)
      setAviso('Não deu para abrir o login do Google agora. Tente de novo em instantes.')
    }
    // se deu certo, a página sai do ar em direção ao Google — nada a fazer aqui
  }

  const sair = async () => {
    setOcupado('sair')
    await sairDaConta()
    setEstado({ logado: false })
    setOcupado(null)
    setAviso('Você saiu da conta neste navegador. O acesso Pro da conta continua valendo em outros aparelhos.')
  }

  if (estado?.logado) {
    return (
      <div className="rounded-lg border border-sky-500/25 bg-sky-500/5 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[13px] font-medium text-sky-300">
              <BadgeCheck className="h-4 w-4" />
              Conta conectada
            </div>
            <p className="mt-1 truncate text-[12px] text-slate-300">
              {estado.email || 'conta Google'} ·{' '}
              {estado.pro ? 'acesso Pro ativo nesta conta' : 'esta conta ainda não tem assinatura'}
            </p>
            {estado.pro && estado.paidUntil ? (
              <p className="mt-0.5 text-[11px] text-slate-400">
                Válido até {new Date(estado.paidUntil).toLocaleDateString('pt-BR')}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => void sair()}
            disabled={ocupado !== null}
            className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-md border border-slate-600/60 px-2.5 text-[12px] text-slate-200 transition hover:border-slate-500 hover:bg-slate-700/40 disabled:opacity-50"
            aria-label="Sair da conta Google"
          >
            {ocupado === 'sair' ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            Sair da conta
          </button>
        </div>
        {aviso ? <p className="mt-2 text-[11px] leading-snug text-slate-300">{aviso}</p> : null}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-800/30 p-3.5">
      <p className="text-[12px] leading-snug text-slate-300">
        Entre com o Google para o acesso <span className="text-slate-200">ficar na sua conta</span> — assim o Pro
        vale em qualquer aparelho, não só neste navegador.
      </p>
      <button
        type="button"
        onClick={() => void entrar()}
        disabled={ocupado !== null}
        className="mt-2.5 inline-flex min-h-[36px] w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-slate-600/70 bg-slate-900/60 px-3 text-[13px] font-medium text-slate-100 transition hover:border-slate-500 hover:bg-slate-800 disabled:opacity-50"
      >
        {ocupado === 'entrar' ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
        Entrar com Google
      </button>
      {aviso ? <p className="mt-2 text-[11px] leading-snug text-amber-200">{aviso}</p> : null}
    </div>
  )
}
