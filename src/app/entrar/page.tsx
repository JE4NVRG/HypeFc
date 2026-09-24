import type { Metadata } from 'next'

import { FormularioConta } from '@/components/site/FormularioConta'
import { PublicShell } from '@/components/site/PublicShell'
import { CAIXA, ROTULO } from '@/components/site/estilos'

export const metadata: Metadata = {
  title: 'Entrar · HypeFC',
  description: 'Entre com Google ou e-mail para abrir a sua conta do HypeFC.',
}

export default function Entrar() {
  return (
    <PublicShell atual="entrar">
      <div className="mx-auto w-full max-w-md">
        <div className={CAIXA}>
          <p className={ROTULO}>Conta HypeFC</p>
          <h1 className="mt-2 text-[22px] font-bold leading-tight tracking-tight text-ink">
            Entrar para ver o seu acesso
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
            A conta é o que devolve o seu acesso quando você troca de aparelho: o que você segue, o alerta e o
            histórico ficam ligados ao e-mail da entrada.
          </p>
          <div className="mt-5">
            <FormularioConta modo="entrar" />
          </div>
        </div>
      </div>
    </PublicShell>
  )
}
