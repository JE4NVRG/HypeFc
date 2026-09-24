# HypeFC — direção visual **ALMANAQUE**

Esboço descartável da direção "Almanaque" para o HypeFC. Arquivo único, sem build, sem dependência local: abra `index.html` no navegador. Dados 100% vindos de `../dados-reais.json` (nomes, placares, probabilidades, números do registro, preços). Nenhum número inventado, nenhum *lorem ipsum*.

**A tese:** o produto não vende palpite, vende registro medido em público. Então a tela não é um painel de sinais — é um **volume de referência impresso**. Onde o shadcn/Next por padrão entrega cartão arredondado com glow, aqui entrega papel, fio, régua e entrada numerada.

---

## Design stance

Almanaque é o oposto estrutural do app de aposta, não uma repintura dele. A aposta organiza a tela em torno de uma ação urgente (odds, botão, contagem). O almanaque organiza em torno de uma **consulta**: página pautada, seções numeradas (§ I a § V), fichas de índice, notas de margem e o registro público como manchete.

Três decisões carregam o posicionamento:

1. **O registro vem antes de tudo.** A faixa de quatro números — CARDS LIQUIDADOS 1402, ACERTO 53.6%, MÉDIA DO MANDANTE 37.0%, LIFT +16.6pp — fica no cabeçalho, acima das abas. O selo *"Calibrado, sem edge no palpite."* aparece no topo e reaparece dentro da aba Recorde. Quem abre a tela vê a prestação de contas antes de ver um jogo.
2. **A promessa é a manchete, não o rodapé.** `O palpite não está à venda.` está em itálico serifado gigante, ao lado da palavra-marca. É a primeira coisa que o olho lê depois do nome.
3. **Partida não é card, é lançamento de livro-razão.** Cada jogo é uma linha pautada com índice, rubrica de liga, mandante/visitante, e uma coluna de dados à direita (probabilidade + posse/chutes/no alvo). Sem sombra, sem canto arredondado, sem ícone de fogo.

Consequência de tom: nenhuma linguagem de tipster. Nada de "green", "entrada", "banca", "lucro". O texto é o do painel (`avisar`, `registro`, `recorde público`, `calibrado`).

## Key choices

**Layout — página impressa, não dashboard**
- Largura máxima de 1240px com margens generosas e fios horizontais que atravessam a página inteira (não caixas flutuantes). A hierarquia vem de régua e tipografia, não de elevação.
- Papel pautado: fios verticais a cada 76px no fundo (`.05` de opacidade). No mobile o pautado sai — 390px de tela não comporta grade de fundo sem ruído.
- Duas colunas na Rodada: o livro-razão à esquerda, a **margem** à direita com "Selo de registro" (53.6%, 1402, 271, corte 44) e a legenda. O registro fica sempre ao lado do resultado.
- Grades de fio (KPIs, índice de ligas, modelo, cobertura) usam borda nos próprios itens, não `gap` sobre fundo de régua: assim uma última linha incompleta não vira bloco bege nem deixa moldura aberta.
- Mobile recompõe de verdade: marca empilhada, registro 2×2, abas em grade 2×2 com o último item em faixa, KPIs 2×2 com o quinto ocupando a linha, **placar acima dos times** na entrada de partida (leitura de placar primeiro), filtros de liga em 2 colunas, blocos de dados virando listas de uma coluna com os trilhos de barra escondidos.

**Typography — serifada de referência contra monoespaçada de tabela**
- `Instrument Serif` (Google) para display: wordmark, títulos de seção, números grandes (1402, 53.6%, +16.6pp, "Rodada"). É o que dá o ar de impresso sem virar "jornal antigo" genérico.
- `Newsreader` para o texto corrido e para os rótulos em caixa alta espaçada. Times em 22px com o vencedor em peso 600 e uma adaga † de vermelhão.
- `IBM Plex Mono` só para número: placar, probabilidades, KPIs, contadores de linha, preços. Números tabulares, alinhados — a marca visual de tabela publicada.
- Micro-tipografia de 8–10px com `letter-spacing`, como nota de pé de página de almanaque. Só os pesos efetivamente usados são declarados (400/500 para o mono).

**Color — papel, tinta, um vermelhão e um verde que só o dado usa**
- Papel `#F4F0E6`, tinta `#191610`, fio `#CDC4AE`, texto secundário `#5A5343`, terciário `#6E6650` (5,0:1 no papel, para rótulo pequeno seguir legível).
- Vermelhão etimológico `#9B2C15`: ênfase editorial — nota de contexto, adaga do vencedor, filete do selo, estado ativo. Nunca em botão de conversão como cor de ação.
- Verde `#3F5A36` **só** onde a legenda do painel manda: a maior probabilidade. Verde aqui é dado, não sinal de aposta.
- Nenhum gradiente, nenhum glow, nenhum laranja de ação. O antigo `#f97316` sai de cena; no lugar dele, tinta.

**Interaction — índice, não controle**
- Abas são **fichas de índice** com numeral §, não pills. A ativa é preenchida de tinta e inverte o texto; as outras marcam presença com fio. Navegação por setas do teclado também funciona (`role="tablist"`).
- Filtros de liga são fichas com o total de jogos à direita em mono. Ao clicar, a lista de partidas **muda de tamanho de verdade** (10 → 5 → 0 → 2 → 10) e a linha de status anuncia o recorte ("Brasileirão Série A · 5 de 5 jogos desta liga no recorte") e o contador de linhas visíveis.
- Zero resultado não é erro: é um bloco de "Sem entradas" que diz quantos jogos a liga tem na rodada e que nenhum entrou neste recorte — comportamento de almanaque, não de app quebrado.
- Hover é mudança de estado, não brilho: ficha e aba ganham fundo de papel mais escuro, a linha de partida acende um filete de tinta na margem esquerda, e botões-carimbo (`.btn`) invertem para tinta sobre papel. Foco de teclado visível com outline de vermelhão.

## Trade-offs

**Forte em**
- Posicionamento: é impossível confundir com app de aposta. Não há odds, bônus, CTA gritando nem verde de "entrada". A promessa e o registro ocupam o lugar que num concorrente seria do palpite.
- Densidade tipográfica: 36 jogos, 9 ligas, 12 posições de forma e 4 números de registro cabem sem virar sopa, porque fio e régua fazem o trabalho que cards normalmente fazem.
- Honestidade visível: as duas linhas de 46,5% do modelo ficam lado a lado com filete de vermelhão, mostrando que o favorito do modelo e a âncora sem modelo dão a mesma taxa. É o desenho a favor de "não vendo palpite".
- Zero-resultado com dignidade (liga sem jogos no recorte) e recorte explícito ("10 de 36 jogos") — o produto assume o que publica.

**Fraco em**
- Peso de marca no topo: no mobile, marca + manchete + faixa de registro consomem a primeira dobra. A seção Rodada começa por volta de y=614 de 844 — cabe, mas o conteúdo operacional não é a primeira coisa. Em app de uso diário isso custa; em peça de posicionamento, é o preço consciente.
- Sem cor de ação, o caminho de conversão (Pro) é menos urgente na tela. Se a assinatura for o KPI principal, o almanaque é provavelmente o menos "performático" das direções.
- Serifada de alto contraste + micro-rótulos de 8–10px: bonito em DPR alto, mais frágil em tela barata com brilho alto. Exige disciplina de tamanho mínimo.
- Uma tela densa exige que o dado seja bom: se o recorte de jogos publicados for pequeno, o livro-razão fica curto e o selo de registro passa a carregar sozinho o peso.
- Escala para gráfico e placar ao vivo é menos natural que em direção de app: almanaque é melhor em "resumo do volume" do que em "jogo acontecendo agora".

## Best for

- Levar o HypeFC para o lado de **registro editorial**: quem chega pelo recorde público e pela prestação de contas, não pelo palpite.
- Landing/estado de campanha em que a tese "o palpite não está à venda" é o argumento de venda — inclusive como página de **Recorde público** dedicada, onde esta direção rende mais.
- Público que desconfia de tipster e responde a prova de método (Brier, chute uniforme, âncora, corte, empates contados como erro).
- Marca que quer parecer **publicação** (anuário, boletim, registro) e não painel de sinais — útil se o caminho for vender histórico e alerta como produto informativo.

**Onde não usar como está:** tela de acompanhamento ao vivo com push de gol, ou qualquer superfície cujo objetivo principal seja converter assinatura rápido — nessas, a densidade e a ausência de cor de ação trabalham contra.

---

### Notas de verificação
- Prints: `print-1440-rodada.png` (1440×1000), `print-390-rodada.png` (780×1688 = 390 CSS px em DPR 2), `print-1440-completo.png` (1440×2400, página da Rodada inteira).
- Os prints foram capturados com `transition:none` temporário: em aba sem foco o Chrome congela a transição no valor inicial, e o print saía com a aba ativa em cinza em vez de tinta sólida.
- Verificação por medição no navegador (`document.fonts.check` para cada família/peso, varredura de `scrollWidth`/`getBoundingClientRect` em todos os elementos, contagem de linhas antes/depois do clique, `elementFromPoint` para sobreposição, amostragem de pixel do PNG e razão de contraste calculada).
