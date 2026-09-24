# Movimento — direção 001 (Almanaque)

Camada de movimento implementada sobre `MOTION-SPEC.md`. Tudo em `index.html` (arquivo único:
CSS inline + JS inline, sem build, sem biblioteca). Números abaixo são medidos no navegador
(sessão `browser_exec` nomeada `mov-001`, Chrome via CDP), não estimados.

## Tokens (`:root`, usados por token — nada de duração solta)

| token | valor | onde |
|---|---|---|
| `--m-fast` | `120ms` | hover/foco/pressão, fade das linhas que saem |
| `--m-base` | `200ms` | entrada da página, troca de aba, FLIP |
| `--m-slow` | `320ms` | definido e **sem uso** nesta direção (ver "fora") |
| `--m-count` | `700ms` | contagem do número do registro |
| `--m-out` | `cubic-bezier(.16,1,.3,1)` | entrando |
| `--m-in` | `cubic-bezier(.55,0,1,.45)` | saindo |
| `--m-inout` | `cubic-bezier(.65,0,.35,1)` | movendo entre dois pontos |

O CSS usa `var(--m-*)` diretamente; o JS (FLIP, fade, contagem) lê **os mesmos tokens** por
`getComputedStyle(document.documentElement)` — a duração do FLIP, do fade e a curva da contagem
saem de `--m-base`, `--m-fast` e `--m-out`, sem duplicar valores no script.

## O que existe

- **A. Entrada da página** — 8 blocos (`topline`, `brand`, `reg`, `reg-foot`, `tabs`, `sec-head`,
  `kpis`, `lead`) com `opacity 0→1` + `translateY(8px)→0` em `--m-base`, stagger de 40ms
  (`--md: 0/40/…/280ms`), `animation-fill-mode: both`, uma vez no primeiro paint. Ao terminar o
  `animationend`, a classe sai: a animação deixa de existir e `getAnimations()` volta a zero.
- **B. Troca de aba** — só o painel que entra anima (`mPanelIn`, `opacity` + `translateY(6px)`, `--m-base`);
  o antigo é escondido sem animação. Aba e ficha reagem à pressão com `scale(.98)` em `--m-fast`.
- **C. Filtro de liga (FLIP de verdade)** — as linhas que ficam são medidas antes e depois, o delta
  invertido é aplicado por `transform` e animado até zero em `--m-base`/`--m-inout`; as que saem
  continuam visualmente no lugar (fora do fluxo) e fazem `opacity 1→0` em `--m-fast`, sendo
  removidas no fim. Os nós são reaproveitados por `data-key` (não se reconstrói a lista).
- **D. Barra de probabilidade** — 3 segmentos crescem de `transform: scaleX(0)` a `1`
  (`transform-origin:0 50%`) em 400ms com 60ms entre segmentos, só na primeira vez que a linha
  aparece (não repete em hover — o segmento não tem animação em `:hover`).
- **E. Número do registro público** — `#reg-cards` conta de 0 a 1402 em `--m-count` com a curva de
  `--m-out`, formatado com `Intl.NumberFormat('pt-BR')` → `1.402`. Dispara uma vez, via
  `IntersectionObserver` (com rede de segurança de 2,5s para o valor nunca ficar em 0). Usa rAF
  **de uma vez só** (para em 700ms), não permanente.
- **F. Hover/foco** — `focus-visible` ganhou a mesma resposta visual do hover em `.tab`, `.ficha` e
  `.btn`; o indicador "atualizado às HH:MM" ganhou um ponto quadrado (raio 0) que **pulsa 3 vezes de
  2s na carga e para**, voltando a pulsar no `hover`/`focus` do bloco (WAAPI com `iterations:3`,
  `fill:none`; nunca fica rodando). Nenhuma animação infinita em nenhum ponto do arquivo.

## Verificação (7 itens)

1. **Nada em loop.** Amostragem por `rAF` desde o primeiro frame (849 amostras, 0→14,2s):
   `document.getAnimations().length` = **1 em t≈1s** (só o pulso limitado do indicador,
   `waapi 1×2000ms`) e **0 em t≈12s**; último frame com qualquer animação: **5985ms**. Primeiros
   frames: 39 animações em t=47ms (`mEnter:8×200ms` + `mBar:30×400ms` + pulso), 1 em t≈600ms.
2. **`prefers-reduced-motion: reduce`** (com `Emulation.setEmulatedMedia` + reload):
   (a) **742 elementos** varridos: maior `animation-duration` = **0.01ms**, maior
   `transition-duration` = **0.01ms**, **0** elementos acima de 50ms, `getAnimations()` = **0**;
   (b) `#reg-cards` = **`1.402` já no primeiro paint** (lido imediatamente após o load) e **nenhum
   `0`** em `#reg-cards`/`.plate-big`/`.dl .v`/`.mrow .vl`;
   (c) **90 elementos** do painel visível avaliados (linhas, KPIs, fichas, barras, cabeçalho):
   **0 invisíveis**; 10/10 linhas com opacidade 1 e altura > 0; 30/30 barras no estado final
   (`transform: none`, largura > 0). Com **JS desligado** (`Emulation.setScriptExecutionDisabled`):
   `.topline` opacidade 1 / `transform: none`.
3. **Propriedades animadas.** Conjunto observado em toda a série: **`{opacity, transform}`**.
   Nomes/durações: `mEnter` 200ms, `mBar` 400ms, WAAPI do pulso 2000ms. Declarado no CSS:
   `transition-property` ∈ `{background-color, color, transform}` e `animation-name` ∈
   `{mEnter, mEnterSm, mPanelIn, mBar}`. Nada de `width/height/top/left/margin/padding/border-radius/filter`.
4. **Instabilidade de layout.** `performance.getEntriesByType('layout-shift')` somando `value` =
   **0** (0 entradas), medido a ~2s, ~12s e ~13,5s depois da carga.
5. **FLIP.** Partindo de "Todas" (10 linhas) e clicando na ficha **Ligue 1**: contagem **10 → 3**
   (`#rows-now` = 3, `#count-line` = "Ligue 1 · 3 de 3 jogos desta liga no recorte"). No 1º frame após o
   clique as 3 linhas continuam na posição antiga (topos **1515,5 / 1629,6 / 1743,6**) e chegam por
   `transform` em **946,27 / 1059,32 / 1173,37** — iguais ao baseline medido sem FLIP
   (`paint(false)`): **delta 0,00 px** em topo e altura nas 3 linhas; 1ª linha == topo do ledger
   (946,27). Rastreio a cada frame (janela de 200ms, página rolada, coords de viewport):
   869 → 866,2 → 856,1 → 836,5 → 801,2 → 739,4 → 641,1 → 479,5 → 446,3 → 416,9 → **414,3** e para.
   As 7 que saem fadeiam juntas (7 fantasmas, opacidade→0 em ~120ms, 0 restantes depois).
6. **Estouro horizontal.** `scrollWidth - innerWidth` = **0** em **1440×1000** (doc e body) e
   **0** em **390×844** (doc e body), medido depois de cada `Emulation.setDeviceMetricsOverride`
   seguido de reload.
7. **Prints + leitura visual.** `print-1440x1000.png` (1440×2303), `print-390x844.png` (390×5232) e
   `print-1440-recorde.png` (1440×1568, aba Recorde). `vision_analyze` nos três: sem texto
   sobreposto/cortado, sem elemento sem estilo, fontes carregadas (`document.fonts.check` = true
   para Instrument Serif, Newsreader e IBM Plex Mono), barras de probabilidade preenchidas, faixa de
   registro legível como 1.402 / 53,6% / 37,0% / +16,6pp, abas em duas colunas no mobile.

## Achados (corrigidos porque apareceram na leitura visual)

- **Fichas de liga sem os fios da grade.** `getComputedStyle('.ficha').borderBottomWidth` = **0px**:
  o `border:0` (reset de botão, mesma especificidade) vencia `.grid-lines > *`, então as fichas
  pareciam lista crua. Corrigido com `.fichas > .ficha{border-right/bottom:1px solid var(--rule)}` —
  depois: **10/10** fichas com fio de 1px. Não é movimento, mas o item 7 pede essa leitura.
- **Medição em aba oculta.** Quando `document.visibilityState === 'hidden'` o Chrome não produz
  frames: animações e a contagem ficam presas (`currentTime 0`, `playState "running"`). As medições
  acima foram refeitas com a aba em primeiro plano (`Page.bringToFront` + verificação de
  visibilidade em cada espera). Isso também explica por que o bloco de movimento reduzido é
  **estruturalmente inerte** além de ter duração 0.01ms: sob `reduce` as classes de animação não
  são aplicadas (`limparMovimento()`), `animation-name: none` e `transition-property: none` — nada
  preso no estado inicial, e nada depende de a animação terminar. `transition-property: none`
  também evita que o `transition-property: all` inicial crie transições de `max-width`/`width`
  (propriedade fora da lista permitida).

## Conscientemente fora

- **`--m-slow` sem uso**: nesta direção nenhum movimento é "maior/raro" o bastante; fica definido
  como parte dos tokens, não invento uso.
- **Sem parallax, bounce, confete, gradiente animado, ícone de fogo** — a lista "Proibido" inteira.
- **Sem `will-change`** em nenhum ponto (medido: 0 ocorrências).
- **Sem biblioteca** e sem requisição de script externo (a única URL externa é o CSS do Google
  Fonts). `requestAnimationFrame` aparece 2 vezes, ambas na contagem de 700ms que se encerra.
- **Sem FLIP na troca de aba**: os painéis são montados uma vez e apenas mostrados/escondidos;
  quando o painel entra não há reordenação de linhas para animar (a spec só pede `opacity` + 6px).
- **Sem contagem nos outros números** do registro (média, lift, Brier): o item E é sobre o número do
  registro público (1402).
- **Uma animação por elemento**: as 10 linhas da lista entram junto com o bloco `.lead` (não há
  stagger por linha); o stagger de 60ms do item D é entre os 3 segmentos de uma mesma barra, não
  entre itens de lista.

## Reproduzir

`browser_exec` em sessão `mov-001`: abrir `file:///…/001-almanaque/index.html`;
`Emulation.setDeviceMetricsOverride` (reload depois); `Emulation.setEmulatedMedia`
`features:[{name:'prefers-reduced-motion',value:'reduce'}]` (reload depois);
`Page.addScriptToEvaluateOnNewDocument` com um laço `rAF` que registra
`document.getAnimations()`; `Page.bringToFront` em cada espera (a aba oculta congela a medição).
