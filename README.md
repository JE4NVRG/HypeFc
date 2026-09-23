<div align="center">

# HypeFC

### Dashboard de futebol em tempo real

Acompanhe jogos, classificacoes, artilheiros e identifique os **times em alta** nas principais ligas do mundo - tudo em tempo real, direto da API.

[![Next.js](https://img.shields.io/badge/Next.js_14-000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![shadcn/ui](https://img.shields.io/badge/shadcn%2Fui-000?logo=shadcnui&logoColor=white)](https://ui.shadcn.com/)
[![Vercel](https://img.shields.io/badge/Deploy-Vercel-000?logo=vercel&logoColor=white)](https://vercel.com/)

<br />

<img src="public/preview.png" alt="HypeFC Dashboard Preview" width="100%" style="border-radius: 12px;" />

</div>

---

## Sobre o projeto

O HypeFC nasceu da necessidade de ter uma visao rapida e inteligente do cenario do futebol mundial. O dashboard consome a API da [Football-Data.org](https://www.football-data.org/) em tempo real e aplica um algoritmo proprio de **deteccao de hype** que cruza classificacoes, jogos do dia e posicoes para destacar automaticamente os times mais relevantes.

### O que torna diferente

- **Zero banco de dados** - Arquitetura serverless pura, dados sempre frescos direto da API
- **Hype inteligente** - Score 0-100 com forma, tabela, saldo, clássico e jogo ao vivo. "Joga hoje" sozinho não entra.
- **Cache otimizado** - In-memory cache com TTL para respeitar rate limits sem sacrificar velocidade
- **Full responsive** - Interface adaptativa de 1 a 4 colunas (mobile, tablet, desktop, ultrawide)

---

## Features

### Resumo do Dia
Barra de estatisticas com metricas em tempo real: total de jogos, gols marcados, media por partida, jogos ao vivo e ligas ativas.

### Jogos de Hoje
Todas as partidas do dia agrupadas por liga, com escudos dos times, posicoes na tabela e **placar ao vivo**. Jogos em andamento recebem destaque visual com indicador LIVE.

### Times em Alta (Hype Detection)
Score de 0 a 100, não uma lista de quem joga hoje. Entram no máximo 12 times que passam de um corte mínimo, cruzando:
- forma dos últimos 5 jogos
- posição na tabela
- saldo de gols
- clássico do dia
- jogo ao vivo

Cada card mostra o score, a forma e o motivo. Líder frio sem jogo relevante fica de fora; meio de tabela só porque "joga hoje" também.

### Classificacao Completa
Tabela de qualquer liga com indicadores visuais de zona: Champions League (verde), Europa League (azul) e rebaixamento (vermelho). Alterna entre 10+ competicoes com um clique.

### Artilheiros
Top 10 goleadores da liga selecionada com gols, assistencias e time. Medalhas para o podio (ouro, prata, bronze).

---

## Ligas suportadas

| Liga | Pais |
|------|------|
| Brasileirao Serie A | Brasil |
| Premier League | Inglaterra |
| La Liga | Espanha |
| Serie A | Italia |
| Bundesliga | Alemanha |
| Ligue 1 | Franca |
| Champions League | Europa |
| Eredivisie | Holanda |
| Primeira Liga | Portugal |
| Championship | Inglaterra |

---

## Tech Stack

```
Frontend       Next.js 14 (App Router) + React 18 + TypeScript
Estilizacao    Tailwind CSS + shadcn/ui + Radix UI
Tipografia     Geist Sans / Geist Mono
Dados          Football-Data.org API v4 (tempo real)
Cache          In-memory com TTL (5-30 min por endpoint)
Deploy         Vercel (Serverless Functions)
```

### Arquitetura

```
Browser  -->  Next.js API Routes  -->  Football-Data.org API
                    |
              Cache in-memory
              (5-30 min TTL)
```

Sem banco de dados, sem cron jobs, sem infraestrutura extra. As API Routes atuam como proxy com cache, respeitando o rate limit da API (10 req/min no free tier).

---

## Estrutura do projeto

```
src/
├── app/
│   ├── api/dashboard/
│   │   ├── today/route.ts           # Jogos + hype + stats do dia
│   │   ├── standings/[league_id]/   # Classificacao por liga
│   │   └── scorers/[league_id]/     # Artilheiros por liga
│   ├── layout.tsx                   # Root layout (Geist font, metadata)
│   ├── page.tsx                     # Dashboard (composicao de componentes)
│   └── globals.css                  # Theme dark + CSS variables
├── components/
│   └── dashboard/
│       ├── DashboardHeader.tsx      # Header com status e refresh
│       ├── StatsBar.tsx             # Cards de estatisticas do dia
│       ├── TodayMatches.tsx         # Jogos com placar ao vivo
│       ├── HypeFlags.tsx            # Times em alta com prioridade
│       ├── LeagueStandings.tsx      # Tabela de classificacao
│       ├── TopScorers.tsx           # Artilheiros da liga
│       └── DashboardFooter.tsx      # Footer com creditos
├── hooks/
│   └── useDashboardData.ts         # Hook centralizado de estado
├── services/
│   └── footballApi.ts              # Client da Football-Data API
├── lib/
│   └── cache.ts                    # Cache in-memory singleton
└── types/
    └── index.ts                    # Types + mapeamento de ligas
```

---

## Rodando localmente

### Pre-requisitos

- Node.js 18+
- Token gratuito da [Football-Data.org](https://www.football-data.org/client/register)

### Instalacao

```bash
# Clonar o repositorio
git clone https://github.com/JE4NVRG/HypeFc.git
cd HypeFc

# Instalar dependencias
npm install

# Configurar variavel de ambiente
cp .env.example .env.local
```

Edite o `.env.local` e adicione seu token:

```env
FOOTBALL_API_TOKEN=seu_token_aqui
```

```bash
# Iniciar o servidor de desenvolvimento
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000)

### Deploy na Vercel

1. Importe o repositorio em [vercel.com/new](https://vercel.com/new)
2. Adicione a variavel de ambiente `FOOTBALL_API_TOKEN`
3. Deploy automatico a cada push na `main`

---

## Variaveis de ambiente

| Variavel | Obrigatoria | Descricao |
|----------|:-----------:|-----------|
| `FOOTBALL_API_TOKEN` | Sim | Token de acesso a Football-Data.org API |
| `FOOTBALL_API_BASE_URL` | Nao | URL base da API (default: `https://api.football-data.org/v4`) |

> Nenhuma chave secreta e exposta no frontend. O token e utilizado apenas server-side nas API Routes.

---

## Autor

<div>

**Jean Carlos Vargas da Silva**

[![GitHub](https://img.shields.io/badge/GitHub-JE4NVRG-181717?logo=github)](https://github.com/JE4NVRG)

</div>

## Licenca

Distribuido sob a licenca MIT. Veja `LICENSE` para mais informacoes.

---

<div align="center">
  <sub>Dados fornecidos por <a href="https://www.football-data.org/">Football-Data.org</a></sub>
</div>
