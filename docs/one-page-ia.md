# Home como uma página — informação e interação

Escopo: a home publicada (`src/app/page.tsx`, estático em https://je4nvrg.github.io/HypeFc/) passa a ser uma página única onde varrer a rodada é barato e aprofundar um confronto custa um clique. Medições feitas na home publicada em 23/09/2026, viewport 390×844; dados da ESPN pública (`site.api.espn.com`), com `access-control-allow-origin: *` verificado no browser na origem `je4nvrg.github.io`.

## 0. O que existe hoje (para não decidir no vácuo)

- Página de **7.721px ≈ 9,1 telas** de rolagem a 390×844.
- Ordem por y: header 18 · banner "Sem jogos hoje" · Resumo do dia (36 jogos / 99 gols / 2,8 média / 36 encerrados / 9 ligas) · **Jogos de Hoje 387** · Times em Alta 3.106 · Classificação 4.290 · Artilheiros 5.235 · Rendimento por mando 5.449 · Recorde público 6.411.
- A rodada inteira já cabe em uma tela; tudo depois dela está a 3–8 telas e é **por liga**, não por rodada.
- O board de hype é **por time, não por jogo**: dos 12 cards publicados, Porto 86 / Benfica 80 são o mesmo jogo (16:30) e Atlético 73 / Real Madrid 63 são o mesmo jogo (11:15) — dois lados do mesmo confronto; outros 4 (Barcelona, Dortmund, Monaco, Roma) não jogam hoje.
- Cada linha de jogo já carrega `match_stats` (posse/chutes/no alvo) e é uma `<div>` **sem clique e sem identidade estável** (key = `league_id-home-away-index`).

## 1. Ordem das seções na página

| # | seção | onde fica | por quê (uma linha) |
|---|---|---|---|
| 1 | Header + banner de rodada alternativa | dobra, sticky | data, estado ao vivo e refresh precisam estar sempre visíveis; o banner é a honestidade de estar mostrando 20/09 e não 23/09 |
| 2 | Resumo do dia (StatsBar) | dobra, ~64px | 36/99/2,8 é o contexto da lista que vem logo abaixo e já custa uma linha |
| 3 | **Jogos de Hoje** | dobra, ocupa o resto | é a única coisa que se varre: os 36 jogos cabem em uma tela já hoje, e a linha passa a ser o alvo de clique |
| 4 | Times em Alta | dobra, faixa de chips ~88px | 12 cards custam 1.180px e duplicam jogos da lista (Porto/Benfica, Atlético/Real); chip = escudo + score + "vs adversário · 16:30" |
| 5 | Liga: Classificação + Rendimento por mando + Artilheiros | abaixo, 1 seção com abas e 1 seletor | os três keyam no mesmo `leagueId` e hoje ocupam 4.290→6.411 = 2.121px com três áreas separadas |
| 6 | Recorde público | abaixo, colapsado nos 4 números | muda por rodada, não por scroll, e é o que dá crédito ao score; as medições já vivem dentro de `<details>` |

Regra: a 390px, nada além de Jogos de Hoje ocupa a primeira tela. Ordem = rodada → por que ela importa → contexto de liga → histórico medido.

## 2. Antes do clique (card) e depois (painel)

**No card, tudo custo zero** (já vem no payload da rodada) — senão a varredura vira 36 requisições:

- liga e horário, ou estado com minuto (`status.displayClock`, ex. "90'+5'", presente no scoreboard)
- escudos, nomes e posição na tabela (`#17 Grêmio × #2 Palmeiras`)
- placar quando houve jogo; senão horário
- a linha de três stats que já existe (posse · chutes · no alvo) quando `match_stats` existe
- selo do score no confronto: "1 em alta" ou "clássico · 2 em alta" (derivado do board; hoje esse sinal só aparece no card lateral, longe do jogo)

**No painel** (uma chamada `site.api.espn.com/apis/site/v2/sports/soccer/<slug>/summary?event=<id>`, ~410KB):

- estádio, cidade e árbitro; público **só quando ≠ 0**
- stats de time completas: cartões (amarelo/vermelho), defesas, escanteios, faltas, passes, desarmes (28 nomes de stat no `boxscore`)
- gols e lances com minuto e autor (`keyEvents`; tipos vistos: Goal, Own Goal, Yellow Card, Substitution)
- escalações titulares/banco quando publicadas (`rosters`: 23 por lado)
- últimos 5 de cada lado (`lastFiveGames`)
- confrontos: `seasonseries` do summary (5 jogos da temporada) ou a série reconstruída da temporada como em `src/lib/matchH2H.ts` — o campo `headToHeadGames` do summary voltou **0** nos três jogos do Brasileirão testados, então não usar como fonte
- odds quando houver (`hasOdds`; no scoreboard vieram `[null]`, no summary veio casa de aposta)

## 3. Como o clique funciona

- **Painel, não página cheia nem accordion.** Página cheia recarrega tudo e joga fora a rodada atrás; accordion inline reflui as linhas seguintes e derruba a posição de leitura — e os blocos do item 4 não cabem dentro de uma linha de 2 linhas de altura.
- **390px:** folha de tela cheia (`100dvh` − 12px) com sub-cabeçalho fixo de 56px, handle de arrasto e scroll próprio; o corpo da home fica travado. **≥1024px:** lateral de 420px com a lista parada no lugar (a pessoa acabou de clicar uma linha específica; reflow perde o lugar).
- **URL:** `?jogo=<eventId>&dia=YYYY-MM-DD` na mesma página, ex. `https://je4nvrg.github.io/HypeFc/?jogo=401841246&dia=2026-09-20`. **Não** usar `/match/<eventId>`: o deploy é `output: export` com `trailingSlash: true` e basePath `/HypeFc`, não existe HTML por jogo para gerar no build, e a rota nova cairia no 404 do Pages. Query param sobrevive a refresh e a link compartilhado.
- `dia` é obrigatório porque a home cai na última rodada quando não há jogos hoje (medido: 36 jogos de 20/09/2026 com "Hoje: 23/09/2026" no banner) — sem a data, o link morre no dia seguinte.
- **Voltar:** abrir = `pushState` (1 entrada); fechar no X/Esc/arrasto = `history.back()`. Trocar de jogo por dentro do painel (clicar num jogo dos "últimos 5") = `replaceState`, para "1 clique = 1 voltar" continuar valendo.
- **Carga com `?jogo=`:** abre depois de a rodada resolver; se o id não estiver no dia carregado, busca o `dia` do link; se ainda não achar, mantém a home e mostra aviso ("esse jogo não está na rodada exibida") — nunca painel vazio.
- **Dois cards marcados pelo score:** é caso real e publicado (Porto/Benfica 86/80, Atlético/Real 73/63). O confronto tem **um** alvo de clique, o selo lê "clássico · 2 em alta" e o painel mostra os dois lados com placar e sinais numa chamada só. O segundo chip aponta para o mesmo confronto e abre o mesmo painel — nunca dois painéis.
- **Card marcado que não joga hoje** (4 dos 12 atuais) não abre painel: leva para a aba da liga. Hoje esse time aparece com `opponent: null` e nenhum caminho.

## 4. Hierarquia dentro do painel (390×844, cabe em 1 tela)

| ordem | bloco | px | regra |
|---|---|---|---|
| 1 | Cabeçalho do jogo, sticky: escudos, nomes, placar/minuto, selo de score por lado, fechar | 96 | fixo acima de tudo |
| 2 | Fatos: estádio · cidade · árbitro · público (se ≠ 0) · data/hora | 44 | uma linha, sem rótulo extra |
| 3 | Stats em barras duplas: posse, chutes, no alvo, escanteios, faltas, cartões, defesas | 154 | 7 linhas × 22, sem tabela |
| 4 | Gols e lances: minuto + autor + tipo, 8 linhas + "ver todos" | 224 | `keyEvents` filtrado; sem narração |
| — | **subtotal da primeira tela** | **518 de 788 úteis** | cabe sem rolagem infinita |
| 5 | Abas internas: Escalações · Últimos 5 · Confrontos · Odds | 32 + 1 aba montada | só uma montada: escalação são 23 nomes por lado |
| 6 | Escalações por lado | 22 × 26 | titulares primeiro, banco colapsado; esconde se não publicado |
| 7 | Últimos 5 por lado | 10 × 24 | compacto, gols do lado marcado em negrito |
| 8 | Confrontos (`seasonseries`) | 5 × 24 | série da temporada, mando alternado |
| 9 | Odds | 1 linha | só com `hasOdds`; é fato, não sugestão |

Ordem = o que está acontecendo agora → como está o jogo → o que aconteceu → quem está em campo → como vem vindo. Odds por último.

## 5. O que NÃO entra

1. **Odds como bloco e qualquer verbo de recomendação** ("value", palpite, acumulada). A única medida publicada é acerto retroativo com `n` e a âncora do melhor colocado, e a nota do recorde diz explicitamente que o score "não é palpite nem sinal de aposta". Odd em destaque ao lado de um card medido converte o painel em tipster; se entrar, é uma linha de cotação de mercado, sem destaque e sem combinação.
2. **Probabilidade própria ("chance de vitória", confiança, zebra %).** O produto não tem modelo — `predictor` voltou vazio nos jogos testados. Um índice derivado do hype score seria um número sem medição convivendo com uma medição publicada: exatamente a contradição que o recorde existe para evitar.
3. **Bloco sem dado confirmado.** Escalação placeholder, xG/mapa de calor, `commentary` (147 entradas em inglês do feed da ESPN). E público: voltou `0` nos três jogos do Brasileirão testados, então "público 0" é dado falso, não dado ausente. O produto já segue essa regra — split casa/fora só aparece se `splitsReconcile` passar, bucket com menos de 30 cards sai sem taxa. No painel, bloco sem fonte confirmada não entra e o espaço fica com estado vazio explícito ("escalações ainda não divulgadas").

## 6. Contrato de dados (o que falta para isso existir)

- **`event_id` não chega ao cliente:** `parseEspnMatches` monta o `EspnMatch` sem `event.id` (o payload traz, ex. `401841246`) e `TodayMatches` usa `${league_id}-${home}-${away}-${index}` como key. Sem esse campo não existe deep link nem `summary?event=`.
- **`dia` já existe** no payload da rodada (`todayData.date`) e em `EspnMatch.date`, mas não sobrevive até `Match` em `useDashboardData`.
- Uma chamada de `summary` por jogo aberto. TTL curto — 60s ao vivo, 5 min encerrado — alinhado ao polling atual (60s com jogo ao vivo, 300s sem).
- Sem backend e sem chave: ESPN com CORS aberto já permite o painel no site estático.
