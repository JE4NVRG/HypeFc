# Identidade 002 "Mesa" no app, contrato de implementação

Direção aprovada pelo Jean em 24/09/2026 (mockup em `sketches/002-mesa/`, movimento em
`sketches/MOTION-SPEC.md`, escudo em `sketches/CREST-SPEC.md`). Este arquivo é o contrato
para quem mexe no app: se o código divergir daqui, o código está errado.

## Vocabulário (já em `tailwind.config.ts` e `globals.css`)

| token | valor | papel |
|---|---|---|
| `paper` | `#0B0E11` | fundo da mesa |
| `paper-2` | `#12161B` | painel |
| `paper-3` | `#1A212A` | painel elevado, linha sob o mouse |
| `ink` | `#E6EAF0` | texto principal |
| `ink-2` | `#A7B2C0` | texto secundário |
| `ink-3` | `#8C96A2` | rótulo técnico (4,9:1 sobre `paper-3`, medido) |
| `rule` | `#1F262E` | régua de 1px |
| `line` | `#2A323C` | régua estrutural |
| `verde` | `#7BE495` | **só** dado do modelo |
| `sinal` | `#E8FF59` | **só** registro, número do recorde e CTA primário |
| `carimbo` | `#FF6B6B` | erro, aviso, atenção |

Raio: **0 em toda a escala** (a escala do Tailwind já resolve isso). Não existe mais
`rounded-*` com efeito. Sombra: nenhuma. Elevação é régua de 1px, não sombra.

## Regra de cor (a parte que exige julgamento)

A direção tem **um** acento e **uma** cor de dado. Trocar isso por "colorir por categoria"
é o que fazia o painel parecer admin genérico. Então:

1. **`sinal` (ácido) em no máximo 3 lugares em toda a tela visível**: a palavra "registro",
   o número do recorde (`1.402`) e o botão primário de assinatura. Se um quarto aparecer,
   não é acento, é decoração: volta para `ink`/`rule`.
2. **`verde` só onde o número vem do modelo**: maior probabilidade da linha, barra de
   probabilidade e o estado "ao vivo" (que o DESIGN.md já reservava em verde). Verde em
   título, ícone, borda de card ou texto de apoio é ruído: volta para `ink-2`/`ink-3`.
3. **`carimbo` só para erro/aviso de verdade** (falha de dado, fonte fora, cobrança).
   Não use para "atenção" genérica nem para destacar seção.
4. Todo o resto é neutro: hierarquia por **peso, tamanho e régua**, nunca por cor.
5. Ao remover uma cor, não deixe o elemento sem contraste: o substituto tem de passar AA
   no fundo em que ele vive (`ink` 13,4:1 em `paper-3`, `ink-2` 7,5:1, `ink-3` 4,9:1).

## Tipografia

- Fonte de trabalho: **JetBrains Mono** (corpo, número, rótulo, tabela), com `tabular-nums`.
- **Inter Tight** para título, nome de time e número grande (`h1`, `h2`, `h3`, `.font-disp`).
- Escala: no máximo 6 degraus distintos por tela. Degrau de 0,5px (8,5 / 9,5 / 10,5 / 13,5)
  é ruído: arredonde para o degrau vizinho.
- Rótulo técnico em caixa alta com **um** tracking só.

## Estrutura

- Card com canto arredondado e sombra **não existe** nesta direção: painel é régua de 1px
  sobre `paper-2`. Bloco denso de dado (lista, tabela, ficha) não vira card.
- Barra de 3px na borda esquerda significa **clicável**. Não use em linha que não clica.
- Alvo de toque: mínimo 44x44 no celular, inclusive o botão de compartilhar e os CTAs.
- Escudo: prato com régua de 1px, `<img>` comum, `alt` "Escudo do <time>", fallback pela
  inicial. O nome do time é sempre texto ao lado.

## Movimento

Só `transform` e `opacity`. Nada em loop infinito. `prefers-reduced-motion` zera tudo sem
esconder informação. O pulso do "atualizado" pulsa 3 vezes e para (WCAG 2.2.2).

## Gate (medido, não opinado)

1. Contraste: 0 reprovados nas 5 abas, em 1440 e 390.
2. Estouro horizontal: 0 em 1440 e 390.
3. CLS: 0.
4. Animações ativas depois de ~7s: 0. Com `prefers-reduced-motion`: 0 e nenhuma
   informação escondida.
5. `sinal` em no máximo 3 elementos; `verde` só em dado de modelo/live.
6. Elemento com fundo arredondado: 0. Alvo de toque abaixo de 44px no celular: 0.
7. Escudo: todos carregados (`naturalWidth > 0`), todos com `alt`.
