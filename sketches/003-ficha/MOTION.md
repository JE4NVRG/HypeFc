# 003-ficha — camada de movimento

Arquivo único (`index.html`, CSS e JS inline), sem build e sem biblioteca. Movimento só onde
comunica **estado**: dado que chega, troca de painel, seleção, recorte novo, indicador ao vivo.

## Tokens (definidos em `:root` e usados sempre por token)

| token | valor | onde entra |
|---|---|---|
| `--m-fast` | `120ms` | feedback de mouse/tato, saída de linha no filtro |
| `--m-base` | `200ms` | transições de estado (entrada de bloco, painel da aba, FLIP) |
| `--m-slow` | `320ms` | definido, hoje **sem uso** (reservado para movimento maior e raro) |
| `--m-count` | `700ms` | contagem do número do registro público |
| `--m-out` | `cubic-bezier(.16,1,.3,1)` | entrando |
| `--m-in` | `cubic-bezier(.55,0,1,.45)` | saindo |
| `--m-inout` | `cubic-bezier(.65,0,.35,1)` | movendo entre dois pontos |

Token extra: `--live:#ff5a3c` (coral do brief) usado **só** no ponto do indicador de atualização.
O resto da paleta da ficha ficou intacto.

O JS lê os tokens do CSS (`getComputedStyle`), então duração e curva têm uma única fonte de verdade.

## O que foi implementado

**A — entrada da página (uma vez, no primeiro paint).** `.masthead`, `.kpis`, `.tabs` e `#list`
recebem `.m-rise` (`opacity 0→1` + `translateY(8px)→0` em `--m-base`), com stagger de **40ms por
bloco** (0/40/80/120ms), `animation-fill-mode:both`. O `animationend` remove a classe — o elemento
volta ao estado natural, que é o mesmo do fim da animação, então nada salta e nada fica "em efeito".
Não repete em scroll, em troca de aba nem em filtro (flag `entered`).

**B — troca de aba.** O painel novo (`#view`) entra com `opacity` + `translateY(6px)→0` em `--m-base`
(`.m-panel`); o painel antigo sai sem animação (o `innerHTML` é trocado direto, não atrasa a leitura).
A aba clicada responde na hora com `scale(.98)` (`--m-fast`). Para isso as abas **não são mais
recriadas no clique**: `updateTabs()` só ajusta `aria-selected`/`tabindex`, então o DOM que o
`:active` está animando sobrevive (antes, `renderTabs()` matava o próprio botão clicado).

**C — filtro de liga com FLIP de verdade.** No clique do chip: mede os rects das linhas visíveis,
marca as que vão sair e as faz `opacity→0` em `--m-fast`; 120ms depois troca o conteúdo e, para cada
linha que permaneceu, aplica o delta invertido (`translate(dx,dy)`) e anima até zero em `--m-base`
com `--m-inout` (Web Animations, `fill:none`, `onfinish` cancela). Chip/tally são atualizados no
lugar, sem re-render do painel. As linhas novas (volta para "Todas") entram direto, sem animação —
o spec só pede movimento das remanescentes e fade das que saem.

**D — barra de probabilidade.** No primeiro paint da lista os 3 segmentos de cada linha crescem de
`transform:scaleX(0)` para `1` (`transform-origin:left`), 400ms, stagger de **60ms entre segmentos**
da mesma linha. Flag `barsDone` garante que isso acontece **uma vez**; não repete em hover, filtro
nem volta de aba.

**E — número do registro público.** Ao entrar em tela pela primeira vez (IntersectionObserver,
`threshold:.4`), os quatro números contam de 0 até o valor final em `--m-count` com a curva `--m-out`,
formatados por `Intl.NumberFormat('pt-BR')`: `1402 → 1.402`, `271 → 271`, `53.6% → 53,6%`,
`+16.6pp → +16,6pp`. Chave por número: roda **uma vez** por carga, mesmo saindo e voltando da aba.

**Indicador "Atualizado às HH:MM" (regra dura 3).** O rodapé ganhou um ponto coral de 8px. Ele pulsa
**3 ciclos de 2s** na carga (`m-dot`, `scale`+`opacity`, 6s no total) e depois fica estático; volta a
pulsar no `hover` e no `focus-visible` do bloco (`.live`). Duração limitada, nunca `infinite`,
conforme WCAG 2.2.2.

**F — hover/focus.** Todos os alvos que respondiam ao hover agora respondem igual no teclado:
`.chip:focus-visible` (mesmo fundo do hover + outline coral), `.btn:focus-visible`,
`.btn--ghost:focus-visible`, `.share:focus-visible`, `.live:focus-visible`, e `:focus-within` para
`.match`, `.lrow` e `.tile__i` (que não são focáveis mas podem ganhar foco de dentro).

**Higiene de propriedade.** Todas as transições que existiam em `box-shadow` e `border-color` foram
tiradas (essas trocas agora são instantâneas); sobrou só `background-color`, `color` e `transform`.
Nenhum `will-change` fixo, nenhum scroll listener, nenhum `requestAnimationFrame` permanente (o
único rAF é o da contagem, que termina em 700ms).

## Números medidos (sessão de browser `mov-003`, 1440x1000 e 390x844)

> **Armadilha do método, importante:** com a janela do Chrome ocluída a página fica `hidden`, o
> `document.timeline.currentTime` congela em 0 e as animações CSS ficam **pendentes para sempre**
> (`playState:"running"`, `currentTime:null`) — `document.getAnimations()` nunca esvazia. Todas as
> medições abaixo foram feitas com `Page.bringToFront` + `Page.setWebLifecycleState:active` e com
> `document.visibilityState === "visible"` conferido antes de cada leitura.

**1. Nada em loop.** `document.getAnimations().length` ≈1s depois da carga = **1** (só `m-dot`, o
pulso de 3 ciclos que ainda está rodando); 12s depois = **0**. Repetido em duas execuções:
`[m-dot] → 0` e `1 → 0`.

**2. `prefers-reduced-motion: reduce`** (via `Emulation.setEmulatedMedia`, com reload):
- (a) nenhuma animação com duração > 0,05s: `getAnimations()` = **0** em repouso, e a maior duração
  computada varrendo todo o DOM (`animationDuration` + `transitionDuration` de cada elemento) =
  **0,00001s (0,01ms)**. Ao clicar numa aba aparecem 4 transições de estado (`background-color` e
  `color` dos dois botões), todas também de **0,01ms**.
- (b) valor final do registro aparece imediatamente: no clique da aba Recorde, no t=0 o DOM já diz
  **`1.402 | 271 | 53,6% | +16,6pp`** e continua idêntico 0,9s depois — não há contagem.
- (c) linhas continuam visíveis: **10** fichas, `opacity` = `1` em todas, alturas 88/114px,
  **30** segmentos de barra com largura > 0 e `transform: none`.

**3. Propriedades animadas.** União amostrada a cada 40ms durante carga + hover + filtro + troca de
aba: **`{transform, opacity, backgroundColor, color}`** — nada fora do permitido. Detalhe do que
apareceu: `m-rise` (200ms, opacity+transform), `m-seg` (400ms, transform), `m-rise6`/painel (200ms,
opacity+transform), `m-fade` (120ms, opacity), `m-dot` (2000ms ×3, opacity+transform), a animação
anônima do FLIP (200ms, transform) e transições de estado `background-color`/`color` (120ms).

**4. Layout shift.** `performance.getEntriesByType('layout-shift')` somando `value` = **0**
(**0 entradas**) medido 4s após a carga, com a observação instalada antes do load — repetido em duas
execuções independentes, e também **0** depois de hover + filtro + troca de aba. O FLIP não gera
shift nenhum (usa `transform`).
*Ressalva honesta:* numa execução anterior, com a webfont baixando a frio, entraram 0,0739
(métrica da Archivo trocando no primeiro paint) e 0,0631 nas duas vezes em que o rodapé entra/sai da
viewport porque o recorte muda a altura do documento. Com a fonte em cache a soma é 0 constante.

**5. FLIP do filtro.** Clique em "Primeira Liga": fichas visíveis **10 → 2**; **2 linhas
remanescentes movidas** com `dx = 0`, `dy = 808,63px` cada; destino registrado (663,41 / 761,25px) vs
rect depois da animação (663,41 / 761,25px) → **erro final = 0,0px**, `transform` residual `none`;
contagem do recorte atualizada para "2 fichas em Primeira Liga · a liga teve 5 jogos na rodada".
Volta para "Todas": **10** linhas, 2 movidas com `dy = -808,63px` (destino 1472,05 / 1569,88px).

**6. Estouro horizontal.** `scrollWidth − innerWidth` = **0** em **1440x1000** e **0** em **390x844**
(com e sem scroll de página; `scrollWidth = innerWidth = 1440` e `390`).

**7. Prints finais + leitura visual.** Prints na pasta do sketch:

| arquivo | o que mostra |
|---|---|
| `print-1440x1000.png` | topo da ficha em 1440x1000 (hero, KPIs, abas, filtros, lista) |
| `print-1440x1000-lista.png` | lista de partidas (barra de probabilidade) |
| `print-1440x1000-recorde.png` | aba **Recorde** com os quatro números do registro |
| `print-1440x1000-rodape.png` | rodapé: ponto coral do "atualizado às 22:37", botões e legendas |
| `print-390x844.png` | mobile 390x844 |

Leitura com `vision_analyze`: sem HTML cru, sem fonte de fallback, sem bloco invisível e sem texto
sobreposto. Achados cosméticos: o último card é cortado pela borda do frame (é recorte de viewport,
não overflow — medido 0) e, no mobile, o canto chanfrado do chip dá a impressão de corte à direita
(o `clip-path` da ficha), mas o estouro medido é 0.

## Uma correção fora da camada de movimento (documentada, não silenciosa)

O rótulo e o valor dos KPIs estavam nos mesmos `<span>` inline, com `margin-top:8px` que não faz
efeito em elemento inline — o resultado era `RODADAS MEDIDAS271`, com o rótulo encostando no número
(achado da leitura visual do item 7). Isso é **anterior** à camada de movimento (as regras
`.kpi__l`/`.kpi__v` e a estrutura do markup não foram tocadas pelo movimento). Corrigi com o mínimo:

```css
.kpi__l,.kpi__v{display:block}         /* o margin-top:8px volta a funcionar */
.registro .kpi__l{min-height:32px}     /* os 4 números do registro na mesma linha de base */
```

Depois: rótulos dos 4 cards em y=430 e valores em y=470 (**gap de 40px** nos quatro), sem colisão.
Nenhuma outra regra de layout foi alterada.

## O que ficou de fora, conscientemente

- **Entrada animada das linhas novas** que aparecem ao voltar para "Todas" — o spec pede fade das que
  saem e movimento das que ficam; linha nova entra direto, sem custo de leitura.
- **Barra de probabilidade em hover/re-render** — só no primeiro paint da lista, como manda o item D.
- **FLIP na troca de aba** — troca de painel é substituição de conteúdo, não reordenação; o painel
  antigo sai sem animação (item B).
- **Rodapé e legendas** fora do item A (o spec lista hero, KPIs, abas e primeira lista).
- **`--m-slow`** definido e não usado — não havia movimento "maior e raro" para aplicar.
- **Scramble** não existe nesta direção.
- Biblioteca externa, `will-change` fixo, `rAF` permanente, scroll listener: não entraram.
