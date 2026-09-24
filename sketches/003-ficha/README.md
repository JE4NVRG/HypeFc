# Variante: FICHA

Sketch descartável da direção visual "Ficha" para o HypeFC. Abrir:

```
open /Users/jeanvargas/Projects/HypeFc/sketches/003-ficha/index.html
```

Arquivo único: CSS inline, fontes do Google via `<link>`, zero build, zero dependência local.
Todos os textos e números vêm de `../dados-reais.json` (rodada 20/09/2026 22:37), injetados no
arquivo como JSON literal e renderizados por JS — nada foi digitado à mão nem inventado.

## Design stance

O painel é uma **ficha de arquivo**, não um app: papel, tinta, chanfro, picote e carimbo.
A pergunta que a tela responde é "o que foi registrado", não "em quem eu aposto" — o desenho
afasta o tom de casa de aposta por construção, não por disclaimer colado por cima.

Consequências diretas do stance:

- Nada de fundo escuro com acento neon, nada de glow, nada de gradiente de urgência.
- O "carimbo" (borda vermelha torta, sem preenchimento) substitui o badge arredondado.
- Números são de máquina de escrever (mono, tabulares), não de placar de estádio.
- O aviso legal não é rodapé escondido: fica no cabeçalho, logo abaixo da promessa da marca.

## Key choices

### Layout

- **Folha única sobre mesa escura**: o painel é um documento centralizado (max 1180px) com cantos
  chanfrados e uma fileira de furos picotados na borda superior. A mesa é `#23211d`; a folha, `#f4efe4`.
- **Faixa de KPIs como livro-razão**: 5 células separadas por fios de 1px (grid com `gap:1px` sobre
  o próprio fio), sem card arredondado por KPI.
- **Lista de partidas como razão de fichas**: cada jogo é uma linha com 6 colunas fixas
  (liga · mandante · placar · visitante · probabilidade · posse/chutes/no alvo), com cabeçalho de
  colunas em mono. Cada linha é uma ficha chanfrada, não um card flutuante.
- **Mobile com composição própria**, não o desktop espremido:
  - abas viram **índice de fichário em grade 3 + 2 ocupando a largura toda** (não `flex-wrap`);
  - KPIs em 2 colunas, com o último ocupando a linha inteira (nenhuma célula vazia);
  - filtros de liga em **grade de 2 colunas** (10 ligas = 5 linhas cheias, sem chip órfão);
  - cada partida vira uma **ficha deslizante**: liga/status, confronto com placar entre os times,
    barra de probabilidade em largura total e estatísticas em 3 colunas;
  - o cabeçalho de colunas da tabela desaparece (não faz sentido empilhado) — a informação
    passa a ser rotulada dentro da ficha.
- **Faixas intermediárias (761–1060px)** têm arranjo próprio: a coluna de estatísticas sai e
  vira uma linha sob a ficha.

### Typography

- **Archivo** (400/500/600/700/800) para texto e masthead (**HypeFC** em 800, `letter-spacing:-.035em`).
- **IBM Plex Mono** (400/500/600) para todo número, rótulo técnico, liga, status, código do registro —
  é o que dá o ar de ficha datilografada.
- Piso absoluto de **11px** (alinhado ao `DESIGN.md` do app): rótulo técnico é 11px uppercase com
  tracking largo, corpo 13–14px, KPI até 34px em mono.
- Placar em 19px mono com o vencedor em negrito (empate fica sem negrito).

### Color

- Papel `#f4efe4`, papel alternativo `#efe8d9`, tinta `#191713`, cinza tinta `#5b564c`.
- **Um** acento quente: oxblood `#9c2b22`, só para carimbo, selo, sublinhado da aba ativa, filete
  lateral da linha em hover e linha de margem do papel. É cor de carimbo de arquivo, não de odd.
- **Verde de livro-razão `#2f6b4a`** marca a maior probabilidade na barra — porque a legenda real do
  produto diz "verde = maior". Antes o máximo estava em vermelho e a legenda mentia.
- Barra de probabilidade: casa = tinta sólida, empate = hachura de 45° (repeating-linear-gradient),
  fora = tinta a 20%; o maior recebe o verde.
- Nenhuma textura ou ornamento é imagem: chanfro e contorno são `clip-path` em duas camadas
  (fundo = fio, interno = papel), picote é `radial-gradient` repetido, hachura é
  `repeating-linear-gradient`, código de barras do rodapé é `repeating-linear-gradient`.

### Interaction

- **Abas** (`role=tablist`, `aria-selected`, roving tabindex, `←/→/Home/End`) trocam conteúdo de
  verdade: Rodada (KPIs + filtros + 10 fichas), Liga (índice de 9 ligas + 12 times em alta),
  Recorde (registro público + modelo medido), Esportes (cobertura do recorte + 9 ligas),
  Pro (grátis × Pro, preço, CTAs).
- **Filtros de liga filtram de verdade**: Todas 10 → Brasileirão 5 → Ligue 1 3 → Premier League 0
  (estado vazio próprio, com o número real de jogos da liga na rodada) → volta para 10.
- **Hover visível** em abas, chips, fichas de partida (fundo + filete vermelho de 3px), linhas do
  registro, botões (CTA Pro vai para oxblood) e botões de compartilhar (vão para a tinta).
- **Copiar link** mostra confirmação inline por 2s; foco visível em todo interativo
  (`:focus-visible` com oxblood); `prefers-reduced-motion` zera transições.

## Trade-offs

### Strong at

- **Distanciamento de casa de aposta**: papel claro + carimbo + mono não têm parentesco visual com
  app de aposta; o aviso legal vira parte da composição em vez de letra miúda.
- **Legibilidade de dado**: números mono tabulares alinhados por coluna fazem o olho comparar
  0,629 com 0,667 e 53.6% com 37.0% sem esforço.
- **Registro público como herói**: a aba Recorde é a mais "bonita" da ficha — é o que a marca vende.
- **Mobile de verdade**: duas composições distintas, ambas medidas sem estouro.
- **Rastreabilidade**: todo texto visível vem do JSON; nada foi inventado para preencher.

### Weak at

- **Densidade no desktop**: a ficha de partida tem 6 colunas de dados; em telas de 1024–1060px ela
  precisa sacrificar a coluna de estatísticas para não apertar.
- **Tema claro é decisão, não detalhe**: quem usa o painel à noite perde o conforto do escuro; não
  existe versão escura nesta direção (e uma versão escura "papel" exigiria repensar contraste e carimbo).
- **Metáfora pode cansar**: chanfro + picote + carimbo funcionam no cabeçalho e nas fichas; se
  replicados em toda tela nova (gráfico, tabela de classificação, alerta por e-mail), viram ruído.
- **Menos "tempo real"**: o tom de documento comunica registro histórico melhor do que "ao vivo".
  Estados de jogo em andamento pedem um tratamento à parte (selo pulsante, por exemplo) que este
  sketch não resolveu.
- **Sem gráfico**: a probabilidade aparece como barra de 3 segmentos; uma série temporal (Brier ao
  longo das rodadas) precisaria de um desenho novo, herdado do papel.

## Best for

- Quem assina pelo **registro e pelo alerta** — compara o modelo com o próprio chute e quer ver a
  conta na mesa, não um palpite para seguir.
- Uso de **consulta e conferência**: abrir no fim da rodada, filtrar a liga, ler o que o modelo
  previa e o que aconteceu.
- Marca que precisa se **diferenciar de tipster**: a direção sustenta "o palpite não está à venda"
  na cor, na tipografia e no desenho, não só no texto.

## O que foi corrigido depois de medir/ver

- **Placar espelhado** (bug real, achado por medição): o visitante aparecia nos dois lados
  ("3–3" em Corinthians 1–3 Fluminense). Corrigido e reverificado nos 10 jogos.
- Estatísticas duplicadas na linha desktop (a linha do breakpoint intermediário vazava para 1440).
- "Brasileirão Série A" quebrando com "A" órfão na coluna de 128px → coluna 148px + `text-wrap:balance`.
- Máxima probabilidade em vermelho contradizia a legenda real ("verde = maior") → verde de livro-razão.
- "destaque fora" lia como palpite → "maior prob. fora".
- Idade/célula vazia cinza na grade de KPIs no mobile (5 KPIs em 2 colunas) → último KPI ocupa a linha.
- Abas no mobile em `flex-wrap` (3 + 2 com buraco à direita e fora do trilho) → grade 6 colunas (3 + 2 cheia).
- Chips de liga no mobile com chip órfão na última linha → grade de 2 colunas.
- Rótulos quebrados no registro ("mandante: média do mandante 37,0%", "de acerto") → vocabulário do
  próprio JSON, sem repetição.
- Serial da ficha quebrava deixando "22:37" órfão no mobile → hora escondida no mobile.

## Observação para o produto (não é problema deste sketch)

Os números do `registro_publico` misturam separador decimal: `53.6%`, `+16.6pp` (ponto) contra
`0,629`, `0,667`, `46,5%` (vírgula). Isso vem de produção e foi mantido verbatim — mas é uma
inconsistência de PT-BR que vale corrigir na origem.
