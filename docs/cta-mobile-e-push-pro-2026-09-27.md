# CTA do Pro no celular, barra de status enxuta e push só para Pro

Data: 27/09/2026. Três pendências que estavam documentadas fecharam nesta
passada: o CTA do Pro abaixo da dobra no celular (QA de 24/09 §3-5), a barra de
status do cockpit quebrando em várias linhas no celular (deixado em aberto na
sessão de 26/09) e o `push_save` aceitando token gratuito (QA de 24/09 §6-1).

## 1. CTA fixo no celular (aba Pro)

**O defeito, medido na produção (390x844, 27/09):** o botão "Assinar Pro" ficava
em y=1378 num painel de 705px de altura — cerca de duas telas de rolagem interna
até o primeiro botão de ação, numa aba que existe para assinar. No desktop o CTA
já estava na primeira tela (y=793 de 814).

**A correção:** uma barra fixa (`sticky bottom-0`, `sm:hidden`) no pé do painel
de rolagem da aba Pro, com o CTA "Assinar Pro · R$ 9,90/mês". Ela só aparece
para quem ainda não tem Pro (`!temPro`) e somente com checkout ligado
(`CHECKOUT_URL`), e fica acima da barra de status do cockpit sem cobrir nada.

**Medido no build local e na produção (390x844):** barra visível sem rolagem
(top 733, 54px de altura, CTA de 44px), continua visível depois de rolar o
painel até o fim, e no desktop não existe (display none; o CTA normal segue na
primeira tela, y=793 de 814). Zero falhas de rede e zero erros de JS nas duas
medições.

## 2. Barra de status do cockpit no celular

**Antes:** 78px de altura e o texto inteiro em 3-4 linhas ("Dados: ESPN…",
JE4NVRG, Pro, Termos, Privacidade, Produtos JE4NDEV, aviso completo).

**Agora:** 49px, duas linhas curtas — meta ("HypeFC · atualiza a cada 1 min") e
links (Pro · Termos · Privacidade) + aviso curto ("Não é casa de aposta.").

O que sai **só no celular** (volta inteiro a partir de `sm`): a fonte do dado
(ESPN/Football-Data), o link JE4NVRG e a faixa "Produtos JE4NDEV"; o aviso
completo continua no desktop e nas páginas públicas. No celular a atribuição do
dado segue no cabeçalho do painel e nas páginas de documento; a barra do cockpit
é espaço de lista de jogos, que é o que rola na tela.

## 3. push_save passa a exigir Pro (servidor)

**O defeito (QA de 24/09 §6-1):** `push_save` aceitava qualquer token válido —
inclusive gratuito — e gravava a inscrição em `push_subs`. O remetente
(`scripts/send-alerts.ts`) filtra `plan=pro&status=active` com `paid_until` no
futuro, então a inscrição gratuita nunca recebia nada: a pessoa via "alertas
ativados" e o alerta nunca chegava.

**A correção:** a função recusa com `sem-pro` fora dessa mesma regra (fail
closed na gravação, não só na entrega). O cliente traduz o erro na aba Pro.

**Provado por REST com a chave anônima (igual ao site), no projeto HypeFC:**

| token | resposta |
| --- | --- |
| gratuito | `sem-pro` |
| Pro ativo | `ok:true` (inscrição gravada) |
| Pro com período vencido | `sem-pro` |
| inventado | `sem-acesso` |

Os assinantes de teste foram removidos no fim (0 linhas restantes).

## 4. Migrations sincronizadas com o banco

O repo de migrations estava atrás do banco em dois pontos; os dois viraram
migration idempotente (`create or replace`) para o repo reproduzir o projeto:

- `20260927010000_push_save_exige_pro.sql` — a função acima;
- `20260927011000_pro_conta_entrar_free.sql` — a correção de 26/09 que faz a
  conta sempre devolver licença (`free`/`conta` quando não há assinatura, com
  `limite` calculado por `_limite_do`), resolvendo o achado §5-1 do QA.

Ainda **fora** das migrations (divergência antiga, não tocada nesta passada):
`conta_registro` e o gatilho `registro_imutavel`, que existem no banco e são
referenciados pelo código, mas não têm migration no repo. Vale um backfill
quando alguém for mexer no registro.

## Como repetir as medições

Instrumento: Chrome de depuração + CDP, `Emulation.setDeviceMetricsOverride`
para 390x844 (mobile) e 1280x900 (desktop), leitura por DOM. As medições desta
passada viveram em `~/.hermes/cache/scratch/medir-cle-*.mjs` (máquina do Jean).

## Pendências que sobraram (arquivo/decisão, nenhuma bloqueia)

1. `alt` do escudo: **resolvido nesta passada** — o código usava o nome do
   time e agora usa `alt=""` (decorativo), com o contrato do
   `docs/identidade-002.md` atualizado para dizer isso.
2. `verde-2` (`#A9F0BB`, token dos números do modelo) entrou na tabela de
   vocabulário do `docs/identidade-002.md`.
3. Nenhum documento ativo ainda aponta Cloudflare Pages como caminho de deploy:
   o que sobrou são notas históricas no QA de 24/09 (que já registram o caminho
   real) e menções a "Pages" que significam GitHub Pages.
