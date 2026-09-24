# Direção 002 — MESA (instrumento, não pôster)

Mockup descartável para o HypeFC. Todos os textos e números vêm de `../dados-reais.json` (rodada 20/09/2026) — nenhum valor inventado, nenhum lorem ipsum.

Arquivos: `index.html` (arquivo único, CSS inline, Inter Tight + JetBrains Mono via Google Fonts, sem build) e os prints de verificação `print-1440-final.png` (aba Rodada), `print-1440-recorde-final.png` (aba Recorde) e `print-390-final.png` (mobile).

> **Nota de execução:** este sketch foi entregue primeiro como uma folha clara com Fraunces (uma segunda versão da direção *Almanaque*, não da *Mesa*). A pele foi refeita por dentro para o grafite instrumento especificado — os tokens, as fontes, as bordas estruturais (que viraram hairline) e a marca gráfica (que era desenhada em cor fixa e sumia no escuro). A estrutura densa de linhas/colunas entregue pelo primeiro passe foi mantida.

## Design stance

A tela é uma **mesa de leitura de números**: o visitante senta diante de um instrumento, não de um álbum de cartões. Grafite quase preto, hairline de 1px como única separação, monoespaçada nos dados e **zero canto arredondado, zero sombra, zero gradiente**. Se um elemento parece um card flutuante, ele está errado.

## Key choices

**Cor com significado fixo (a decisão central)**
- `--sinal` `#E8FF59` — reservado a **três coisas e nada mais**: o número do registro público (`.lnum`), o botão de assinar, e a palavra `registro` na manchete. Se aparecer em outro lugar, deixa de significar.
- `--verde` `#7BE495` — reservado a **um só significado**: dado do modelo (a maior probabilidade da linha e a barra do acerto no livro-razão). Medido depois da correção: 20 usos em 10 linhas = exatamente a probabilidade máxima de cada linha (número + segmento da barra). Nenhum uso em navegação, preço, selo ou marca.
- `--carimbo` `#FF6B6B` — só erro/destaque negativo.
- **Seleção e hover são neutros** (painel elevado `#1A212A` + hairline `--line` `#2A323C`), nunca cor de acento. A primeira versão usava verde para aba ativa, hover de linha, seta e selo — cinco significados na mesma cor; foi corrigido item por item.

**Paleta e tipografia**
- Fundo `#0B0E11`, painel `#12161B`, hairline `#1F262E`, tinta `#E6EAF0`, tinta secundária `#A7B2C0`, fraco `#77828F`.
- Duas famílias, papéis separados: **JetBrains Mono** em tudo que é número, rótulo e unidade (com `tabular-nums`), **Inter Tight** no texto corrido. Zero Geist, zero serifada, zero fonte genérica do Next.
- Malha de 26px em opacidade 2,2% no fundo — papel milimetrado de instrumento, não textura decorativa.

**Marca**
- Marca gráfica: grade 3×3 com a célula superior esquerda preenchida na cor de sinal, desenhada em `currentColor` (antes era cor fixa e desaparecia no grafite).
- O ícone de chama do produto atual e o círculo/escudo de clube ficam de fora de propósito.

**Layout**
- A aba *Rodada* é uma mesa: cabeçalho de colunas nomeando cada campo, grupos por liga com contagem, e cada partida em linha de altura uniforme com times, probabilidade em três valores (casa · empate · fora) e barra de três segmentos separados por 2px.
- Aba *Recorde* em folha larga: o acerto medido lidera em numeral grande e o lift vira nota, não manchete.
- 1440: duas colunas com régua vertical. 390: **composição própria** — KPIs viram livro-razão vertical com pontos de ligação, abas viram bloco-índice, cada partida vira ficha empilhada.

**Interação**
- Cinco abas que trocam painel de verdade; filtros de liga mudam a contagem de linhas (10 → 5 → 3 → 2 → 0 com estado vazio explícito → 10); preço alterna mensal/anual; hover em abas, chips, linhas e botões.

## Medições (não é opinião)

Método: `document.querySelectorAll('*')`, contraste contra o **fundo real composto** de cada elemento (o alfa de cada camada até o canvas — sem isso, os cards `bg-white/5` do produto atual são lidos como branco puro e a medição mente), alvo de toque por `getBoundingClientRect`, estouro por `scrollWidth`.

| Medida | 1440 | 390 |
|---|---|---|
| Texto abaixo de AA | **0 de 221** | **0 de 216** |
| Estouro horizontal | 0 | 0 |
| Alvos de toque abaixo de 44px | 19 de 19 (mouse) | **1 de 19** |

Os 19 alvos pequenos no desktop são os chips de liga e os botões de compartilhar, dimensionados para ponteiro — no celular foram elevados a 44px e sobrou 1.

## Trade-offs

**Strong at**
- Autoridade de instrumento: número medido lê como prova, não como marketing. É a direção que mais se afasta do clichê "app de aposta" (nada de laranja, nada de brilho, nada de card).
- Comparação de dado em volume: 10 partidas em colunas alinhadas se leem de relance.
- Densidade de informação por tela — é a única das três direções em que o painel inteiro (rodada + registro + alerta) cabe acima da dobra.

**Weak at**
- Frieza: não é convidativa para quem chega por hype de jogo ao vivo, e não tem lugar natural para o ao vivo (gol, minuto, momentum).
- Depende de disciplina: é a direção que mais se degrada se alguém usar a cor de acento "só para dar uma destacada".
- Texto pequeno por decisão (10–12px) — precisa de monitor decente no desktop.

## Observações de dado (não corrigidas de propósito — vêm do JSON e do app)

- Separador decimal misto na origem: `53.6%`, `37.0%`, `2.8` com ponto e `0,629`, `46,5%` com vírgula, na mesma tela. Num produto brasileiro isso é defeito de formatação, não estilo — corrigir na implementação.
- `EM ALTA 86` é número **sem unidade, sem janela e sem delta**. Ou ganha definição (índice, período, variação), ou sai.
- `36` aparece cinco vezes na mesma tela (JOGOS 36, ENCERRADOS 36, "Rodada 36 jogos", chip "Todas 36", "36 jogos em 9 ligas") — número repetido achata a escala.
- Vocabulário que pede definição: `fichas`, `folha`, `cards liquidados`, `reconstruídos`, `corte 44`.

## Best for

Quem assina pelo **registro** e quer conferir o modelo com o rigor de quem lê uma planilha: comparação rápida entre partidas, histórico do que era previsto, e nenhuma promessa. É a direção que sustenta "o palpite não está à venda" sem precisar escrever isso.
