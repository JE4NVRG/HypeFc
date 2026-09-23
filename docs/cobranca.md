# Como o HypeFC cobra (runbook)

Estado: **tudo pronto menos a sua conta de pagamento.** O funil inteiro existe e
foi exercitado; o único passo que ninguém faz por você é escolher o provedor e
colar o link. Este documento é a ordem exata dos passos.

## O que já está construído

| Peça | Onde | Estado |
| --- | --- | --- |
| Oferta dentro do produto (grátis vs Pro, preço, prova, lista de espera) | `src/components/dashboard/ProView.tsx` (aba **Pro**) | pronto |
| Loja (assinantes, times seguidos, inscrições de push, pedidos, log de envio) | Supabase, projeto **HypeFC** (região sa-east-1), migração `supabase/migrations/20260923090000_hypefc_pro.sql` | pronto |
| Acesso pago sem senha (código de uso único → chave no navegador) | RPCs `pro_setup` / `pro_me` / `follow_*` / `push_*` | pronto |
| Entrega do alerta (push no navegador, 1 por jogo, com idempotência) | `scripts/send-alerts.ts` + cron diário 09:00 | pronto |
| Venda: abrir pedido | `npm run venda:abrir -- --email cliente@x.com` | pronto |
| Venda: fechar (gera o código + link de ativação) | `npm run venda:paga -- --order <id>` | pronto |
| Termos de uso e privacidade (LGPD) — provedor costuma exigir | `/termos` e `/privacidade` | pronto |
| **Conta no provedor de pagamento + `HYPEFC_CHECKOUT_URL`** | — | **falta você** |

## Passo 1 — escolher onde o dinheiro entra

Qualquer um serve; a diferença é taxa e burocracia:

- **Mercado Pago — Link de Pagamento**: funciona com CPF (não exige CNPJ), taxa
  por transação, aceita Pix e cartão, dá link pronto. É o caminho mais rápido
  para começar hoje.
- **InfinitePay (maquininha/link)**: Pix e cartão com taxa baixa, também com CPF.
- **Stripe**: melhor painel e assinatura recorrente de verdade; aceita CPF no
  Brasil, mas a análise costuma ser mais exigente.

Crie o **link de pagamento** do plano Pro (R$ 9,90/mês e R$ 79/ano) e copie a URL.
Não precisa de site nem de loja integrada: o link do provedor já é a tela de
cobrança.

## Passo 2 — ligar o link no produto

No `.env.local` da raiz do repositório (arquivo local, fora do git):

```
NEXT_PUBLIC_CHECKOUT_URL=https://link-do-seu-provedor
```

O prefixo `NEXT_PUBLIC_` não é enfeite: só variáveis com esse prefixo o Next
injeta no bundle do navegador. Com outro nome, o valor existiria no build e o
botão continuaria dizendo "entrar na lista" — falha silenciosa.

Depois `npm run deploy:domain`. Com essa variável presente, o botão principal da
aba Pro passa a ser **Assinar Pro** apontando para o seu link; sem ela, o botão
vira **entrar na lista** (que é o que está no ar agora). Nada mais muda.

## Passo 3 — vender

```
# 1. abre o pedido e devolve o link com a referência do pedido
npm run venda:abrir -- --email cliente@exemplo.com --meses 1 --valor 990

# 2. confira o valor na tela do provedor e receba o pagamento

# 3. fecha a venda: marca como pago, libera o Pro e gera o código
npm run venda:paga -- --order <id do pedido devolvido acima>
```

O passo 3 imprime **uma vez** o código (`HFC-XXXX-XXXX-XXXX`) e um link pronto do
tipo `https://hypefc.je4ndev.com/?ativar=1&email=...&codigo=...`. Mande esse link
para o cliente: ele clica, o acesso é ativado em um clique e a chave fica no
navegador dele. Perdeu o código? `npm run venda:paga -- --order <id> --forcar`
gera outro (não cobra de novo).

O banco guarda só o hash do código e da chave: nem você consegue lê-los depois.
É de propósito — e é o que a política de privacidade promete ao cliente.

## Passo 4 — alertas

O cron diário das 09:00 (`npm run record`) já inclui o passo de alerta: ele lê os
assinantes com Pro ativo, vê quem joga naquele dia e envia **um** push por jogo,
registrando cada envio para nunca repetir. Sem jogo no dia, não envia nada e não
é erro.

Quem entrega o push é o próprio navegador do assinante (Web Push com chave VAPID
gerada localmente). Não há conta em serviço de notificação nem servidor nosso no
meio.

## Dar acesso de cortesia (validação, imprensa, primeiros clientes)

```
npm run venda:abrir -- --email pessoa@x.com --valor 0
npm run venda:paga -- --order <id>
```

Registra um pedido pago de valor zero (auditável) e libera o Pro pelo mesmo
caminho do cliente pagante.

## Cancelar e reembolsar

- Reembolso em até 7 dias: estorne no provedor e pare os alertas com o comando do
  próximo item.
- Encerrar acesso: `UPDATE` no assinante para `status='canceled'` (o token dele
  para de valer para novos follows e ele sai da lista de alertas). Se quiser
  apagar de vez, apague a linha em `subscribers` — as tabelas filhas caem junto
  (`ON DELETE CASCADE`).

## Próximo degrau (quando houver volume)

Hoje o passo 3 é manual de propósito: com poucas vendas, conferir o pagamento com
os próprios olhos é mais confiável do que confiar num webhook. Quando o volume
justificar, o caminho é uma **Edge Function** no Supabase recebendo o webhook do
provedor e chamando o mesmo `mark-paid` — o resto da cadeia não muda.

## O que NÃO fazer

- Não colocar login/senha no painel: o painel é público e não precisa de conta; a
  assinatura usa código de uso único.
- Não vender o score como palpite nem prometer acerto. O registro publicado mostra
  que o modelo é calibrado e **não** tem edge no palpite (favorito do modelo acerta
  a mesma taxa da referência mais simples). O que se vende é alerta e registro, não
  adivinhação — está escrito assim na oferta, nos termos e na política.
- Não usar GitHub Actions para nada: a conta está bloqueada e todo workflow falha e
  gera e-mail de erro. Deploy é `npm run deploy:domain`.
