# Gate medido da identidade 002 no artefato publicado

**Quando:** 24/09/2026, 02:07 a 02:20 (BRT, UTC-3)
**Alvo medido:** `https://hypefc.je4ndev.com/`
**Instrumento:** CDP (Chrome de depuração do Mac, aba dedicada), medição por DOM
(`getBoundingClientRect`, `getComputedStyle`, contraste com alfa composto sobre `paper` `#0B0E11`,
`PerformanceObserver` para CLS, `document.getAnimations`).
**Viewports:** 1440x900 (desktop) e 390x844 (mobile). **Abas:** Rodada, Liga, Recorde, Esportes, Pro.

Este doc substitui `docs/qa-ui-2026-09-23.md` como fonte do estado atual: aquele mediu o build de
23/09 09:02, anterior a identidade 002. Ele não aprovava a árvore nem o site de agora.

## 0. Qual artefato foi medido

| Item | Valor |
| --- | --- |
| Chunk da home servido | `/_next/static/chunks/app/page-844adb35114d843f.js` |
| sha256 do chunk servido | `f0bccf9b8aa68458cd2bd79bbdc18cde9efe4e319485dabec630b43ebafeae1c` |
| sha256 do mesmo chunk em `out/` (build local) | idêntico |
| `last-modified` da home | Thu, 24 Sep 2026 05:18:03 GMT |
| Service worker versionado | `hypefc-20260924T051734z` |
| Branch publicado | `gh-pages` `92e93b4` (`npm run deploy:domain`) |

O cruzamento de sha256 é o que autoriza dizer "medi o que está no ar": o arquivo publicado é
byte a byte o build local da árvore descrita abaixo.

## 1. Resultado por critério (`docs/identidade-002.md` §Gate)

| # | Critério | Medido | Status |
| --- | --- | --- | --- |
| 1 | Contraste WCAG AA, 0 reprovados nas 5 abas, em 1440 e 390 | 0 falhas nas 10 combinações (Rodada 0, Liga 0, Recorde 0, Esportes 0, Pro 0 em cada viewport) | PASSA |
| 2 | Estouro horizontal, 0 em 1440 e 390 | `documentElement.scrollWidth - innerWidth` = 0 nas 5 abas nos dois viewports | PASSA |
| 3 | CLS 0 | CLS = 0 na carga completa, desktop, mobile e sob reduced motion | PASSA |
| 4 | Animações ativas depois de ~7s = 0; com `prefers-reduced-motion` 0 e nada escondido | 0 animações rodando a 5s, 9s e 10s. Sob reduced motion: 6 transições `duration 0,01ms / iteration 1` reportadas como `running` no instante da leitura, sem loop infinito, com todos os números visíveis | PASSA (ressalva medida abaixo) |
| 5 | `sinal` em no máximo 3 elementos; `verde` só em dado do modelo | `sinal`: Rodada 0, Liga 0, Recorde 2, Esportes 0, Pro 1. `verde`: Liga 1 elemento (barra de probabilidade). Os números de probabilidade usam `verde-2` (`#A9F0BB`), 34 nós na Rodada, todos dentro dos cartões de jogo | PASSA |
| 6 | Elemento com fundo arredondado = 0; alvo abaixo de 44px no mobile = 0 | Arredondado com fundo: 0. Alvos `<44px` no mobile: **1** na primeira medição, **0** depois da correção da seção 2 | PASSA após correção |
| 7 | Escudo: todos carregados (`naturalWidth > 0`), todos com `alt` | Rodada: 72 imagens, 72 carregadas, 72 com `alt` | PASSA |

Complementos medidos na mesma passada, para o critério de shell do cockpit:

- A página **não rola**: `scrollY` permanece 0 com `scrollTo(0, 700)`, `docH == winH` (900 e 844).
  O conteúdo vive no scroll interno, como o contrato do cockpit exige.
- Sem erro de console e sem `unhandledrejection` na carga (observer instalado antes do primeiro paint).
- Rolagem das fileiras de chip: 2 fileiras com conteúdo escondido em 1440 (49px e 184px) e 3 em 390,
  todas com máscara de fade nas bordas (`linear-gradient`) quando existe conteúdo fora de vista.

## 2. Defeito encontrado e corrigido nesta passada

**Alvo de toque abaixo do piso no mobile (aba Pro).**

- Medido: "Entrar com Google" com 298x**36**px em 390x844. Era o único alvo abaixo de 44px em todas
  as abas e viewports.
- Causa: `src/components/dashboard/ContaPro.tsx` era o único arquivo com `min-h-[36px]` sem piso
  responsivo. Todos os outros controles do painel já usavam `min-h-[44px]` com queda para 36px a
  partir de `sm`.
- Correção: `min-h-[44px]` mais `sm:min-h-[36px]` nos dois botões do bloco de conta
  ("Entrar com Google" e "Sair da conta").
- Verificação: 44px medidos em 390x844 no build local servido em `127.0.0.1:8899` e, depois do
  deploy, no site publicado (`abaixo44: []`, 18 alvos na aba Pro). Em 1440 segue 36px, dentro do piso
  de 32px do `DESIGN.md`.
- Gates antes de publicar: `npm run lint` sem avisos, `npm test` com todas as suítes ok.

## 3. Itens abertos (não bloqueiam o gate, exigem decisão)

1. **`alt` do escudo diverge do contrato.** `docs/identidade-002.md` §Estrutura pede
   `alt` "Escudo do <time>"; o código usa o nome do time (`alt={team.team}` em
   `HypeFlags.tsx:83` e `LeagueStandings.tsx:217`). Como o nome do time é sempre texto ao lado,
   a opção mais limpa para leitor de tela é `alt=""` com o escudo marcado como decorativo, e o
   contrato passaria a dizer isso. Sem decisão, o critério 7 continua atendido (há `alt`), mas
   doc e código não batem.
2. **`verde-2` fora da tabela de vocabulário.** A tabela de `docs/identidade-002.md` documenta
   `verde` (`#7BE495`) e não menciona `verde-2` (`#A9F0BB`, `tailwind.config.ts:94`), que é o token
   dos **números** do modelo (barras continuam em `verde`). Papel distinto, então vale linha própria
   na tabela em vez de tratar como duplicata.
3. **Origem do deploy mudou.** O domínio `hypefc.je4ndev.com` hoje é CNAME de `je4nvrg.github.io`
   (servidor `GitHub.com`), servido pelo branch `gh-pages`. A memória de operação do projeto ainda
   fala em Cloudflare Pages: `docs/` e o runbook devem refletir o caminho real
   (`npm run deploy:domain`, sem Actions, por causa do bloqueio de runner da conta).
4. **Três commits que já estavam no ar não estavam em `origin/main`**: a pele grafite Mesa
   (`801eb52`) e os ajustes de copy/print que a acompanham. Foram publicados no `gh-pages` mas não
   no `main`; este commit fecha essa distância para o clone da VPS (`git pull`) não ficar atrás do
   que o site mostra.
5. **O CTA do Pro fica abaixo da dobra interna no mobile.** Medido em 390x844, aba Pro: o painel
   tem 2351px de conteúdo numa janela de 493px; "Entrar com Google" começa a 1437px e
   "Assinar Pro" a 1508px do topo do painel, ou seja, cerca de duas alturas de janela de rolagem
   interna até o primeiro botão de ação. Em 1440x1000 os dois aparecem na primeira tela (792px e
   855px). Numa aba cujo objetivo é a assinatura, isso é defeito de conversão, não de estética.
   Opções: CTA fixo no pé do painel quando não há acesso, ou mover o bloco de preço para o topo.
   Não foi alterado nesta passada porque a escolha é de produto.

## 4. Área de conta na aba Pro (correção de padrão de tela)

A área de acesso tinha quatro caminhos e duas identidades no mesmo bloco, sem hierarquia:

| Antes | Depois |
| --- | --- |
| Cartão "Acesso ativo · nome" (perfil do navegador) com um botão "Sair" | Removido; os dados dele entram como uma linha dentro do cartão de conta |
| Cartão de login com parágrafo antes do botão | Cartão "Conta" com rótulo, frase de uma linha, botão e uma linha de apoio |
| "Entrar com Google" e "Assinar Pro" com o mesmo peso visual, colados | "Assinar Pro" primeiro, único elemento em `sinal` (ácido); "Entrar com Google" neutro |
| "Ativar acesso" (e-mail mais código) aberto no meio do fluxo | Fechado em `<details>` "Já comprei: tenho um código" |
| Dois botões "Sair" quando havia conta Google e perfil do navegador | Um só, que encerra a conta e limpa o acesso do navegador |
| Selo de estado "Sem acesso neste navegador" para quem não tem token | "Acesso gratuito" |

Medido no build local (1440x1000 e 390x844, aba Pro), depois do ajuste:

- Ordem dos controles: `Assinar Pro` (fundo `sinal`, 44px nos dois viewports), `Entrar com Google`
  (neutro, 44px no mobile e 36px no desktop), `<details>` fechado com resumo de 44px, `Entrar na lista`.
- Botões "Sair" visíveis sem conta: 0 (antes o perfil do navegador já desenhava um).
- `<details>` fechado por padrão, então o formulário de código não compete com os CTAs.

## 5. Como repetir esta medição

O instrumento é o mesmo da passada anterior (`docs/qa-ui-2026-09-23.md` §1) e não mudou: abrir a URL
numa aba dedicada, `Emulation.setDeviceMetricsOverride` para cada viewport, e ler o DOM. Para este
doc foram usados quatro blocos de leitura, todos por DOM e sem inspeção visual:

1. histograma de contraste com alfa composto sobre `paper`;
2. contagem de `sinal`/`verde`/`verde-2` por `getComputedStyle`;
3. alvos de toque (`button, a, [role=tab], input, select`) com `getBoundingClientRect`;
4. CLS por `PerformanceObserver`, animações por `document.getAnimations`, e o teste de rolagem
   real (`scrollTo` mais releitura do `getBoundingClientRect` do shell).

Repetir depois de qualquer mudança visual: o número publicado aqui vale para o sha256 da seção 0.
