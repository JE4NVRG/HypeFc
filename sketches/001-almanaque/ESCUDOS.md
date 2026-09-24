# Escudo — direção 001 (Almanaque)

Escudo real dos 31 times dos 10 jogos, aplicado sobre `CREST-SPEC.md`. Tudo em `index.html`
(arquivo único). Números abaixo são **medidos no navegador** (sessão `browser_exec` `crest-001`,
Chrome via CDP), não estimados.

## O que entrou

- **Fonte:** as 31 URLs de `../escudos.json` (todas já validadas como `HTTP 200 + image/png`),
  literalmente — nenhuma inventada, nenhum host fora de `espncdn.com` (o que o `isAllowedCrest()`
  do produto aceita). Time sem entrada no mapa cai no fallback.
- **`<img>` comum, nunca `next/image`**, com `width`/`height` explícitos (22 na lista, 18 em "em alta")
  e `alt="Escudo do <time>"`. Nome do time continua texto ao lado: o escudo nunca identifica sozinho.
- **Prato branco `#FFFFFF` com régua `#D9D3C7` de 1px**, padding interno de 2px, `object-fit:contain`,
  raio 0, zero sombra, sem filtro, sem moldura de acento. `22px` é o **desenho** do escudo
  (`box-sizing:content-box`); o prato soma 2px + 1px de cada lado → 28px na lista, 26px no celular
  (20px de desenho) e 24px em "em alta" (18px de desenho).
- **Alinhamento por linha de base**, não por centro: `vertical-align:baseline` no `<img>` (baseline de
  elemento substituído = borda inferior da caixa). Medido: **delta 0,00px** entre a base do prato e a
  linha de base do nome, nas três famílias de superfície.
- **Fallback** (imagem que falha ou time fora do mapa): caixa de régua do mesmo tamanho com a inicial
  do time (`role="img"`, `aria-label="Escudo do <time>"`), via listener de captura de `error`.
- **Sem `loading="lazy"`:** a lista já está na primeira tela e os escudos da aba Liga precisam carregar
  mesmo com o painel oculto (`display:none` + lazy = não carrega, e a verificação de `naturalWidth`
  acusaria). Medido: **32/32 carregados com a aba Liga fechada**.

## Medições

| verificação | 1440×1000 | 390×844 |
|---|---|---|
| `<img>` de escudo no DOM (lista + "em alta") | 32 — **20 na lista de partidas** (2 × 10 linhas) + 12 em "em alta" | 32 — 20 + 12 |
| `naturalWidth === 0` (URL errada / host bloqueado) | **0** | **0** |
| `naturalWidth` das que carregaram | 500×500 (todas) | 500×500 (todas) |
| host de origem | `a.espncdn.com` (único) | idem |
| `alt` presente / exato (`Escudo do <time>`) | 32 / 32 · 0 erros | 32 / 32 · 0 erros |
| tamanho do desenho / do prato | 22px → 28×28 ; 18px → 24×24 | 20px → 26×26 ; 18px → 24×24 |
| régua / prato / raio / sombra / filtro | `1px rgb(217,211,199)` · `rgb(255,255,255)` · `0px` · `none` · `none` | idem |
| delta linha de base (prato × nome) | **0,00px** | **0,00px** |
| nomes de time vazios (escudo como único id) | **0** | **0** |
| CLS (`performance.getEntriesByType('layout-shift')`) | **0** (0 entradas, em ~2s e ~13s) | **0** (0 entradas, em ~2s e ~12,5s) |
| `document.getAnimations().length` a ~12s da carga | **0** (em t≈13s) | **0** (em t≈12,5s) |
| estouro horizontal (`scrollWidth - innerWidth`) | **0** (doc e body; 0 elementos fora da viewport) | **0** |
| varredura de contraste | **272 avaliados · 0 reprovados** | **270 avaliados · 0 reprovados** |
| aba Liga (painel visível) | 12/12 linhas de "em alta" com escudo, **99 avaliados · 0 reprovados**, estouro 0 | — |

**Movimento reduzido** (`Emulation.setEmulatedMedia: prefers-reduced-motion=reduce` + reload):
472 elementos visíveis varridos, maior `animation-duration` = **0**, maior `transition-duration` =
**0,00001s**, **0** acima de 50ms, **0** com `opacidade 0`, `getAnimations()` = **0**,
`transition-property` da ficha = `none`, `#reg-cards` = **`1.402`** já no primeiro paint, **32 escudos**
carregados (0 quebrados, 20 com caixa > 0), 30/30 barras com largura > 0, CLS **0**, estouro **0**.
Clique na ficha sob `reduce`: `getAnimations()` continua **0**, 3 linhas, nenhuma classe de movimento
aplicada, CLS **0**.

**FLIP do filtro de liga continua íntegro com os escudos** (`Todas` → `Ligue 1`): 10 → 3 linhas;
no 1º frame as 3 linhas ainda estão nos topos antigos e chegam por `transform`; animações no clique
`CSSTransition:120` (saída) + `mBar:400` (barras das linhas novas); posição final
**946,27 / 1069,82 / 1194,37** — idêntica ao baseline medido sem FLIP (`paint(false)`, delta **0,00px**);
0 fantasmas no fim; escudos dos nós reaproveitados seguem com `naturalWidth` 500 (nenhum re-request).

**Fallback (provado por chamada direta, `__almanaque.caiNoFallback`):** o `<img>` do Grêmio virou
`<span class="crest crest-fb">` com `G`, `role="img"`, `aria-label="Escudo do Grêmio"`, caixa
**28×28** com a mesma régua `#D9D3C7`, **0** imagens quebradas no pai, nome "Grêmio" preservado ao lado,
CLS **0** depois da troca.

## Prints

`print-escudos-1440.png` (página inteira 1440×2408) · `print-escudos-1440-lista.png` (recorte da lista)
· `print-escudos-1440-em-alta.png` (recorte de "em alta") · `print-escudos-390.png` (página inteira
390×5402) · `print-escudos-390-lista.png` (recorte da lista, 2×).

Leitura visual (`vision_analyze`) nos recortes: escudo legível no prato, alinhado à base do nome,
nome sempre ao lado, **nenhum escudo cortado/torto/desalinhado ou sobreposto**, nenhum escudo maior que
o nome, nenhuma linha quebrada (inclusive "Red Bull Bragantino" e "Vitória de Guimaraes"), nada fora da
margem em 390.

## Decisões e desvios (ditos, não escondidos)

- **Papel medido é `#F4F0E6`** (arquivo e `README.md` desta direção), enquanto `CREST-SPEC.md` §Tratamento
  cita `#F6F3EC` para 001. Não mexi na paleta da direção — só o prato/régua do escudo seguem a spec
  (`#FFFFFF` / `#D9D3C7`), e o contraste foi remedido com a cor real de fundo (0 reprovados).
- **`22px` é o desenho do escudo, não o prato:** o prato é a moldura neutra que a spec pede (padding 2px
  + régua 1px), então a caixa final é 28px em 1440 e 26px no celular. Se a leitura desejada for
  "22px de caixa total", o ajuste é `--crest:16px` (e 14px no celular) — uma linha.
- **"Tabela-razão" da spec:** nesta direção a razão é a própria lista de partidas, e ali o nome ficou nos
  22px serifados já medidos nesta direção (a instrução de tamanho é a da "linha de partida"), não em
  versalete pequeno. Onde há coluna de time com nome pequeno (aba Liga) o escudo entrou à esquerda do
  nome, em 18px, alinhado à esquerda — o versalete pequeno dessa leitura é o índice de ligas (12px caixa
  alta) e a lista "em alta" (16px).
- **Sem transformar o escudo em protagonista:** mesmo tamanho de desenho do nome nunca é maior que ele;
  nenhum realce, nenhum acento, nenhuma sombra. A cor da tela continua sendo só o escudo.
