# DESIGN.md — Fundação visual do HypeFC

Contrato de design do painel. Vale para **todo** arquivo em `src/`.
Regra de ouro: isto é **apresentação**. Nenhum texto, número, promessa, prop, nome
de export ou contrato de dados muda por causa deste documento.

O produto é honesto por princípio: não é casa de aposta, não dá palpite, não
promete resultado. A interface não pode sugerir o contrário — nem por cor, nem
por tamanho de fonte, nem por hierarquia.

---

## 1. Baseline medido (antes desta entrega)

Medido no DOM do site em produção (`https://hypefc.je4ndev.com/`), não é opinião:

| Problema | Medida |
| --- | --- |
| Escala tipográfica | 14 tamanhos distintos; 392 de 451 textos abaixo de 12px (8/9/10px dominam) |
| Contraste WCAG AA | 96 violações. Piores: 1.38 numa divisória, 1.86 nos separadores `·`, 1.95 no disclaimer legal, 2.20 no badge `FIM`, 2.66 no texto de atualização e no título |
| Alvos de toque | 24 abaixo de 44px no desktop; 19 no mobile (chips de liga com 23–24px) |
| Semântica | `h1=1`, `h2=0`, `h3=0` — tudo em `div` |
| PT-BR | acentuação misturada: `Última rodada` convive com `Classificacao`, `MEDIA` |

Causa dominante das violações: `text-slate-500/600` e `rgb(71,85,105)` sobre fundo
escuro. Medido neste projeto: `slate-600` = **2,66:1** e `slate-700` = **1,95:1**
contra `#020617` — ambos reprovam em AA para texto.

## 2. Escala tipográfica — piso absoluto 11px

Nada abaixo de 11px. Não existe "metadata técnica" que justifique escrever 8/9/10px:
se o usuário precisa ler, precisa enxergar. São **8 degraus**, e só esses:

| px | Papel | Classes |
| --- | --- | --- |
| 11 | label técnico (uppercase, `tracking-wider`) | `text-[11px] font-medium uppercase tracking-wider` · `.hype-label` |
| 12 | secundário | `text-xs` · `.hype-meta` |
| 13 | UI padrão (botão, aba, chip, input) | `text-[13px]` · `.hype-ui` |
| 14 | corpo | `text-sm` · `.hype-body` |
| 16 | destaque | `text-base` · `.hype-emphasis` |
| 20 | título de seção | `text-xl font-semibold tracking-tight` · `.hype-section` |
| 28 | KPI | `text-[28px] font-bold leading-none tabular-nums` · `.hype-kpi` |

Nunca: `text-[8px]`, `text-[9px]`, `text-[10px]`, `text-lg` (18px). Se o número é o
herói do card, ele é 28. Se é rótulo, é 11.

## 3. Cor e contraste

Regras:

- **Secundário mínimo `text-slate-400`.** Corpo `text-slate-300`. Títulos `text-slate-100`
  ou `text-white`. Labels `text-slate-400`.
- **Nunca `text-slate-500/600/700` em texto que o usuário lê.** Bordas, divisórias e
  ícones decorativos podem continuar sutis — desde que o elemento seja decorativo
  (`aria-hidden`) e não seja o único portador da informação.
- Todo texto ≥ **4.5:1** sobre o fundo efetivo (o fundo *composto*, não o token).

Contraste medido contra `bg-slate-950` (`#020617`), com os fundos compostos de card
(`white/[0.02]` → `#070b1c`) e hover (`white/[0.04]` → `#0c1020`):

| Cor | vs base | vs card | veredito |
| --- | --- | --- | --- |
| `slate-400` `#94a3b8` | 7,87 | 7,63 | ✅ secundário |
| `slate-300` `#cbd5e1` | 13,59 | 13,17 | ✅ corpo |
| `slate-200` `#e2e8f0` | 16,36 | 15,87 | ✅ |
| `slate-100` `#f1f5f9` | 18,41 | 17,85 | ✅ título |
| `white` | 20,17 | 19,56 | ✅ KPI |
| `emerald-400` `#34d399` | 10,49 | 10,17 | ✅ estado ao vivo |
| `emerald-300` `#6ee7b7` | 13,23 | 12,83 | ✅ badge |
| `orange-400` `#fb923c` | 8,91 | 8,64 | ✅ acento / foco |
| `red-400` `#f87171` | 7,29 | 7,07 | ✅ |
| `violet-400` `#a78bfa` | 7,41 | 7,19 | ✅ |
| `blue-400` `#60a5fa` | 7,93 | 7,69 | ✅ |
| `slate-500` `#64748b` | **4,24** | **4,11** | ❌ texto (limítrofe, reprova no card) |
| `slate-600` `#475569` | **2,66** | **2,58** | ❌ |
| `slate-700` `#334155` | **1,95** | — | ❌ decorativo apenas |
| `slate-800` `#1e293b` | **1,38** | — | ❌ borda/divisória, nunca texto |

Divisórias: em vez de um caractere `|` em `slate-700/800` (texto com 1,4–2,0:1),
usar um elemento `aria-hidden` — `<span aria-hidden className="h-3 w-px bg-white/15" />`.

## 4. Toque

- Todo alvo interativo com **≥44px de altura no mobile** e **≥32px no desktop**.
- Altura vem de **padding/min-height**, nunca de aumentar a fonte.
- Padrão: `min-h-[44px] ... sm:min-h-[36px]` (ou `.hype-target`).
- Ícone-só (com rótulo escondido em telas pequenas) precisa ser quadrado: `h-11 w-11`
  com `aria-label`.

## 5. Espaço

- `gap`/`padding` em **múltiplos de 4**: 8, 12, 16, 24, 32 (`gap-2`, `p-3`, `p-4`, `gap-4`, `gap-6`).
- Cards de conteúdo: `p-3.5` ou `p-4`. Cards compactos da faixa de KPI: `p-3`.
- Views/seções: `gap-4` ou `gap-6`, com separação visível (`border-t border-white/[0.06]`).

## 6. Raios

- **Cards: `rounded-xl`** (12px).
- **Chips, botões, inputs: `rounded-lg`** (8px na escala Tailwind padrão).
- Nota honesta do token: neste projeto `borderRadius.lg` está apontado para
  `--radius` (`0.75rem`) em `tailwind.config.ts`, então `rounded-lg` renderiza **12px**
  e `rounded-lg` fica igual a `rounded-xl`. Alinhar (8px) exige mexer em
  `tailwind.config.ts`, que está **fora do escopo desta entrega** — o arquivo é
  compartilhado e não pertence a este lote de trabalho. No projeto, `rounded-sm`
  (= 8px) é o único valor exato de 8px hoje. Ver "não verificado" no fim.

## 7. Estados

Todo elemento interativo define os cinco estados, sem exceção:

| Estado | Implementação |
| --- | --- |
| hover | `hover:bg-white/10 hover:text-white` (muda cor/fundo, nunca só o cursor) |
| focus-visible | `focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60` |
| active | `active:bg-white/[0.14]` |
| disabled | `disabled:cursor-not-allowed disabled:opacity-50` |
| selected | borda **e** fundo: `border-orange-400/40 bg-orange-500/10 text-white` |

Foco: o painel tem **um** indicador, laranja (`orange-400/60`), o mesmo em tudo.
`globals.css` traz um `:focus-visible` global em `@layer base` como rede de segurança
para elementos que não declarem foco próprio; quem declara `focus:outline-none` +
`ring` mantém o seu.

## 8. Motion

- Transições de **150ms** (padrão do `transition` do Tailwind) e só em
  cor/fundo/transform. Nada de animação decorativa contínua fora de um indicador real
  de estado (ex.: `animate-pulse` no selo "ao vivo").
- `prefers-reduced-motion: reduce` é respeitado globalmente em `globals.css`
  (animações e transições reduzidas a ~0).

## 9. Semântica e acessibilidade

- Títulos de seção são `h1/h2/h3` de verdade, nunca `div` estilizada. `h1` do produto
  é único (cabeçalho: HypeFC). Faixa de KPI declara `h2` visível-para-leitor-de-tela
  (`sr-only`) — a faixa tem nome, o layout não ganha ruído.
- Abas: `role="tablist"` + `role="tab"` + `aria-selected`, `aria-current` na ativa,
  roving `tabIndex` e navegação por `←/→/Home/End`.
- Ícones decorativos: `aria-hidden="true"`.
- Região que atualiza sozinha (texto de última atualização): `aria-live="polite"`.
- Contagem/valor anunciado por leitor de tela junto do rótulo visível (ex.: `12 jogos`).
- Botão com rótulo visível escondido no mobile mantém o `aria-label` contendo o texto
  visível (WCAG 2.5.3).

## 10. PT-BR

Acentuação padrão em **todo** texto visível (título de aba, `<title>`, descrição,
rótulos, avisos): `Classificação`, `Média/jogo`, `públicos`, `última`, `probabilidade`.
Sem misturar com o texto sem acento. Nomes de arquivo, props e chaves de dados não
mudam por causa disso.

## 11. Como a escala é expressa no código

A escala é escrita com as **classes cruas do Tailwind** da tabela da seção 2 — não
existe camada de atalhos (`@layer components`) neste projeto. Motivo verificado: o
Tailwind remove toda classe de `components` que não encontra no conteúdo, então um
atalho tipo `.hype-label` que ninguém usasse sairia purgado do CSS, aplicaria estilo
nenhum e quebraria a escala em silêncio. Definir atalho exige usá-lo em todos os
lugares ou colocá-lo em `tailwind.config.ts` (fora do escopo desta entrega).

Padrões de composição que se repetem (copiar, não abstrair):

- card: `rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5`
- chip/botão/input: `rounded-lg border border-white/10 bg-white/5 text-slate-300`
- alvo interativo: `min-h-[44px] sm:min-h-[36px]`
- foco: `focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60`
- divisória: `<span aria-hidden="true" className="h-3 w-px bg-white/15" />`

## 12. Fronteiras de escrita (1 escritor por arquivo)

| Arquivo | Dono |
| --- | --- |
| `DESIGN.md`, `src/app/globals.css`, `src/app/layout.tsx`, `ViewTabs.tsx`, `DashboardHeader.tsx`, `StatsBar.tsx`, `DashboardFooter.tsx` | fundação visual / shell |
| `RoundView`, `TodayMatches`, `LeagueTabs` | agente 2 |
| `MatchDetailPanel`, `MatchProbability`, `LeagueStandings`, `ProView` | agente 3 |

Proibido neste lote: `npm install`, qualquer build (`build:pages`, `deploy:*`),
`git commit/push`, e tocar em `scripts/`, `supabase/`, `public/data/`, `package.json`
ou lógica de dados.

## 13. O que este documento **não** garante

- Verificação visual (render real, mobile, claro/escuro) é responsabilidade do
  orquestrador — não foi feita aqui.
- O alinhamento de raio de 8px depende de `tailwind.config.ts` (fora do escopo).
- A escala é imposta por convenção e revisão em cada arquivo; não há lint de
  tamanho de fonte que a obrigue automaticamente.
