# Especificação de movimento — HypeFC (obrigatória para as três direções)

Vale para `001-almanaque`, `002-mesa` e `003-ficha`. Não invente além disto.

## Princípio

Movimento só existe para **comunicar estado**: chegada de dado, mudança, seleção, ao vivo.
Nada de decoração de entrada, parallax, bounce, confete ou gradiente animado. Se a animação
não carrega informação, ela não entra.

## Tokens (definir no `:root` e usar sempre por token)

```css
--m-fast:120ms;   /* feedback de mouse/tato */
--m-base:200ms;   /* transição de estado */
--m-slow:320ms;   /* movimento maior, raro */
--m-count:700ms;  /* contagem do número do registro */
--m-out:cubic-bezier(.16,1,.3,1);      /* entrando */
--m-in:cubic-bezier(.55,0,1,.45);      /* saindo */
--m-inout:cubic-bezier(.65,0,.35,1);   /* movendo entre dois pontos */
```

## Regras duras

1. Animar **somente** `transform`, `opacity` e `background-color` (estado). Proibido animar
   `width`, `height`, `top`, `left`, `margin`, `padding`, `border-radius` ou `filter:blur`.
2. **Nenhuma animação infinita** — a única exceção é o pulso do item 3, que é limitado.
3. Indicador "atualizado às HH:MM": o ponto pulsa **3 vezes** na carga (2s por ciclo) e depois
   fica estático; volta a pulsar no `hover`/`focus` do bloco. Motivo: WCAG 2.2.2 exige controle
   para movimento automático com mais de 5s de duração.
4. `@media (prefers-reduced-motion: reduce)`: todas as durações viram `0.01ms`, e pulso, contagem
   e scramble não acontecem — o valor final aparece direto. **Nenhuma informação pode depender de
   movimento para aparecer.**
5. Uma animação por elemento; stagger máximo de 40ms entre itens da mesma lista.

## O que precisa existir (nesta ordem de importância)

**A. Entrada da página** (uma vez, no primeiro paint): hero, faixa de KPIs, abas e primeira lista
entram com `opacity 0→1` + `translateY(8px)→0`, em `--m-base`, stagger de 40ms por bloco,
`animation-fill-mode:both`. Não repetir a cada scroll.

**B. Troca de aba**: o painel novo entra com `opacity` + `translateY(6px)→0` em `--m-base`; o
painel antigo sai **sem** animação (não pode atrasar a leitura). A aba clicada tem feedback de
pressão imediato (`scale .98` em `--m-fast`).

**C. Filtro de liga (FLIP de verdade)**: ao filtrar, as linhas que permanecem se movem para a nova
posição por `transform` (medir o rect antes e depois, aplicar o delta invertido e animar até zero)
em `--m-base`; as que saem fazem `opacity→0` em `--m-fast`. Sem isso o conteúdo "salta" — o salto
é exatamente o defeito que este item corrige.

**D. Barra de probabilidade**: na primeira vez que a linha aparece, os três segmentos crescem de
`transform:scaleX(0)` para `1` (com `transform-origin` à esquerda) em 400ms, stagger de 60ms entre
segmentos. Só no primeiro paint da lista; não repetir em hover.

**E. Número do registro público**: ao entrar em tela pela primeira vez, conta de 0 até o valor final
em `--m-count` com `--m-out`, formatado em pt-BR (`Intl.NumberFormat('pt-BR')`). Roda **uma vez**.

**F. Hover/focus**: manter o que já existe e garantir que `focus-visible` tenha a mesma resposta
visual do hover (hoje pode estar sem estilo próprio).

## Proibido

Biblioteca externa (nada de GSAP, Motion, anime.js), `requestAnimationFrame` rodando permanente,
scroll listener fazendo trabalho pesado, `will-change` fixo (só durante a animação).

## Verificação obrigatória (medida, não olhômetro)

Use `browser_exec` em **sessão nomeada só sua** (`mov-001`, `mov-002`, `mov-003`) e dê `reload`
depois de cada `Emulation.setDeviceMetricsOverride` (a media query não reavalia sozinha).

1. `document.getAnimations().length` ~1s depois da carga e de novo 12s depois: **o segundo tem de
   ser 0** (prova de que nada ficou em loop).
2. Com `Emulation.setEmulatedMedia` `features:[{name:'prefers-reduced-motion',value:'reduce'}]`:
   recarregar e confirmar que (a) nenhuma animação com duração > 0.05s existe, (b) o valor final do
   registro aparece imediatamente, (c) as linhas continuam visíveis (nada invisível).
3. Propriedades animadas: percorrer `document.getAnimations()` e listar o conjunto — só pode conter
   `transform`, `opacity` e `background-color` (e `color` em transição de estado). Reportar a lista.
4. `performance.getEntriesByType('layout-shift')` somando `value` → **0**.
5. FLIP: filtrar por uma liga e confirmar por medição que as linhas remanescentes chegaram à posição
   final correta e que a contagem de visíveis mudou.
6. Estouro horizontal (`scrollWidth - innerWidth`) = 0 em **1440x1000** e **390x844**.
7. Print final dos dois tamanhos + um da aba Recorde, salvos na pasta do sketch, e leitura visual
   com `vision_analyze` (texto sobreposto, elemento sem estilo, fonte que não carregou).

## Entregáveis

- `index.html` atualizado.
- `MOTION.md` na pasta do sketch: o que foi implementado, os tokens, **os números medidos** nos 7
  itens acima e o que ficou de fora conscientemente.
- Prints finais.
