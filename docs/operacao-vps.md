# HypeFC na VPS (luna-vps) — operação

O HypeFC é um site estático + Supabase, então **nada nele precisa de servidor
próprio para servir o painel**. O que vive na VPS é o que antes dependia do Mac
ligado: os dois jobs que falam com dinheiro e com cliente.

Repositório: `/home/jean/hypefc-jobs/HypeFc` (clone do GitHub; o origin é SSH e a
chave já existente na VPS autentica como **JE4NVRG**).
Node: `/home/jean/.nvm/versions/node/v22.23.2/bin` (o v20 do sistema **não** roda
`--experimental-strip-types`, que os scripts usam).
Segredos: `/home/jean/hypefc-jobs/HypeFc/.env.local` (modo 600). Ele alimenta as
units via `EnvironmentFile=` e o script diário via `set -a; . ./.env.local`.

| Job | Unit | Quando | O que faz |
| --- | --- | --- | --- |
| Sincronizar venda | `hypefc-venda-sync.service` (oneshot) + `.timer` | a cada 10 min | Lê a Stripe (chave restrita `rk_live_…`, só leitura) e grava as compras pagas em `orders` via RPC `pro_order_stripe`, para o site liberar o Pro no resgate |
| Job diário | `hypefc-recorde-diario.service` (oneshot) + `.timer` | 09:00 America/Sao_Paulo | `scripts/record-diario.sh`: snapshot do dia → liquidação → ratings → chance de título → snapshot/liquidação das probabilidades → **alertas Pro** → **publica os payloads no Supabase** → commit dos dados como histórico. Sem build e sem deploy: o painel lê o número do banco |

## Comandos do dia a dia

```bash
# ver os timers e quando disparam
systemctl --user list-timers --all | grep hypefc

# rodar agora (sem esperar o relógio) e ver o resultado
systemctl --user start hypefc-recorde-diario.service
journalctl --user -u hypefc-recorde-diario.service -n 60 --no-pager

# log do sync de venda
journalctl --user -u hypefc-venda-sync.service -n 30 --no-pager

# ver se a última execução deu certo
systemctl --user show hypefc-venda-sync.service -p ExecMainStatus
```

Instalar/atualizar as units (depois de `git pull` no clone da VPS):

```bash
cp ~/hypefc-jobs/HypeFc/deploy/vps/hypefc-*.service ~/hypefc-jobs/HypeFc/deploy/vps/hypefc-*.timer ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now hypefc-venda-sync.timer hypefc-recorde-diario.timer
```

## Aviso de falha (grupo Telegram)

Se qualquer um dos dois jobs falhar, o systemd dispara
`hypefc-aviso-falha@<unit>.service` (via `OnFailure=` nas duas units), que roda
`~/.local/bin/hypefc-vps-alert` e posta no **grupo** `Je4nDevVega Mac GRUPO`.

- Destinatário: `~/.config/hypefc/alerta.env` (modo 600) com `TELEGRAM_BOT_TOKEN`
  e `TELEGRAM_CHAT_ID`. O bot precisa **ser membro do grupo** — hoje é o
  `@VegaCoreJe4n_bot`, que já está lá. (O bot do Hermes da VPS não está no grupo:
  `getChat` responde `chat not found`.)
- O script **recusa destino que não seja grupo** (id precisa começar com `-100`):
  alerta operacional em DM é ruído, e o Jean não quer isso.
- Cooldown de 1 h por unit: o timer de venda roda a cada 10 min, sem cooldown uma
  falha repetida viraria enxurrada.
- Entrega verificada: depois do `sendMessage` o script faz um `editMessageText`
  com o mesmo texto e exige "message is not modified" — prova que o texto
  persistiu naquela mensagem. Sem isso o aviso não é dado como entregue.

Testar a cadeia inteira (unit de mentira que falha de propósito):

```bash
printf '[Unit]\nDescription=teste\nOnFailure=hypefc-aviso-falha@%%n.service\n\n[Service]\nType=oneshot\nExecStart=/bin/false\n' > ~/.config/systemd/user/hypefc-teste-falha.service
systemctl --user daemon-reload && systemctl --user start hypefc-teste-falha.service
journalctl --user -u hypefc-aviso-falha@hypefc-teste-falha.service -n 20 --no-pager   # deve imprimir aviso_enviado
rm ~/.config/systemd/user/hypefc-teste-falha.service && systemctl --user daemon-reload
```

## Credenciais: como cada job se autentica

- **Stripe**: chave restrita (`rk_live_…`, Checkout Sessions + Subscriptions em
  leitura) na variável `STRIPE_API_KEY` do `.env.local`. O CLI nesta versão
  (1.51.1) não aceita colar chave sem TTY (`login --api-key`/`--interactive` caem
  no fluxo de dispositivo), então a env tem precedência sobre a sessão do CLI. Por
  isso o `stripe switch … --live` que o script ainda executa falha em silêncio aqui
  — comportamento esperado, não erro.
- **Supabase**: `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` (service_role). Nunca
  imprimir; os scripts leem de `process.env`, e é o `set -a` do script diário que
  garante o export.
- **Push (alertas)**: `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`,
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY`. Sem eles o passo `alertas` falha — e falhar é o
  certo, porque alerta é promessa de cliente pagante.

## O Mac hoje

Ambiente de **desenvolvimento**. Nenhum job de produção depende dele: os dois
crons do Hermes que rodavam aqui (`HypeFC venda sync` `07ce6b93a1d0` e `HypeFC
recorde diario` `0bda2c852fce`) foram pausados depois que a VPS rodou de verdade.

Os dois jobs são idempotentes do lado do banco (a RPC ignora sessão já gravada e o
snapshot do dia é por data), então reativar um cron no Mac não duplica cobrança
nem inventa resultado — mas dois publicadores ao mesmo tempo disputariam o
`gh-pages`, então mantenha só um lado ativo.

## Como o número chega na tela (sem rebuild)

Os cinco payloads do painel (`hype-record`, `ratings`, `title-odds`,
`probability-record`, `probability-forward`) são publicados pelo job na tabela
`public.site_payloads` e lidos pelo site em runtime pela RPC `payload_publico`
(chave anon). Se o Supabase não responder, o `src/lib/payloadSource.ts` cai para
o arquivo `public/data/<nome>.json` que vai dentro do build — a página nunca fica
vazia, mostra o último dado publicado junto com o código.

Consequência prática: **dado novo não precisa de build nem de deploy**. Publicar
build é coisa de código novo.

## Deploy: o build inlina as NEXT_PUBLIC_*

`npm run deploy:domain` carrega o `.env.local` sozinho e **aborta** se faltar
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`NEXT_PUBLIC_CHECKOUT_URL` ou `NEXT_PUBLIC_VAPID_PUBLIC_KEY`. Sem elas o build sai
sem Supabase (Pro, login e lista de espera em modo degradado), sem botão de
assinatura e sem push — e isso não dá erro: o site sobe quebrado em silêncio. Já
aconteceu num deploy feito da VPS, com o `.env.local` da VPS incompleto.

Por isso o `.env.local` da VPS precisa ter as quatro (e ter as mesmas do Mac):
o job diário antigo deployava, e qualquer deploy da VPS passa por este guard.

## O job sincroniza o repo antes de commitar

O repo também recebe commits do Mac (código, documentação, design). Por isso
`record-diario.sh` faz `git pull --rebase --autostash origin main` **antes** de
gerar os dados e de commitar. Sem esse passo, qualquer commit feito em outra
máquina faz o `git push` do fim do job ser rejeitado por non-fast-forward, o
systemd marca a unit como `failed` e o grupo recebe um alerta de falha que nunca
aconteceu — foi exatamente o que a correção passou a evitar. Se houver alteração
local pendente nos dados, o job commita antes de sincronizar, em vez de abortar o
dia por causa de um arquivo de dado.

