import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacidade · HypeFC',
  description: 'Quais dados o HypeFC guarda, para que servem e como pedir a exclusão.',
}

const S = {
  h1: 'text-xl font-semibold tracking-tight text-slate-100',
  h2: 'text-sm font-semibold text-slate-200',
  p: 'text-[13px] leading-relaxed text-slate-400',
  ul: 'space-y-1 text-[13px] leading-relaxed text-slate-400',
  link: 'text-emerald-400 underline decoration-emerald-400/30 underline-offset-2 hover:decoration-emerald-400',
}

export default function Privacidade() {
  return (
    <article className="mx-auto max-w-2xl px-5 py-8">
      <p className="text-[11px] uppercase tracking-wider text-slate-500">HypeFC</p>
      <h1 className={S.h1}>Política de privacidade</h1>
      <p className={`${S.p} mt-1`}>Última atualização: 23 de setembro de 2026.</p>

      <section className="mt-6 space-y-2">
        <h2 className={S.h2}>O painel público não pede cadastro</h2>
        <p className={S.p}>
          Você pode usar o painel inteiro sem informar nada. Os dados esportivos são buscados{' '}
          <strong className="text-slate-300">direto do seu navegador</strong> na API pública da ESPN; o HypeFC não
          intermedia essa chamada. Não usamos cookies de rastreamento, não usamos analytics de terceiros e não montamos
          perfil de navegação.
        </p>
      </section>

      <section className="mt-6 space-y-2">
        <h2 className={S.h2}>O que guardamos, e só quando você informa</h2>
        <ul className={`${S.ul} list-disc pl-5`}>
          <li>
            <strong className="text-slate-300">E-mail</strong> — para falar sobre a sua assinatura e identificar o acesso.
            Nome é opcional.
          </li>
          <li>
            <strong className="text-slate-300">Times que você segue</strong> — para saber qual alerta faz sentido enviar.
          </li>
          <li>
            <strong className="text-slate-300">Inscrição de notificação do navegador</strong> (um endereço técnico de
            entrega, mais duas chaves públicas do seu navegador) — é isso que permite o alerta chegar ao seu aparelho.
          </li>
          <li>
            <strong className="text-slate-300">Registro de pagamento</strong> (valor, data, identificador do provedor) —
            obrigação fiscal e controle de acesso. <strong className="text-slate-300">Não</strong> guardamos dados de
            cartão: quem processa o pagamento é o provedor.
          </li>
        </ul>
      </section>

      <section className="mt-6 space-y-2">
        <h2 className={S.h2}>Como o seu acesso é protegido</h2>
        <p className={S.p}>
          Não existe senha no HypeFC. Depois da compra você recebe um código de uso único, que troca por uma chave de
          acesso aleatória guardada apenas no seu navegador. No servidor ficam somente hashes (SHA-256) — nem o código nem
          a chave são armazenados em texto legível. Ninguém que acesse o banco consegue reconstruir o seu acesso.
        </p>
      </section>

      <section className="mt-6 space-y-2">
        <h2 className={S.h2}>Compartilhamento</h2>
        <p className={S.p}>
          Não vendemos, alugamos nem cedemos os seus dados. Eles são usados exclusivamente para entregar o serviço. Os
          dados ficam hospedados no Supabase (infraestrutura em nuvem), e as notificações são entregues pelo serviço de
          push do próprio navegador que você usa.
        </p>
      </section>

      <section className="mt-6 space-y-2">
        <h2 className={S.h2}>Por quanto tempo</h2>
        <p className={S.p}>
          Enquanto a assinatura existir e por até 30 dias depois do encerramento, para eventuais pedidos de suporte e
          obrigações fiscais. Passado esse prazo, os dados de identificação são apagados.
        </p>
      </section>

      <section className="mt-6 space-y-2">
        <h2 className={S.h2}>Seus direitos (LGPD)</h2>
        <p className={S.p}>
          Você pode pedir acesso, correção, portabilidade ou exclusão dos seus dados, e revogar o consentimento, a
          qualquer momento, escrevendo para{' '}
          <a className={S.link} href="mailto:jean@je4ndev.com">
            jean@je4ndev.com
          </a>
          . Respondemos em até 15 dias. Excluir os dados encerra a assinatura e remove os seus alertas. Você também pode
          desativar as notificações no próprio navegador, a qualquer momento, sem falar com ninguém.
        </p>
      </section>

      <nav className="mt-8 flex flex-wrap gap-4 border-t border-slate-800 pt-4 text-[12px]">
        <Link className={S.link} href="/">
          ← Voltar ao painel
        </Link>
        <Link className={S.link} href="/termos">
          Termos de uso
        </Link>
      </nav>
    </article>
  )
}
