# Especificação de escudo — HypeFC (obrigatória para 001 e 002)

Escudo de time é requisito de produto (o painel já mostra escudo hoje). Esta espec existe para
que ele entre nos mockups sem quebrar a disciplina de cor de cada direção — escudo é imagem
colorida de terceiro, e ela briga com uma paleta de acento único se não for tratada.

## Fonte dos dados

`sketches/escudos.json` — 31 times dos 10 jogos do mockup, com URL real e validada
(`curl` retornou **HTTP 200 + `image/png`** em todos). O padrão é
`https://a.espncdn.com/i/teamlogos/soccer/500/<id>.png`.

- Origem: coletado do **próprio painel em produção** (aba Liga, trocando de competição), que
  resolve escudo via ESPN.
- **Host liberado:** o produto tem `isAllowedCrest()` em `src/components/dashboard/HypeFlags.tsx`
  e só aceita `espncdn.com` e `football-data.org`. Não use host fora dessa lista — nem nos
  mockups, senão o mockup promete o que o produto recusa.
- Não inventar URL nem desenhar escudo à mão. Time sem escudo no JSON → cai no fallback.

## Regras de renderização

1. **`<img>` comum, nunca `next/image`.** O produto documenta (em 4 componentes) que o lazy do
   `next/image` não dispara dentro do cockpit e o escudo nunca aparece. O mockup segue o produto.
2. **Sempre com `width` e `height` explícitos** (evita CLS) e `loading="lazy"` só onde o produto usa.
3. **`alt` descritivo:** `alt="Escudo do <time>"`. O nome do time é sempre texto ao lado —
   o escudo **nunca** é o único identificador do time (a11y e leitura em 11px de tela).
4. **Fallback obrigatório:** se faltar escudo, renderiza um quadrado/retângulo de régua fina com a
   inicial do time (mesmo tamanho do escudo). Nunca imagem quebrada, nunca espaço vazio.
5. **Prato neutro atrás do escudo.** Escudo de fundo claro (Real Madrid, Juventus, etc.) some no
   papel claro; escudo escuro some no grafite. Todo escudo fica sobre um prato com régua de 1px —
   papel: prato branco; grafite: prato `#12161B`. Padding interno de 2px, `object-fit: contain`.
   Sem exceção: exceção é onde a imagem some em produção e ninguém percebe no mockup.
6. **Tamanhos** (medidos no painel atual como referência): linha de partida **22px**;
   tabela de classificação **20px**; lista "em alta" **18px**; selo/registro **16px**.
   No celular, linha de partida **20px**.

## Tratamento por direção (o que cada uma faz com a cor)

**001 Almanaque (papel `#F6F3EC`)**
- Escudo é a única cor da tela. Nada de aumentar o escudo para ele virar protagonista: ele
  identifica, quem informa é o número.
- Prato branco com régua `#D9D3C7` de 1px, alinhado à linha de base do nome do time.
- Na tabela-razão o escudo entra na primeira coluna, alinhado à esquerda, e o nome do time fica
  em versalete pequeno ao lado — sem negrito concorrente.

**002 Mesa (grafite `#0B0E11`)**
- Prato `#12161B` com hairline `#1F262E` de 1px. Sem brilho, sem sombra, raio 0.
- O escudo é a **única** imagem colorida da tela: por isso ele **não** pode ganhar moldura de acento
  nem `filter`. O acento ácido continua reservado a registro/CTA/palavra "registro".
- Alinhamento: o escudo fica na coluna do time, colado ao nome com 8px, e a coluna do placar não
  muda de largura por causa dele (a grade já existe e é medida).

## Nota legal (dita em voz alta, não escondida)

Escudo de clube é marca registrada do clube. O produto já hotlinka o CDN da ESPN para identificar
os times em contexto informativo (uso nominativo: dizer *qual* time é). O que **não** se faz:
usar escudo como parte da marca do HypeFC, em material promocional que sugira vínculo, endosso
ou patrocínio, ou como elemento de venda do plano Pro. Se isso for virar peça de marketing,
o caminho é substituir por um identificador próprio (iniciais + cor do time), não pelo escudo.

## Verificação obrigatória (medida)

1. Contar `<img>` de escudo na lista de partidas: **2 por linha** × 10 linhas = 20 na home.
2. Confirmar que **todas** carregaram: nenhum `naturalWidth === 0` (isso pega URL errada e host bloqueado).
3. `alt` presente em todas as imagens.
4. Estouro horizontal = 0 em 1440 e 390 (escudo é quadrado rígido e é o candidato natural a estourar grade).
5. CLS = 0 continua depois de entrar imagem (medir `performance.getEntriesByType('layout-shift')`).
6. Varredura de contraste continua com **0 reprovados** (o prato não pode criar texto ilegível por cima).
7. Print final de 1440 e 390 + leitura visual, com atenção a: escudo ilegível, prato torto na grade,
   escudo maior que o nome do time.
