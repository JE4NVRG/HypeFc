<div align="center">

# HypeFC

### Dashboard de futebol em tempo real

Acompanhe jogos, classificacoes, artilheiros e identifique os **times em alta** nas principais ligas do mundo - tudo em tempo real, direto da API.

[![Next.js](https://img.shields.io/badge/Next.js_14-000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![shadcn/ui](https://img.shields.io/badge/shadcn%2Fui-000?logo=shadcnui&logoColor=white)](https://ui.shadcn.com/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-000?logo=vercel&logoColor=white)](https://vercel.com/)
[![Demo](https://img.shields.io/badge/Demo-online-2ea44f?logo=githubpages&logoColor=white)](https://je4nvrg.github.io/HypeFc/)
[![Sem chave](https://img.shields.io/badge/API%20key-nenhuma%20necessaria-orange)](https://je4nvrg.github.io/HypeFc/)

<br />

<img src="public/preview.png" alt="HypeFC Dashboard Preview" width="100%" style="border-radius: 12px;" />

</div>

---

## Sobre o projeto

O HypeFC nasceu da necessidade de ter uma visao rapida e inteligente do cenario do futebol mundial. O dashboard consome dados publicos de futebol em tempo real e aplica um algoritmo proprio de **deteccao de hype** que cruza classificacoes, jogos do dia e posicoes para destacar automaticamente os times mais relevantes.

### Roda sem nenhuma chave de API

Por padrao o dashboard usa a **ESPN publica**, sem cadastro e sem chave: jogos do dia, placar, classificacao, artilheiros, posse de bola, chutes e chutes no gol. Escudo, tabela e estatistica de partida funcionam com `git clone && npm install && npm run dev`.

Se voce tiver um token da [Football-Data.org](https://www.football-data.org/), coloque em `FOOTBALL_API_TOKEN` (veja `.env.example`): jogos, tabela e artilheiros passam a vir de la, e a ESPN continua entrando como fonte das estatisticas de partida. Sem token, o modo ESPN assume e o rodape mostra a fonte em uso.

### Sem jogos hoje?

Dia sem rodada nao deixa o painel vazio: o dashboard cai automaticamente para a ultima data com jogos (ate 4 dias atras) e avisa na tela qual rodada esta sendo exibida.

### O que torna diferente

- **Zero banco de dados** - Arquitetura serverless pura, dados sempre frescos direto da API
- **Zero chave obrigatoria** - ESPN publica cobre jogos, tabela, artilheiros e estatisticas de partida
- **Hype inteligente** - Score 0-100 com forma, tabela, saldo, clássico e jogo ao vivo. "Joga hoje" sozinho não entra.
- **Cache otimizado** - In-memory cache com TTL para respeitar rate limits sem sacrificar velocidade
- **Full responsive** - Interface adaptativa de 1 a 4 colunas (mobile, tablet, desktop, ultrawide)

---

## Features

### Resumo do Dia
Barra de estatisticas com metricas em tempo real: total de jogos, gols marcados, media por partida, jogos ao vivo e ligas ativas.

### Jogos de Hoje
Todas as partidas do dia agrupadas por liga, com escudos dos times, posicoes na tabela e **placar ao vivo**. Jogos em andamento recebem destaque visual com indicador LIVE.

Cada linha e clicavel e carrega o selo do score no proprio confronto (`71 em alta`), alem da linha de posse/chutes/no alvo. Uma linha so vira botao quando existe id de evento da ESPN para abrir: nao prometemos clique que nao funciona.

### Detalhe do confronto (um clique, uma chamada)

O painel abre por cima da rodada (lateral de 420px no desktop, tela cheia a 390px) e busca o resumo da partida na ESPN **sob demanda** — sao ~400KB por jogo, entao nada disso entra no carregamento da home. Traz:

- placar, minuto e estado; estadio, cidade, arbitro e publico
- comparativo em barras: posse, chutes, no alvo, escanteios, faltas, cartoes, defesas, impedimentos
- gols e lances com minuto e autor
- escalacoes titulares/banco quando publicadas
- ultimos 5 de cada lado e os confrontos diretos
- **proximos jogos** dos dois times
- mercado (odds) em uma linha, so quando a casa publica — sem destaque e sem verbo de recomendacao

Se um bloco nao tem fonte confirmada, ele nao aparece com dado inventado: mostra estado vazio explicito. Publico `0` do Brasileirao vira `—` (a ESPN nao publica o numero e `0` seria dado falso).

### Link compartilhavel do confronto

`?jogo=<eventId>&dia=YYYY-MM-DD` — abre a rodada daquele dia e o painel do jogo. A URL entra no historico, entao o **botao voltar do navegador fecha o painel** e devolve a rodada. O `dia` e obrigatorio no link: sem ele, um link compartilhado morreria no dia seguinte.

### Uma pagina, com o detalhe no clique

A rodada domina a primeira tela; classificacao, rendimento por mando e artilheiros dividem **uma secao com abas e um unico seletor de liga** (antes eram tres areas empilhadas somando ~2.100px de rolagem). So a aba ativa fica montada.

### Probabilidade de vitória (com o limite junto, sempre)

O painel mostra a probabilidade do modelo **Elo + Poisson** e, ao lado, o que ela vale:

| | |
|---|---|
| Amostra medida | **1.203 jogos previstos** (1.923 encerrados, 8 ligas, temporada 2026) |
| Brier do modelo | **0,629** |
| Chute uniforme (1/3-1/3-1/3) | 0,667 |
| Base do mando (44/26/30) | 0,649 |
| Calibração | desvio médio de **3,0pp** entre previsto e observado |
| Acerto do favorito do modelo | **46,5%** |
| Âncora "melhor colocado da tabela vence" | **46,5%** |

A leitura honesta, que aparece na própria interface: **probabilidade melhor, palpite igual.** O modelo entrega número calibrado — dá para confiar no "62%" como frequência — mas o favorito dele acerta exatamente o mesmo que olhar a classificação, sem Elo nenhum. Não é edge, e o produto diz isso em vez de vender o número.

O rating não vem do navegador: o site é estático, então `scripts/build-ratings.ts` reconstrói a temporada no build e publica `public/data/ratings.json` (8 ligas, 152 times, 652 jogos de base). Jogo sem rating para os dois times **não mostra probabilidade** — em vez de chutar.

Tudo isso é versionado em `public/data/probability-record.json`, gerado pelo backtest (`npm run backtest:prob`), com o método, as referências e os avisos.

#### Registro em produção (a parte que ninguém faz)

Backtest mede o modelo no passado — prova que a ideia funciona, não que o número mostrado na tela acertou. Então o produto também **pré-registra**:

- `npm run snapshot:prob` grava a probabilidade de cada jogo **antes do apito**, com data de emissão e os ratings usados (reconstruídos só com jogos anteriores — o jogo de hoje nunca entra na própria conta);
- `npm run settle:prob` liquida o que terminou e republica `public/data/probability-forward.json`;
- os dois rodam no cron diário junto do recorde do score.

O `mode` separa o que é o quê: `live` (gravado antes do jogo) entra na métrica em produção; `replay` (data passada, para histórico e para exercitar a liquidação) entra na contagem e **fica fora** da métrica. Somar os dois inflaria a amostra de um com a do outro — o número em produção começa em zero e cresce só com jogo de verdade. A interface diz isso: *"sem número até o primeiro jogo terminar"*.

### Chave de aposta → probabilidade de mercado

`src/lib/marketOdds.ts` converte a odd publicada em probabilidade implícita, **remove a margem da casa** (normaliza para somar 1) e devolve a margem como número visível. A ESPN publica linha de verdade no resumo do jogo (DraftKings, `moneyLine`, over/under), mas **não publica no scoreboard** e não tem modelo próprio: verificado, `predictor` responde `HTTP 400 "Predictor is not supported for sport: soccer, league: bra.1"` — igual para NBA. Então probabilidade de mercado aparece onde existe, rotulada com a fonte, sem verbo de recomendação.

### Outros esportes (mesma fonte, sem chave nova)

A aba **Esportes** traz 8 esportes e 17 ligas: futebol (10 ligas), **NBA, NFL, NHL, MLB, Fórmula 1, UFC e ATP**. Todos no mesmo endpoint gratuito da ESPN, com parser próprio por formato — a ordem é sempre *visitante @ mandante* e o placar sai na mesma ordem do nome, para não enganar.

O que muda de esporte para esporte é tratado explicitamente: o beisebol traz *innings*, o hóquei traz registro com prorrogação (`1-0-1`), F1/MMA/tênis **não têm times** (aparecem por evento e sessão, sem placar inventado), e regra do futebol — como a tabela de classificação — **não** é aplicada a esporte que não tem. Estado vazio é explícito ("sem jogos publicados agora"), nunca cache de dado velho.


### Instalável e offline (PWA)

Manifest + service worker: da para instalar na tela inicial e abrir sem rede com a ultima rodada carregada. O cache **nao intercepta a ESPN** — dado de terceiro nunca e servido do cache, senao o painel mostraria placar velho; os JSON de dados sao network-first com fallback.

### Procedencia

O painel declara a fonte, o ritmo de leitura, o que a fonte **nao** da (xG, publico no Brasileirao, odds quando nao publicadas) e onde o produto prefere nao mostrar a mostrar errado. Quem publica um recorde medido precisa mostrar de onde vem o numero.

### Times em Alta (Hype Detection)
Score de 0 a 100, não uma lista de quem joga hoje. Entram no máximo 12 times que passam de um corte mínimo, cruzando:
- forma dos últimos 5 jogos
- posição na tabela
- saldo de gols
- clássico do dia
- jogo ao vivo

Cada card mostra o score, a forma e o motivo. Líder frio sem jogo relevante fica de fora; meio de tabela só porque "joga hoje" também.

#### Como o score é calculado

O hype não é uma lista de quem joga hoje — é um score 0-100 montado por sinais
ponderados, com corte mínimo (`MIN_HYPE_SCORE = 44`) e teto de 12 cards. Um time
entra no board pelo que fez, não por estar na tela.

| Sinal | Peso | O que o backtest mostrou |
|---|---|---|
| Forma (últimos 5) | 7 por vitória, 3 por empate (máx. 35) | sozinha acerta tanto quanto o score completo — não acrescenta |
| Posição na tabela | 24 / 18 / 14 / 8 (1º, 2º, 3º, 4º-6º) | sozinha bate o score completo (+17,2pp na validação) |
| Saldo de gols por jogo | 8 se ≥ 1.0, 4 se ≥ 0.5 | o sinal mais forte isolado (+22,7pp) e o de menor peso |
| Clássico do dia | 18 | vale para os dois lados do jogo: decide destaque, não favorito |
| Jogo ao vivo | 14 | idem — simétrico no confronto |
| Joga hoje | 8 | idem — é presença, não força |

O score é `min(100, soma)`.

**De onde saiu o corte 44.** Não foi escolha no olho: o `npm run backtest` varreu
de 24 a 48 com ajuste/validação por liga. O acerto sobe de forma monótona e a
ordem se repete fora da amostra:

| Corte | Acerto (ajuste) | Acerto (validação) | Jogos com card |
|---|---|---|---|
| 28 | 45,5% | 50,0% | 48,6% |
| 36 | 51,9% | 56,8% | 38,4% |
| 40 | 51,3% | 56,7% | 34,7% |
| **44** | **53,3%** | **58,9%** | **30,0%** |
| 48 | 56,5% | 61,6% | 24,3% |

Critério: maior acerto mantendo pelo menos 28% de cobertura — 48 acerta mais, mas
deixa rodada demais sem card. O valor antigo (28) enchia o painel com cards de
28-39, faixa que acerta 39% — abaixo da média do mando.

Na prática, numa rodada de 36 jogos o painel **continua mostrando 12 cards**, mas
o piso subiu de 28 para 53: os slots de baixo deixaram de ser preenchidos por card
fraco.

Repare no peso de "joga hoje": 8 pontos, bem abaixo do corte. É de propósito —
antes o painel listava todo mundo que jogava no dia e chamava isso de hype. "Joga
hoje" sozinho não coloca ninguém no board; ou o time soma forma e tabela, ou não
aparece.

Cada sinal aparece no card como motivo (`Forma 5V`, `Clássico`, `Líder`), então
o ranking é auditável: dá para ver de onde veio cada ponto em vez de aceitar um
número opaco. Os testes em `scripts/test-hype.ts` prendem o corte, os casos de
fronteira e o segundo passo do board (líder entra mesmo sem jogar na rodada),
para o score não derivar sem alguém perceber.

#### O score acerta? (medido, não assumido)

Peso escolhido no olho não vale nada até ser testado contra resultado. O
`npm run backtest` reconstrói a temporada das 8 ligas com ESPN, anda jogo a
jogo **em ordem de data** e, antes de cada partida, monta a tabela só com o que
já aconteceu e chama o `buildHypeBoard()` real do produto. Depois compara com o
placar. Nada do jogo avaliado entra na conta — sem isso o teste se engana
sozinho. **A tabela zera na virada de temporada** (a ESPN informa o ano da
temporada): `dates=<ano>` devolve o ano-calendário, e na Europa ele carrega dois
campeonatos — no `eng.1`, 194 jogos da temporada 2025 e 180 da 2026.

Amostra: **1.923 jogos finalizados, 1.203 elegíveis** (os dois times com pelo
menos 5 jogos de histórico). Baseline nesses mesmos jogos: casa vence 44,1%,
empate 26,3%, fora 29,7%.

| Corte | Vence | Amostra |
|---|---|---|
| Só um lado marcado (score ≥ 44) | 53,7% | 367 |
| ↳ marcado **em casa** | 64,4% (baseline 44,1%, **+20,4pp**) | 177 |
| ↳ marcado **fora** | 43,7% (baseline 29,7%, **+14,0pp**) | 190 |

O lift é positivo dos dois lados, então o que mexe não é só o mando de campo.
E o score é monotônico — quanto maior, melhor a taxa (números do recorde
completo, 1.402 cards):

| Faixa de score | Vence | Amostra |
|---|---|---|
| 40-54 | 46,9% | 668 |
| 55+ | **59,7%** | 734 |

**O limite, que é o achado mais útil:** o time marcado quase sempre é o **melhor
colocado** da tabela, então comparar com a média crua do mando infla o ganho.
A comparação honesta é com uma âncora que não sabe nada de hype: *quanto vence
um melhor colocado qualquer?*

| Comparação | Vence | Esperado | Ganho | Amostra |
|---|---|---|---|---|
| Marcado, vs média do mando | 53,6% | 37,0% | +16,6pp | 1.402 |
| **Marcado, vs melhor colocado** | 53,6% | 48,6% | **+5,0pp** | 1.402 |
| Ancoragem: melhor colocado vence | 48,8% | — | — | 3.236 jogos |
| Marcado **melhor** colocado | 56,9% | — | — | 1.235 |
| Marcado **pior** colocado | 28,7% | — | — | 167 |

Leitura honesta: o score confirma **time forte em boa fase** e rende pouco além
disso — **+5pp** sobre "apostar no melhor colocado", não os +16pp que a
comparação fraca sugere. Ele também **quase nunca marca o azarão** (no corte 44,
apenas 8 cards de 367 na temporada 2026): não descobre zebra. Serve como
termômetro de quem está quente, **não** como sinal de aposta.

> Correção registrada: a primeira versão publicada aqui dizia "marcado pior
> colocado: −14,1pp (n=62)". Aquele número saiu de um replay que **não zerava a
> tabela na virada de temporada**, e o viés vinha do estado somado de duas
> temporadas europeias. Com o replay correto o balde caiu para n=8 na temporada
> 2026 (e 167 no recorde de 2 temporadas) — o achado qualitativo sobreviveu, o
> número não. Fica o registro em vez do número antigo.

Reproduza com `npm run backtest`.

### Recorde público (histórico versionado)

Rodada a rodada o painel grava o que marcou **antes** dos jogos, em
`data/snapshots/<data>.json`, com o contexto daquele momento. O que a tela mostra
na seção "Recorde público" sai de `public/data/hype-record.json`, gerado a partir
desses snapshots.

| Comando | O que faz |
|---|---|
| `npm run snapshot:hype` | reconstrói a temporada por replay (modo `replay`) |
| `npm run snapshot:hype -- --today` | grava a rodada de hoje antes dos jogos (modo `live`) |
| `npm run settle:hype` | liquida os resultados pendentes e republica o recorde |
| `npm run record` | os dois: grava a rodada de hoje e liquida |

Cada snapshot carrega o modo, e o recorde mostra a contagem separada: `replay`
foi reconstruído depois com o mesmo código do produto (sem lookahead), `live` foi
gravado antes da bola rolar. São coisas diferentes e o painel não as mistura.

O recorde também publica a **âncora**: quanto vence um time melhor colocado sem
hype nenhum nesses mesmos jogos. É a comparação que impede o número bonito — ver
a seção acima.

### Classificacao Completa
Tabela de qualquer liga com indicadores visuais de zona: Champions League (verde), Europa League (azul) e rebaixamento (vermelho). Alterna entre 10+ competicoes com um clique.

### Rendimento por mando (casa/fora)
A classificacao da ESPN so traz o total, entao o split de mando e reconstruido dos jogos encerrados da liga: cada time ganha PPG em casa e fora, o card **Fortaleza** aponta quem mais depende do mando e a tabela ganha as colunas `CASA` / `FORA`.

Duas armadilhas do dado apareceram aqui, e as duas viraram verificacao automatica:

- **A janela e o ano-calendario, nao a temporada.** O endpoint aceita `dates=<ano>`; na Europa isso devolve dois campeonatos no mesmo calendario (2025-26 + 2026-27) e o split inflava ate 4x. O corte passou a ser pelos `played` jogos mais recentes de cada time — exatamente a janela que a classificacao mostra.
- **A tabela e o placar nomeiam o mesmo clube de formas diferentes** (`Athletico Paranaense` contra `Athletico-PR`, mesmo id 3458). O split e casado por id, senao o time fica sem casa/fora.

E antes de publicar, o split precisa **reconciliar** com a classificacao: se os jogos de casa e fora de qualquer time nao somarem exatamente o `played` da tabela, o painel mostra "—" em vez de numero errado. Medido nas 6 ligas principais: 0 divergencias e os gols casa+fora batem com o total (739 = 739 no Brasileirao, 141 = 141 na Premier League).

### Artilheiros
Top 10 goleadores da liga selecionada com gols, assistencias e time. Medalhas para o podio (ouro, prata, bronze).

---

## Ligas suportadas

| Liga | Pais |
|------|------|
| Brasileirao Serie A | Brasil |
| Premier League | Inglaterra |
| La Liga | Espanha |
| Serie A | Italia |
| Bundesliga | Alemanha |
| Ligue 1 | Franca |
| Champions League | Europa |
| Eredivisie | Holanda |
| Primeira Liga | Portugal |
| Championship | Inglaterra |

---

## Tech Stack

```
Frontend       Next.js 14 (App Router) + React 18 + TypeScript
Estilizacao    Tailwind CSS + shadcn/ui + Radix UI
Tipografia     Geist Sans / Geist Mono
Dados          Football-Data.org API v4 (tempo real)
Cache          In-memory com TTL (5-30 min por endpoint)
Deploy         Vercel (Serverless Functions)
```

### Arquitetura

```
Browser  -->  Next.js API Routes  -->  Football-Data.org API
                    |
              Cache in-memory
              (5-30 min TTL)
```

Sem banco de dados, sem cron jobs, sem infraestrutura extra. As API Routes atuam como proxy com cache, respeitando o rate limit da API (10 req/min no free tier).

---

## Estrutura do projeto

```
src/
├── app/
│   ├── api/dashboard/
│   │   ├── today/route.ts           # Jogos + hype + stats do dia
│   │   ├── standings/[league_id]/   # Classificacao por liga
│   │   └── scorers/[league_id]/     # Artilheiros por liga
│   ├── layout.tsx                   # Root layout (Geist font, metadata)
│   ├── page.tsx                     # Dashboard (composicao de componentes)
│   └── globals.css                  # Theme dark + CSS variables
├── components/
│   └── dashboard/
│       ├── DashboardHeader.tsx      # Header com status e refresh
│       ├── StatsBar.tsx             # Cards de estatisticas do dia
│       ├── TodayMatches.tsx         # Jogos com placar ao vivo
│       ├── HypeFlags.tsx            # Times em alta com prioridade
│       ├── LeagueStandings.tsx      # Tabela de classificacao
│       ├── TopScorers.tsx           # Artilheiros da liga
│       └── DashboardFooter.tsx      # Footer com creditos
├── hooks/
│   └── useDashboardData.ts         # Hook centralizado de estado
├── services/
│   └── footballApi.ts              # Client da Football-Data API
├── lib/
│   └── cache.ts                    # Cache in-memory singleton
└── types/
    └── index.ts                    # Types + mapeamento de ligas
```

---

## Rodando localmente

### Pre-requisitos

- Node.js 18+
- Token gratuito da [Football-Data.org](https://www.football-data.org/client/register)

### Instalacao

```bash
# Clonar o repositorio
git clone https://github.com/JE4NVRG/HypeFc.git
cd HypeFc

# Instalar dependencias
npm install

# Rodar (nao precisa de chave: o modo ESPN assume)
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000)

Opcional: se quiser os dados da Football-Data.org, copie `.env.example` para
`.env.local` e preencha `FOOTBALL_API_TOKEN`.

### Deploy

**GitHub Pages (site estatico, sem servidor e sem chave)** — e como o demo
publico roda em <https://je4nvrg.github.io/HypeFc/>:

```bash
npm run build:pages
```

Isso gera `out/` com o navegador buscando a ESPN direto (a ESPN libera CORS).
O script afasta `src/app/api` so durante o build, porque as rotas de API usam
`force-dynamic` e nao convivem com `output: export`, e devolve tudo no fim.
O `basePath` vem de `PAGES_BASE_PATH` (default `/HypeFc`, o nome do repo).

O workflow `.github/workflows/pages.yml` publica isso no branch `gh-pages` a
cada push na `main`.

> **Enquanto o Actions estiver indisponivel:** hoje os jobs de usuario desta
> conta nao recebem runner (nem um probe de tres linhas inicia). O caminho que
> funciona e o deploy local, em um comando:
>
> ```bash
> npm run deploy:pages
> ```
>
> Ele faz o build estatico e empurra para o `gh-pages` via worktree
> temporario, com `.nojekyll`. O workflow fica no repo e volta a valer sozinho
> quando a conta for destravada.

**Vercel (SSR, com as API Routes)** — as rotas continuam valendo para quem
quer cache no servidor:

1. Importe o repositorio em [vercel.com/new](https://vercel.com/new)
2. Deploy automatico a cada push na `main`
3. `FOOTBALL_API_TOKEN` e opcional; sem ele o modo ESPN entra

---

## Variaveis de ambiente

| Variavel | Obrigatoria | Descricao |
|----------|:-----------:|-----------|
| `FOOTBALL_API_TOKEN` | Nao | Se presente, jogos/tabela/artilheiros vem de Football-Data.org |
| `FOOTBALL_API_BASE_URL` | Nao | URL base da API (default: `https://api.football-data.org/v4`) |
| `NEXT_PUBLIC_DATA_MODE` | Nao | `static` faz o navegador buscar a ESPN direto (build para Pages) |
| `PAGES_BASE_PATH` | Nao | `basePath` do build estatico (default: `/HypeFc`) |

> Nenhuma chave secreta e exposta no frontend. O token e utilizado apenas server-side nas API Routes.

---

## Autor

<div>

**Jean Carlos Vargas da Silva**

[![GitHub](https://img.shields.io/badge/GitHub-JE4NVRG-181717?logo=github)](https://github.com/JE4NVRG)

</div>

## Licenca

Distribuido sob a licenca MIT. Veja `LICENSE` para mais informacoes.

---

<div align="center">
  <sub>Dados fornecidos por <a href="https://www.football-data.org/">Football-Data.org</a></sub>
</div>
