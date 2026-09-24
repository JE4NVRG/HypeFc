import type { Metadata } from 'next'

import { DocsShell } from '@/components/site/DocsShell'

export const metadata: Metadata = {
  title: 'Privacidade · HypeFC',
  description: 'Quais dados o HypeFC guarda, para que servem e como pedir a exclusão.',
}

const S = {
  h1: 'text-xl font-semibold tracking-tight text-ink',
  h2: 'text-sm font-semibold text-ink',
  p: 'text-[13px] leading-relaxed text-ink-3',
  ul: 'space-y-1 text-[13px] leading-relaxed text-ink-3',
  link: 'text-verde-2 underline decoration-verde/30 underline-offset-2 hover:decoration-verde focus:outline-none focus-visible:ring-2 focus-visible:ring-sinal/60 rounded-lg',
}

export default function Privacidade() {
  return (
    <DocsShell atual="privacidade">
      <h1 className={S.h1}>Política de privacidade</h1>
      <p className={`${S.p} mt-1`}>Última atualização: 23 de setembro de 2026.</p>

      <section className="mt-6 space-y-2">
        <h2 className={S.h2}>O painel público não pede cadastro</h2>
        <p className={S.p}>
          Você pode usar o painel inteiro sem informar nada. Os dados esportivos são buscados{' '}
          <strong className="text-ink-2">direto do seu navegador</strong> na API pública da ESPN; o HypeFC não
          intermedia essa chamada. Não usamos cookies de rastreamento, não usamos analytics de terceiros e não montamos
          perfil de navegação.
        </p>
      </section>

      <section className="mt-6 space-y-2">
        <h2 className={S.h2}>O que guardamos, e só quando você informa</h2>
        <ul className={`${S.ul} list-disc pl-5`}>
          <li>
            <strong className="text-ink-2">E-mail</strong>: para falar sobre a sua assinatura e identificar o acesso.
            Nome é opcional.
          </li>
          <li>
            <strong className="text-ink-2">Times que você segue</strong>: para saber qual alerta faz sentido enviar.
          </li>
          <li>
            <strong className="text-ink-2">Inscrição de notificação do navegador</strong> (um endereço técnico de
            entrega, mais duas chaves públicas do seu navegador): é isso que permite o alerta chegar ao seu aparelho.
          </li>
          <li>
            <strong className="text-ink-2">Registro de pagamento</strong> (valor, data, identificador do provedor):
            obrigação fiscal e controle de acesso. <strong className="text-ink-2">Não</strong> guardamos dados de
            cartão: quem processa o pagamento é o provedor.
          </li>
        </ul>
      </section>

      <section className="mt-6 space-y-2">
        <h2 className={S.h2}>Entrar com o Google (opcional)</h2>
        <p className={S.p}>
          Você pode usar o HypeFC inteiro sem conta. Entrar com o Google serve para uma coisa só:{' '}
          <strong className="text-ink-2">guardar o seu acesso na conta</strong>, para o Pro valer em qualquer
          aparelho — sem isso, o acesso fica preso ao navegador em que a compra foi feita.
        </p>
        <p className={S.p}>
          Do Google recebemos apenas o básico do seu perfil: <strong className="text-ink-2">e-mail</strong>, nome e
          foto de perfil, se houver. Não pedimos e não temos acesso a Gmail, Drive, contatos, calendário nem a qualquer
          outro conteúdo da sua conta. A autenticação é feita pelo Supabase Auth; a senha do Google nunca passa pelo
          HypeFC e nós não temos como vê-la.
        </p>
        <p className={S.p}>
          O uso desses dados é limitado a identificação e entrega do serviço, conforme a política de dados do usuário
          dos serviços de API do Google. Você pode sair da conta a qualquer momento na aba Pro — o acesso Pro continua
          válido onde a conta estiver conectada — e pode pedir a exclusão da conta pelos canais abaixo.
        </p>
      </section>

      <section className="mt-6 space-y-2">
        <h2 className={S.h2}>Como o seu acesso é protegido</h2>
        <p className={S.p}>
          Não existe senha própria do HypeFC. Sem conta, depois da compra você recebe um código de uso único, que troca
          por uma chave de acesso aleatória guardada apenas no seu navegador. Entrando com o Google, quem identifica a
          assinatura é o e-mail da conta, e a chave continua sendo trocada pelo servidor a cada entrada. No servidor
          ficam somente hashes (SHA-256) — nem o código nem a chave são armazenados em texto legível.
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
    </DocsShell>
  )
}
