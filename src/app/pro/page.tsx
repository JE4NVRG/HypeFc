import type { Metadata } from 'next'
import Link from 'next/link'

import { PublicShell } from '@/components/site/PublicShell'
import { BOTAO_PRIMARIO, BOTAO_SECUNDARIO, CAIXA, LINK, ROTULO } from '@/components/site/estilos'

export const metadata: Metadata = {
  title: 'HypeFC Pro · alerta antes da rodada e registro do que foi previsto',
  description:
    'Alerta quando o time que você segue joga, com a probabilidade que o modelo publicou antes do apito, e o registro do que acertou e errou. R$ 9,90/mês ou R$ 79/ano.',
}

/** Mesmo link de checkout do painel (constante do build). */
const CHECKOUT_URL = (process.env.NEXT_PUBLIC_CHECKOUT_URL ?? '').trim()

const NUMEROS = [
  { valor: '0,629', rotulo: 'Brier do modelo', nota: 'n = 1.203 jogos' },
  { valor: '0,667', rotulo: 'Chute uniforme', nota: '1/3 para cada lado' },
  { valor: '46,5%', rotulo: 'Favorito do modelo', nota: 'acerto do palpite' },
  { valor: '46,5%', rotulo: 'Melhor colocado', nota: 'mesma taxa, sem modelo' },
]

const PRO_LIBERA = [
  {
    titulo: 'Alerta antes da rodada',
    texto:
      'Quando um time que você segue entra em campo, chega uma notificação com o horário do jogo e a probabilidade que o modelo publicou. Um alerta por jogo, no máximo.',
  },
  {
    titulo: 'Até 20 times seguidos',
    texto:
      'No plano gratuito são 3. O Pro sobe para 20, o que cobre uma liga inteira mais os seus times de fora dela.',
  },
  {
    titulo: 'Histórico do registro',
    texto:
      'O que o modelo previa para os jogos dos times que você segue, gravado antes do apito e liquidado depois, com o resultado ao lado. Sem edição posterior.',
  },
]

const COMPARATIVO = [
  { item: 'Painel completo: rodada, ligas, esportes, recorde público', gratis: true, pro: true },
  { item: 'Times seguidos', gratis: '3', pro: '20' },
  { item: 'Alerta antes da rodada', gratis: false, pro: true },
  { item: 'Histórico do registro', gratis: false, pro: true },
]

const PASSOS = [
  { n: '1', titulo: 'Crie a conta', texto: 'Google ou e-mail. Sem cartão, sem instalar nada.' },
  { n: '2', titulo: 'Siga os times', texto: 'No confronto de qualquer jogo, no botão Seguir.' },
  { n: '3', titulo: 'Receba o alerta', texto: 'No navegador, antes da bola rolar, com a probabilidade medida.' },
]

const PERGUNTAS = [
  {
    q: 'Isso é palpite de aposta?',
    a: 'Não. O alerta informa o horário do jogo e a probabilidade que o modelo já publicou, com o registro aberto para conferência. O HypeFC não é casa de aposta, não recebe aposta e não promete retorno financeiro.',
  },
  {
    q: 'Vocês garantem acerto?',
    a: 'Não, e o número está na mesa: medido em 1.203 jogos, o modelo tem Brier 0,629 contra 0,667 de um chute uniforme. Isso é calibração, não vantagem. O favorito dele acerta 46,5%, exatamente a mesma taxa de olhar a classificação. O que o Pro entrega é aviso e registro.',
  },
  {
    q: 'Preciso instalar aplicativo?',
    a: 'Não. O alerta usa a notificação do próprio navegador e o painel é web. Se você desligar a permissão, perde o alerta, não o acesso.',
  },
  {
    q: 'Como cancelo?',
    a: 'No próprio painel, sem falar com ninguém. A cobrança para e o acesso continua até o fim do período que você já pagou.',
  },
  {
    q: 'O que tem no plano gratuito?',
    a: 'O painel completo: rodada, ligas, esportes e o recorde público. Segue até 3 times e não recebe alerta.',
  },
  {
    q: 'O que vocês fazem com os meus dados?',
    a: 'Guardamos o e-mail da conta e os times que você segue, para entregar o alerta. Nada além disso. Os detalhes estão na Política de privacidade.',
  },
]

function Marca({ on }: { on: boolean | string }) {
  if (typeof on === 'string') return <span className="font-mono text-[13px] text-ink">{on}</span>
  return on ? (
    <span className="font-mono text-[13px] text-ink" aria-label="incluído">
      ✓
    </span>
  ) : (
    <span className="font-mono text-[13px] text-ink-3" aria-label="não incluído">
      —
    </span>
  )
}

export default function Pro() {
  return (
    <PublicShell atual="pro">
      <section>
        <p className={ROTULO}>HypeFC Pro</p>
        <h1 className="mt-3 max-w-4xl text-[32px] font-bold leading-[1.1] tracking-tight text-ink sm:text-[42px]">
          O aviso chega antes da rodada.
          <br className="hidden sm:block" /> O registro fica guardado.
        </h1>

        <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[1.15fr_1fr] lg:items-start lg:gap-12">
          <div>
            <p className="max-w-xl text-[15px] leading-relaxed text-ink-2">
              O HypeFC acompanha as principais ligas e avisa quando um time que você segue entra em campo, com a
              probabilidade que o modelo publicou antes do apito. Depois, mostra o que acertou e o que errou, jogo por
              jogo, sem editar nada depois.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              {CHECKOUT_URL ? (
                <a href={CHECKOUT_URL} target="_blank" rel="noopener noreferrer" className={BOTAO_PRIMARIO}>
                  Assinar Pro · R$ 9,90/mês
                </a>
              ) : (
                <Link href="/criar-conta" className={BOTAO_PRIMARIO}>
                  Criar conta grátis
                </Link>
              )}
              <Link href="/criar-conta" className={BOTAO_SECUNDARIO}>
                Criar conta grátis
              </Link>
            </div>

            <p className="mt-3 text-[12px] leading-snug text-ink-3">
              R$ 79 no plano anual, quando você quiser economizar. Cancela no painel, sem falar com ninguém. O plano
              gratuito continua existindo e não pede cartão.
            </p>
          </div>

          <div className={CAIXA}>
            <p className={ROTULO}>O que o modelo entrega (medido)</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
              {NUMEROS.map((n) => (
                <div key={n.rotulo}>
                  <dd className="font-mono text-[24px] font-semibold leading-none text-verde-2">{n.valor}</dd>
                  <dt className="mt-1 text-[12px] font-medium leading-tight text-ink">{n.rotulo}</dt>
                  <p className="text-[11px] leading-tight text-ink-3">{n.nota}</p>
                </div>
              ))}
            </dl>
            <p className="mt-4 border-t border-rule pt-3 text-[12px] leading-relaxed text-ink-2">
              Prova de honestidade: o modelo é calibrado e <strong className="font-semibold text-ink">não tem
              vantagem contra a classificação</strong>. O que o Pro vende é alerta e registro, não palpite.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="pro-libera" className="mt-14">
        <h2 id="pro-libera" className="text-[20px] font-semibold tracking-tight text-ink sm:text-[24px]">
          O que o Pro libera
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {PRO_LIBERA.map((b) => (
            <div key={b.titulo} className={CAIXA}>
              <h3 className="text-[14px] font-semibold text-ink">{b.titulo}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{b.texto}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="pro-como" className="mt-14">
        <h2 id="pro-como" className="text-[20px] font-semibold tracking-tight text-ink sm:text-[24px]">
          Como funciona
        </h2>
        <ol className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {PASSOS.map((p) => (
            <li key={p.n} className={CAIXA}>
              <span className="font-mono text-[13px] text-ink-3">passo {p.n}</span>
              <h3 className="mt-1 text-[14px] font-semibold text-ink">{p.titulo}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{p.texto}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="pro-comparativo" className="mt-14">
        <h2 id="pro-comparativo" className="text-[20px] font-semibold tracking-tight text-ink sm:text-[24px]">
          Grátis e Pro, lado a lado
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className={`${ROTULO} py-2.5 pr-3`}>
                  Recurso
                </th>
                <th scope="col" className={`${ROTULO} py-2.5 pr-3`}>
                  Grátis
                </th>
                <th scope="col" className={`${ROTULO} py-2.5`}>
                  Pro
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARATIVO.map((linha) => (
                <tr key={linha.item} className="border-b border-rule last:border-b-0">
                  <th scope="row" className="py-3 pr-3 text-[13px] font-normal text-ink-2">
                    {linha.item}
                  </th>
                  <td className="py-3 pr-3">
                    <Marca on={linha.gratis} />
                  </td>
                  <td className="py-3">
                    <Marca on={linha.pro} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="pro-painel" className="mt-14">
        <div className={`${CAIXA} sm:flex sm:items-center sm:justify-between sm:gap-6`}>
          <div>
            <h2 id="pro-painel" className="text-[18px] font-semibold tracking-tight text-ink sm:text-[20px]">
              O painel é público. Veja antes de assinar.
            </h2>
            <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-2">
              Rodada, ligas, esportes e o recorde medido ficam abertos, sem login e sem cartão. O Pro não esconde o
              painel: ele acrescenta aviso, teto maior de times e histórico.
            </p>
          </div>
          <div className="mt-4 shrink-0 sm:mt-0">
            <Link href="/" className={BOTAO_SECUNDARIO}>
              Abrir o painel agora
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="pro-faq" className="mt-14">
        <h2 id="pro-faq" className="text-[20px] font-semibold tracking-tight text-ink sm:text-[24px]">
          Perguntas que a gente recebe
        </h2>
        <div className="mt-4 space-y-2">
          {PERGUNTAS.map((item) => (
            <details key={item.q} className={CAIXA}>
              <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 text-[14px] font-medium text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/60 [&::-webkit-details-marker]:hidden">
                {item.q}
                <span aria-hidden="true" className="font-mono text-[13px] text-ink-3">
                  +
                </span>
              </summary>
              <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-2">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className={`mt-14 ${CAIXA}`} aria-labelledby="pro-final">
        <h2 id="pro-final" className="text-[18px] font-semibold tracking-tight text-ink sm:text-[20px]">
          Comece grátis. O Pro é para quem quer o aviso antes da bola rolar.
        </h2>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-2">
          A conta gratuita já libera o painel inteiro e 3 times seguidos. Sem cartão, sem instalar nada, e você pode
          sair quando quiser.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Link href="/criar-conta" className={BOTAO_SECUNDARIO}>
            Criar conta grátis
          </Link>
          {CHECKOUT_URL ? (
            <a href={CHECKOUT_URL} target="_blank" rel="noopener noreferrer" className={BOTAO_PRIMARIO}>
              Assinar Pro agora
            </a>
          ) : (
            <Link href="/entrar" className={BOTAO_PRIMARIO}>
              Entrar na minha conta
            </Link>
          )}
        </div>
        {!CHECKOUT_URL ? (
          <p className="mt-3 text-[12px] text-ink-3">
            A assinatura abre em breve. A conta gratuita já funciona hoje.
          </p>
        ) : null}
        <p className="mt-4 text-[12px] text-ink-3">
          Dúvidas sobre cobrança ou cancelamento:{' '}
          <a className={LINK} href="mailto:jean@je4ndev.com">
            jean@je4ndev.com
          </a>
          .
        </p>
      </section>
    </PublicShell>
  )
}
