# Conta, cadastro e página de vendas (24/09/2026)

**Quando:** 24/09/2026 (BRT, UTC-3)
**Alvo:** `https://hypefc.je4ndev.com/` (GitHub Pages, branch `gh-pages`, `npm run deploy:domain`)
**Instrumento:** CDP (Chrome de depuração do Mac, aba dedicada) + `execute_sql`/`apply_migration` no
projeto `sebyzlcgadsiinikxfgu`. Medição por DOM (`getBoundingClientRect`, `getComputedStyle` com
composição de alfa sobre o fundo real, `PerformanceObserver` com `buffered: true` para CLS,
`document.getAnimations`).

Este doc cobre a camada que faltava para o produto ser vendável: página de vendas, entrada, cadastro e
área da conta. O gate de identidade do painel continua em `qa-ui-identidade-002-2026-09-24.md`; aqui só
entram as quatro rotas novas.

## 0. O que passou a existir

| Rota | O que é | Estado |
| --- | --- | --- |
| `/pro` | Página de vendas: promessa, o que o modelo entrega (medido), o que o Pro libera, como funciona, comparativo grátis × Pro, painel público, FAQ, CTA | pública |
| `/entrar` | Entrada: Google (principal) e e-mail com senha (alternativa) | pública |
| `/criar-conta` | Cadastro: Google ou e-mail com senha, com o que a conta gratuita inclui | pública |
| `/conta` | Área da conta: plano, times seguidos, alertas, restaurar acesso, sair | exige sessão para mostrar dados |

Componentes novos: `components/site/PublicShell.tsx` (chrome das páginas públicas), `site/FormularioConta.tsx`
(formulário único de entrada e cadastro), `site/estilos.ts` (botões, caixas e rótulos numa fonte só),
`lib/auth.ts` (cadastro/entrada/reenvio por e-mail). Alterados: `lib/conta.ts` (plano devolvido pelo
servidor), `components/site/SiteFooter.tsx` (rodapé aponta para a conta quando há sessão),
`components/dashboard/ResgatePro.tsx` (rotaciona licença morta ou gratuita de conta com assinatura).

## 1. Quem decide o acesso

O navegador nunca decide: ele guarda o token que a RPC devolve. Toda a decisão vive em
`public.pro_conta_entrar` (SECURITY DEFINER), que lê o e-mail de dentro do JWT.

Mudanças aplicadas no banco nesta rodada:

| Migration | O que faz |
| --- | --- |
| `pro_conta_entrar_acesso_gratuito` | Conta sem assinatura passa a receber licença gratuita (`plan=free`, `status=conta`, `source=conta`) em vez de ficar sem token nenhum |
| `subscribers_status_conta` | `subscribers_status_ck` passou a aceitar `conta` (conta criada no site, distinta de quem entrou na lista) |

Contrato medido chamando a RPC com a chave anônima e o JWT de cada conta (mesmo caminho do site):

| Conta | Resposta da RPC |
| --- | --- |
| Conta sem assinatura (`qa-free-conta@…`) | `ok:true`, `plano:"free"`, `limite:3`, `status:"conta"` |
| Conta com assinatura ativa (`je4ndev@…`) | `ok:true`, `plano:"pro"`, `limite:20`, `paid_until` preenchido |
| Sem sessão | `sem-sessão` no cliente, sem chamada |
| Token inventado | recusado (contrato medido na rodada anterior) |

Consequência de produto: **entrar com Google deixou de ser inútil**. Antes, quem logava ficava sem
acesso e quem tinha entrado na lista tinha mais acesso do que quem tinha conta. Agora a conta sempre
devolve licença: `free` (3 times, sem alerta) ou `pro` (20 times, com alerta e histórico).

Onde a licença é ligada à conta:

- home: `ResgatePro` roda na carga e sincroniza sozinho;
- `/conta`: botão explícito **Restaurar o acesso neste navegador** (a página não rotaciona sozinha para
  não brigar com o `ResgatePro` pela mesma linha do banco, o que derrubaria o token um do outro);
- cadastro/entrada por e-mail: a própria função de autenticação chama a RPC e guarda o token.

`_limite_do` confirma o teto por plano: `pro` + `active` + não vencido → 20; qualquer outro caso → 3.

## 2. Gate medido nas rotas novas

Medido no build local servido em `out/` (mesma árvore que foi publicada), 1440x900 e 390x844.

| Rota | Viewport | Contraste mín. | Falhas AA | Estouro horizontal | Alvos `<44px` | `sinal` | Animações | CLS |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/pro` | 1440 | 6,45:1 | 0 | 0 | 0 | 2 | 0 | 0 |
| `/pro` | 390 | 6,45:1 | 0 | 0 | 0 | 2 | 0 | 0 |
| `/entrar` | 1440 | 6,45:1 | 0 | 0 | 0 | 1 | 0 | 0 |
| `/entrar` | 390 | 6,45:1 | 0 | 0 | 0 | 1 | 0 | 0 |
| `/criar-conta` | 1440 | 6,45:1 | 0 | 0 | 0 | 1 | 0 | 0 |
| `/criar-conta` | 390 | 6,45:1 | 0 | 0 | 0 | 1 | 0 | 0 |
| `/conta` | 1440 | 6,45:1 | 0 | 0 | 0 | 0 | 0 | 0 |
| `/conta` | 390 | 6,45:1 | 0 | 0 | 0 | 0 | 0 | 0 |

Notas de método, porque duas delas mudam a leitura do número:

- **Contraste**: cada elemento é comparado com o fundo real dele (sobe a árvore até um fundo opaco,
  compondo os semitransparentes). Comparar só com o fundo do `body` reprova os botões de `sinal`, que
  são escuros sobre amarelo (17:1), porque o fundo do `body` é escuro. Foi o erro da primeira passada.
- **Alvos `<44px`**: medidos no mobile. No desktop os botões usam o piso de 36px por decisão de design
  (mesma regra do painel), então 1440 aparece com alvos de 36px de propósito. Links dentro de parágrafo
  ficam fora da conta: a WCAG 2.5.8 isenta alvo em linha de texto.
- **CLS**: `PerformanceObserver` de `layout-shift` com `buffered: true`, 2,5 s depois da carga.

O `/conta` tem 0 elementos `sinal` de propósito: quando a pessoa já é Pro não há nada para comprar
naquela tela, e o acento fica reservado para a decisão de compra (que fica em `/pro`).

## 3. Os três estados da conta (verificados no navegador)

| Estado | Conta | Plano mostrado | Times seguidos | Alertas |
| --- | --- | --- | --- | --- |
| Sem sessão | `/conta` mostra "Sem conta conectada" com os atalhos Entrar / Criar conta | — | — | — |
| Conta nova, sem assinatura | `qa-free-conta@je4ndev.com` | etiqueta `Gratuito` + "até 3 times seguidos, sem alerta" | `0 de 3` | "Alertas entram no Pro…" |
| Conta com assinatura | `je4ndev@gmail.com` | etiqueta `Pro` + "ativo até 24/10/2026" | `0 de 20` | botão de ligar/desligar |

Fluxo exercitado de ponta a ponta no build local: injetar a sessão real (gerada por magic link na Admin
API, nunca senha), abrir `/conta`, clicar em **Restaurar o acesso** e ler o resultado. Sem assinatura a
mensagem é "Acesso gratuito ligado à sua conta: até 3 times, sem alerta"; com assinatura, "Acesso Pro
ligado à sua conta neste navegador".

## 4. Pendência que trava o cadastro por e-mail em produção

O projeto está com **"Confirm email" ligado** e sem SMTP próprio. O cadastro por e-mail cria o usuário e
devolve `session: null` até a pessoa clicar no link, e o e-mail sai pelo SMTP padrão do Supabase, que é
limitado a poucos envios por hora. Ou seja: quem se cadastrar por e-mail hoje pode não receber o link.

Decisão necessária (uma das três):

1. ligar SMTP próprio (Resend, SendGrid, Amazon SES) com a chave do domínio `je4ndev.com` — é o caminho
   definitivo e destrava também a recuperação de senha;
2. desligar "Confirm email" no painel do Supabase enquanto não houver SMTP (entra direto, sem link);
3. lançar só com Google (funciona hoje, sem e-mail nenhum) e esconder o formulário de senha.

Enquanto isso não é decidido, o caminho que funciona sem depender de e-mail é **Continuar com Google**,
que é o botão principal das duas telas. A página de entrada explica o que fazer se a senha for perdida
(pedir o acesso pelo e-mail de suporte), porque "esqueci a senha" também depende de e-mail.

## 5. Artefato publicado

| Item | Valor |
| --- | --- |
| Build | `scripts/build-pages.mjs` com `PAGES_BASE_PATH=` e `PAGES_CUSTOM_DOMAIN=hypefc.je4ndev.com` |
| Publicação | `npm run deploy:domain`, branch `gh-pages` |
| Rotas verificadas no ar | `/`, `/pro`, `/entrar`, `/criar-conta`, `/conta`, `/termos`, `/privacidade` → 200 |
| Chunk conferido | `page-*.js` servido idêntico ao `out/` local (sha256) |
