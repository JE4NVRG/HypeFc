import type { Metadata } from 'next'

import { FormularioConta } from '@/components/site/FormularioConta'
import { PublicShell } from '@/components/site/PublicShell'
import { CAIXA, ROTULO } from '@/components/site/estilos'

export const metadata: Metadata = {
  title: 'Criar conta · HypeFC',
  description: 'Crie a conta gratuita do HypeFC: painel completo e até 3 times seguidos, sem cartão.',
}

const INCLUIDO = [
  'Painel completo: rodada, ligas, esportes e o recorde público.',
  'Até 3 times seguidos, para acompanhar os seus jogos.',
  'Sem cartão e sem instalar nada.',
]

export default function CriarConta() {
  return (
    <PublicShell atual="criar-conta">
      <div className="mx-auto grid w-full max-w-md grid-cols-1 gap-3">
        <div className={CAIXA}>
          <p className={ROTULO}>Conta gratuita</p>
          <h1 className="mt-2 text-[22px] font-bold leading-tight tracking-tight text-ink">Criar a sua conta</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
            Comece grátis e depois libere o Pro quando quiser. A conta guarda o seu acesso, não o aparelho.
          </p>
          <ul className="mt-4 space-y-1.5">
            {INCLUIDO.map((item) => (
              <li key={item} className="flex gap-2 text-[13px] leading-snug text-ink-2">
                <span aria-hidden="true" className="font-mono text-verde-2">
                  +
                </span>
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-5">
            <FormularioConta modo="criar" />
          </div>
        </div>
      </div>
    </PublicShell>
  )
}
