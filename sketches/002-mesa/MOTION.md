# 002-mesa — camada de movimento

Implementa `../MOTION-SPEC.md` na direção **Mesa** (grafite `#0B0E11`, painel `#12161B`,
hairline `#1F262E`, JetBrains Mono + Inter Tight, raio 0, zero sombra). Arquivo único
(`index.html`), CSS e JS inline, sem build e sem biblioteca. Dados intactos
(`../dados-reais.json` → bloco `#dados`).

## Tokens (no `:root`, e tudo passa por eles)

```css
--m-fast:120ms;  --m-base:200ms;  --m-slow:320ms;  --m-count:700ms;
--m-out:cubic-bezier(.16,1,.3,1);      /* entrando */
--m-in:cubic-bezier(.55,0,1,.45);      /* saindo */
--m-inout:cubic-bezier(.65,0,.35,1);   /* movendo entre dois pontos */
```

A contagem do registro resolve a MESMA curva de `--m-out` em JS (bisecção sobre a
bezier) e lê a duração de `--m-count` do CSS — não há número solto no script.

## O que foi implementado

| Item do spec | Onde |
|---|---|
| **A. Entrada** | classe `.mv` em masthead, KPIs, abas e `#lista`, `opacity 0→1` + `translateY(8px)→0` em `--m-base` com `both`, delay 40ms por bloco. Uma vez, no primeiro paint; não há nenhum scroll listener. |
| **B. Troca de aba** | painel novo entra com `.mv-pane` (`opacity` + `translateY(6px)→0`, `--m-base`); painel antigo recebe `hidden` sem animação. Aba tem `:active{transform:scale(.98)}` em `--m-fast`. |
| **C. Filtro de liga (FLIP real)** | `renderLista(true)` mede os rects, re-renderiza, aplica `translateY(delta)` invertido e anima até zero por `transform` em `--m-base` com `--m-inout`; quem sai vira cópia absoluta (`top/left` estáticos, não animados) e faz `opacity→0` em `--m-fast`, sendo removida no fim. |
| **D. Barra de probabilidade** | `.mv-bars` nos 3 segmentos: `scaleX(0)→1` em 400ms, delay 0/60/120ms, `transform-origin:left`. Só na primeira vez que a linha aparece (set `vistas`); hover não repete. |
| **E. Número do registro** | `data-contar="1402"` no laudo (Cards liquidados) e no bloco "Recorde público" do aside; `IntersectionObserver` dispara na primeira entrada em tela e roda uma vez. `Intl.NumberFormat('pt-BR')` → `1.402` (também no meta da aba). |
| **F. Hover/focus** | `:focus-visible` ganhou a mesma resposta do hover em `.tab`, `.chip`, `.lrow`, `.ptab`, `.btn`, `.share button` (`background` `--paper-2`/`--paper-3` + mesma barra inset), e `.arow:focus-within`. `.partida` é linha não interativa (sem `tabindex`), então fica só no hover. |

Extras que o spec pede: o ponto de "Atualizado às HH:MM" pulsa **3× com ciclo de 2s** na
carga e para (volta a pulsar no `hover`/`focus` do bloco, também limitado a 3 ciclos).

### Como o "nada fica em loop" é garantido

`document.getAnimations()` devolve também animação **terminada com `fill:both`** (segue "em
efeito"). Por isso toda classe animada (`.mv`, `.mv-pane`, `.mv-bars`, `.mv-pulse`) é removida
no `animationend` pelo nome da animação (`aoTerminar`), e o estado base do elemento já é o
estado final — nenhum salto visual. `will-change: transform` existe **só** durante o FLIP e é
limpo no `transitionend` (0 elementos com `will-change` preso depois).

### Propriedades animadas

Transições foram reduzidas a `background-color`, `color` e `transform`: `box-shadow`,
`border-color` e `border-left-color` deixaram de ser transicionados (o hover agora é instantâneo
nesses). As animações usam só `transform` e `opacity`.

### Consistência de direção (exigida pelo brief)

`--sinal` (`#E8FF59`) ficou restrito às três coisas: **número do registro**, **botão de
assinar** e a palavra **"registro"** na manchete. Saíram do sinal: o anel de `:focus-visible`
(agora `--ink`), o quadrado do logo (agora `currentColor`), os outros números do laudo (agora
`--ink`) e o rótulo "Acerto por card" (verde → `--ink-2`). `--verde` (`#7BE495`) agora aparece
**só** em `.pnums .pv.hi` (a maior probabilidade da linha); o feedback do "Copiar link" deixou
de pintar de verde.

## Números medidos

Sessão `browser_exec` **mov-002**, serviço local `http://127.0.0.1:8899/002-mesa/index.html`.
Pitfall do ambiente: a aba do navegador abriu `hidden`, e **em aba escondida nenhuma transição
avança** (nem `setTimeout` de 170ms dispara) — todas as medições abaixo foram feitas depois de
`Page.bringToFront` (aba `visible`).

**1. Nada em loop** — `document.getAnimations().length`
- ~1s depois da carga: **1** (só `mv-pulso`, o pulso limitado de 3×2s) — propriedades: `opacity`, `transform`.
- 12s depois: **0** (`nomes: []`). Repetido depois de navegar por todas as 5 abas: **0**.
- Classes animadas presas no DOM ao fim: **0** (`mv`, `mv-pane`, `mv-bars`, `mv-pulse`).
- Timeline gravada por `rAF` nos 3 primeiros segundos: `mv-bloco` de **62ms a 394ms** (4 blocos), `mv-barra` de **62ms a 594ms** (10 barras = 30 segmentos), `mv-pulso` de 62ms até passar dos 3s.

**2. `prefers-reduced-motion: reduce`** (recarregado com `Emulation.setEmulatedMedia`)
- (a) `getAnimations().length` = **0** e duração máxima = **0ms** logo após a carga; nenhuma animação > 0,05s. Ao abrir a aba Recorde: **4 transições de 0,01ms** (tokens viraram `.01ms`), durando ≤ 0,05s, e **0** depois de 0,7s.
- (b) valor final imediato: laudo = **`1.402`** e aside = **`1.402`**, sem contagem (os tokens `--m-*` estão em `.01ms` e o JS não anima).
- (c) linhas visíveis: **10 de 10** (opacidade `1`, visibilidade `visible`, altura > 10px); `#lista` com opacidade `1`.

**3. Propriedades animadas** (percorrendo `document.getAnimations()`)
- na carga: `opacity`, `transform`.
- em hover/estado real (mouse do CDP): `background-color`, `color`, `transform`.
- conjunto final: **`{transform, opacity, background-color, color}`** — nada de `width`, `height`, `top`, `left`, `margin`, `padding`, `border-radius`, `filter` nem `box-shadow`.
- união medida em **todos** os hovers com mouse real (`.chip`, `.tab`, `.lrow`, `.partida`, `.ptab`, `#share button`, `.btn`, `.arow`), na troca de aba e no estado do CTA Pro (`#cta-pro` → `.nota.on`): **`['backgroundColor', 'color', 'opacity', 'transform']`** — exatamente o permitido. O único `border-*` que existia em transição (`.nota`) foi removido.

**4. `layout-shift`** — soma de `value`: **0** aos 3,3s (0 entradas) e **0** aos 12,4s (0 entradas); depois do clique de filtro a soma continua **0** (nenhuma entrada, nem com `hadRecentInput`).

**5. FLIP medido** (filtro "Primeira Liga", 1440×1000)
- visíveis: **10 → 2**; `#contagem` = "Exibindo 2 de 10 fichas".
- as 2 linhas remanescentes estavam em `topo 1572/1658`; no tick do clique receberam `matrix(1,0,0,1,0,820.39)` (=250px… 820,39px de delta invertido), aos 70ms já estavam em `820.39 → 702.03` com topo visual **1454** (movendo por `transform`), e aos 620ms: `transform: none`, topo **752/838**, igual à posição de layout (`offsetTop`), desvio **0,2px**, opacidade `1`.
- 8 linhas de saída: cópias `position:absolute`, opacidade `1 → 0,724` aos 70ms por `--m-fast`, **0** restantes aos 620ms.
- **Barra (item D)**: `scaleX` do 1º segmento ao longo do tempo: `0` → `0,225` → `0,425` → `0,570` → `0,681` → `0,763` → `0,824` → `0,901` → `0,947` → `1`, 27 valores distintos, terminando em ~520ms (400ms + 2×60ms).
- **Contagem (item E)**: `0 → 1.402` em **617ms medidos** (token `--m-count` = 700ms), 37 valores intermediários, terminando em `1.402` (pt-BR). O mesmo no laudo ao abrir a aba Recorde.
- **Aba sob pressão**: `transform: matrix(0.9804,…)` com `transition-duration: 0.12s` (`--m-fast`) e transição `transform` rodando; volta a `none` ao soltar.
- **`:focus-visible` por teclado**: `background-color: rgb(18,22,27)` (= `--paper-2`, idêntico ao hover) + contorno 2px `rgb(230,234,240` (`--ink`).

**6. Estouro horizontal** (`scrollWidth - innerWidth`)
- **1440×1000: 0** (`docScrollWidth 1440` = `innerWidth 1440`; `bodyScrollWidth 1440`).
- **390×844: 0** (`390 = 390`, página de 4262px de altura); nenhum elemento do `body` com `right > innerWidth`. Conferido elemento a elemento onde o print sugeria corte: botões de compartilhar terminam em 316px, linha do Brier em 374px, itens da legenda em 374px — tudo dentro dos 390px (a suspeita de corte no print era leitura errada da imagem).

**7. Prints + leitura visual** (em `002-mesa/`)
- `print-1440-final.png` (tela 1440×1000), `print-1440-pagina.png` (página inteira 1440), `print-390-final.png` (tela 390×844), `print-390-pagina.png` (página inteira 390), `print-1440-recorde-final.png` (aba Recorde, página inteira).
- `vision_analyze` nos três: **sem texto sobreposto, sem elemento sem estilo, sem fonte faltando** (JetBrains Mono e Inter Tight com `document.fonts.status = "loaded"` e `fonts.check` = true nos dois), sem bloco invisível, colunas alinhadas. As duas suspeitas de transbordo no mobile foram checadas por medição e não existem.

## O que ficou de fora de propósito

- Nada de entrada por scroll, parallax, bounce, confete, gradiente animado ou biblioteca — não carregam informação.
- **Sem stagger por linha na entrada**: `#lista` entra como um bloco (o spec pede stagger por bloco, máx. 40ms, e uma animação por elemento); as linhas só animam individualmente na barra de probabilidade (item D).
- **`--m-slow` (320ms) definido e não usado** — não apareceu movimento "maior e raro" que comunicasse estado; preferi não inventar.
- A contagem **só dispara quando o elemento entra em tela** (IntersectionObserver). O bloco "Recorde público" do aside fica abaixo da dobra em 1440×1000, então lá o número aparece pronto e conta quando o usuário rola até ele; no laudo da aba Recorde conta na abertura da aba.
- Com `prefers-reduced-motion`, FLIP e contagem **não acontecem**: o conteúdo troca direto no valor final.
- Descartado sem uso: `requestAnimationFrame` permanente (só o `rAF` limitado da contagem, ~700ms, e o que o navegador usa), `will-change` fixo, listener de scroll.
