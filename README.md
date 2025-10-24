# ⚽ HypeFC

<div align="center">
  <img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
</div>

<div align="center">
  <h3>🔥 Dashboard de Futebol com Dados em Tempo Real</h3>
  <p>Descubra os times mais quentes para vender hoje no mercado de apostas esportivas</p>
</div>

---

## 📋 Sobre o Projeto

O **HypeFC** é um dashboard moderno e responsivo que fornece informações essenciais sobre futebol em tempo real. Desenvolvido para ajudar apostadores e entusiastas do futebol a identificar oportunidades no mercado, o sistema apresenta dados atualizados sobre jogos, times em alta e classificações das principais ligas.

### ✨ Funcionalidades Principais

- **🗓️ Jogos de Hoje**: Visualize todos os jogos programados para hoje, organizados por liga
- **🔥 Times em Alta**: Descubra quais times estão com maior potencial de valorização
- **🏆 Top 10 da Liga**: Acompanhe as classificações das principais ligas europeias e brasileiras
- **🔄 Atualização Manual**: Botão para recarregar dados em tempo real
- **📱 Design Responsivo**: Interface otimizada para desktop e mobile

## 🛠️ Tecnologias Utilizadas

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **API Externa**: Football-Data.org
- **Deployment**: Vercel (pronto para deploy)

## 🚀 Como Executar o Projeto

### Pré-requisitos

- Node.js 18+ instalado
- Conta no Supabase
- API Key do Football-Data.org

### Instalação

1. **Clone o repositório**
```bash
git clone https://github.com/JE4NVRG/HypeFc.git
cd HypeFc
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure as variáveis de ambiente**
```bash
cp .env.example .env.local
```

Edite o arquivo `.env.local` com suas credenciais:
```env
NEXT_PUBLIC_SUPABASE_URL=sua_url_do_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anonima
SUPABASE_SERVICE_ROLE_KEY=sua_chave_de_servico
FOOTBALL_DATA_API_KEY=sua_chave_da_api
```

4. **Execute as migrações do banco**
```bash
# Execute o SQL em supabase/migrations/001_create_tables.sql no seu Supabase
```

5. **Inicie o servidor de desenvolvimento**
```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000) para ver o projeto rodando.

## 📁 Estrutura do Projeto

```
src/
├── app/
│   ├── api/
│   │   └── dashboard/
│   │       ├── today/          # API para jogos de hoje
│   │       └── standings/      # API para classificações
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx               # Página principal do dashboard
├── components/
│   └── ui/                    # Componentes shadcn/ui
├── lib/
│   ├── supabase.ts           # Configuração do Supabase
│   └── utils.ts              # Utilitários
├── services/
│   ├── footballDataService.ts # Integração com Football-Data.org
│   └── supabaseService.ts     # Serviços do Supabase
└── types/
    └── index.ts              # Definições de tipos TypeScript
```

## 🔌 API Endpoints

### `GET /api/dashboard/today`
Retorna jogos de hoje e times em alta
```json
{
  "date": "2024-01-15",
  "matches": [...],
  "hype": [...]
}
```

### `GET /api/dashboard/standings/:league_id`
Retorna classificação de uma liga específica
```json
{
  "league_id": "BSA",
  "league_name": "Brasileirão Série A",
  "table": [...],
  "captured_at": "2024-01-15T10:00:00Z"
}
```

## 🎨 Design System

O projeto utiliza um design system moderno com:
- **Cores**: Paleta dark com gradientes sutis
- **Tipografia**: Inter font para máxima legibilidade
- **Componentes**: shadcn/ui para consistência
- **Ícones**: Lucide React para ícones vetoriais
- **Layout**: Grid responsivo com Tailwind CSS

## 📊 Dados e Integrações

- **Football-Data.org**: API principal para dados de jogos e classificações
- **Supabase**: Armazenamento e cache dos dados
- **Cron Jobs**: Sincronização automática diária às 8:00 (horário de Brasília)

## 🤝 Como Contribuir

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 👨‍💻 Autor

**Jean Vargas** - [@JE4NVRG](https://github.com/JE4NVRG)

---

<div align="center">
  <p>⭐ Se este projeto te ajudou, considere dar uma estrela!</p>
  <p>🚀 Desenvolvido com ❤️ usando Next.js e Supabase</p>
</div>