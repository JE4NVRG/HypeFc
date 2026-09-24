import type { Metadata } from 'next'

import { DocsShell } from '@/components/site/DocsShell'

export const metadata: Metadata = {
  title: 'Termos de uso · HypeFC',
  description: 'O que o HypeFC é, o que a assinatura Pro inclui, cancelamento e reembolso.',
}

const S = {
  h1: 'text-xl font-semibold tracking-tight text-ink',
  h2: 'text-sm font-semibold text-ink',
  p: 'text-[13px] leading-relaxed text-ink-3',
  ul: 'space-y-1 text-[13px] leading-relaxed text-ink-3',
  link: 'text-verde-2 underline decoration-verde/30 underline-offset-2 hover:decoration-verde focus:outline-none focus-visible:ring-2 focus-visible:ring-sinal/60 rounded-lg',
}

export default function Termos() {
  return (
    <DocsShell atual="termos">
      <h1 className={S.h1}>Termos de uso</h1>
      <p className={`${S.p} mt-1`}>Última atualização: 23 de setembro de 2026.</p>

      <section className="mt-6 space-y-2">
        <h2 className={S.h2}>1. O que o HypeFC é</h2>
        <p className={S.p}>
          O HypeFC é um painel <strong className="text-ink-2">informativo</strong> que organiza dados públicos de
          esportes (placares, calendários, estatísticas) e publica a probabilidade calculada por um modelo estatístico
          próprio, junto com o registro de desempenho medido desse modelo.
        </p>
        <p className={S.p}>
          <strong className="text-ink-2">O HypeFC não é casa de aposta</strong>, não intermedeia apostas, não recebe
          dinheiro de apostas e não indica que você aposte. Nada aqui é promessa de resultado: o registro publicado mostra
          que o modelo é calibrado e que <em>não</em> supera a referência mais simples de acerto no palpite. Você decide o
          que fazer com a informação, por sua conta e risco.
        </p>
      </section>

      <section className="mt-6 space-y-2">
        <h2 className={S.h2}>2. Plano gratuito e assinatura Pro</h2>
        <ul className={`${S.ul} list-disc pl-5`}>
          <li>
            <strong className="text-ink-2">Gratuito:</strong> painel completo, todos os esportes, probabilidades do
            modelo e acompanhamento de até <strong className="text-ink-2">3 times</strong>.
          </li>
          <li>
            <strong className="text-ink-2">Pro:</strong> R$ 9,90 por mês ou R$ 79 por ano, com acompanhamento de até{' '}
            <strong className="text-ink-2">20 times</strong> e alertas no navegador antes da rodada.
          </li>
        </ul>
        <p className={S.p}>
          A cobrança é feita pelo provedor de pagamento escolhido no momento da compra, no valor informado naquela tela.
          Assinaturas mensais valem por 30 dias a partir do pagamento; anuais, por 12 meses. Não há renovação automática
          sem o seu provedor de pagamento confirmar a nova cobrança.
        </p>
      </section>

      <section className="mt-6 space-y-2">
        <h2 className={S.h2}>3. Cancelamento e reembolso</h2>
        <p className={S.p}>
          Você pode cancelar quando quiser, a qualquer momento, pedindo por e-mail — sem formulário e sem justificativa.
          Conforme o art. 49 do Código de Defesa do Consumidor, compras feitas pela internet podem ser desistidas em até{' '}
          <strong className="text-ink-2">7 dias corridos</strong> do pagamento, com devolução integral (100%) do
          valor. Depois desse prazo, o acesso segue valendo até o fim do período já pago, sem novas cobranças.
        </p>
      </section>

      <section className="mt-6 space-y-2">
        <h2 className={S.h2}>4. Alertas</h2>
        <p className={S.p}>
          O alerta avisa <strong className="text-ink-2">quando e contra quem</strong> um time que você segue joga, e
          qual a probabilidade publicada pelo modelo para aquele jogo. A entrega depende de o navegador aceitar notificações
          e pode falhar (notificações desligadas, aparelho desligado, limpeza de dados do navegador). Cada jogo gera no
          máximo um alerta — não há promessa de entrega, e falha de entrega não gera cobrança extra.
        </p>
      </section>

      <section className="mt-6 space-y-2">
        <h2 className={S.h2}>5. Dados de terceiros</h2>
        <p className={S.p}>
          Os dados esportivos vêm de APIs públicas e não oficiais de terceiros. O HypeFC é independente e não tem vínculo
          com ligas, clubes, emissoras ou provedores de dados. Nomes de times, marcas e competições pertencem aos seus
          donos e aparecem aqui apenas para identificar o evento.
        </p>
      </section>

      <section className="mt-6 space-y-2">
        <h2 className={S.h2}>6. Uso aceitável</h2>
        <p className={S.p}>
          Não é permitido revender o acesso, raspar o serviço de forma automatizada, ou usar o painel e os alertas para
          qualquer finalidade ilegal. Podemos suspender o acesso em caso de uso abusivo, com devolução proporcional do
          período não usado.
        </p>
      </section>

      <section className="mt-6 space-y-2">
        <h2 className={S.h2}>7. Contato</h2>
        <p className={S.p}>
          Responsável: Jean Vargas. Dúvidas sobre cobrança, cancelamento ou reembolso:{' '}
          <a className={S.link} href="mailto:jean@je4ndev.com">
            jean@je4ndev.com
          </a>
          .
        </p>
      </section>
    </DocsShell>
  )
}
