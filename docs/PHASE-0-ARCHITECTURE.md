# GerenteMarketing — Fase 0: Arquitetura recomendada

## 1. Arquitetura final recomendada

O GerenteMarketing será construído como um SaaS web multiempresa com serviços desacoplados o suficiente para crescer, mas sem microserviços prematuros.

```text
Browser
  ↓
Next.js Web App
  ↓
API Backend (NestJS)
  ↓
PostgreSQL
  ├─ Redis / filas
  ├─ Object Storage
  ├─ Workers 24/7
  ├─ AI Orchestrator
  └─ Integration Adapters
       ├─ Meta / Instagram
       ├─ WhatsApp Cloud API
       ├─ TikTok (futuro)
       └─ Telegram (futuro)
```

### Princípios

- WEB primeiro.
- Multiempresa desde o schema inicial.
- Monólito modular no backend, não microserviços no começo.
- Workers separados do processo HTTP.
- Toda ação automática precisa ser auditável.
- Tokens e secrets nunca vão para o frontend.
- Integrações externas ficam atrás de adapters.
- IA nunca acessa diretamente APIs de anúncio sem passar por regras, orçamento, autorização e auditoria.
- Métricas exibidas precisam indicar origem e timestamp.
- Scores e projeções precisam ter fórmulas documentadas.

---

## 2. Stack recomendada

### Monorepo

- pnpm workspaces
- Turborepo
- TypeScript em toda a base principal

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui como base de componentes, customizado para identidade própria
- TanStack Query para estado remoto
- Zustand apenas para estado local complexo quando necessário
- Recharts ou ECharts para gráficos
- Framer Motion para microanimações pontuais

### Backend

**Escolha: Node.js + TypeScript + NestJS.**

Motivos:

- mesma linguagem do frontend;
- excelente organização por módulos;
- bom suporte a filas, jobs, websockets e integrações;
- adequado para APIs externas e workers orientados a eventos;
- reduz complexidade operacional no início.

Python poderá existir depois como serviço especializado para estatística, ML ou processamento pesado, sem virar dependência do produto inteiro.

### Banco

- PostgreSQL
- Prisma ORM inicialmente
- migrations versionadas

### Infra inicial

- Vercel: frontend
- Railway: API, workers e Redis no MVP
- Supabase ou Neon: PostgreSQL gerenciado
- S3-compatible storage para criativos e arquivos

### Filas e processamento

- Redis
- BullMQ
- workers independentes
- retries com backoff
- dead-letter strategy para jobs problemáticos

### Observabilidade

- logs estruturados
- Sentry para erros
- OpenTelemetry em evolução
- tabela de audit log no banco

### IA

Criar uma camada própria:

```text
AIProvider
 ├─ OpenAIProvider
 ├─ AnthropicProvider
 ├─ GoogleProvider
 └─ FutureProvider
```

O domínio nunca dependerá diretamente de SDK específico de um modelo.

---

## 3. Estrutura dos serviços

Estrutura inicial proposta:

```text
apps/
  web/
  api/
  worker/

packages/
  ui/
  config/
  database/
  domain/
  analytics/
  ai-core/
  integrations/
  contracts/
  validation/

infra/
  docker/
  scripts/

docs/
```

### Domínios principais do backend

- auth
- users
- organizations
- workspaces
- integrations
- campaigns
- ad-sets
- ads
- goals
- metrics
- creatives
- content
- leads
- attribution
- experiments
- recommendations
- autopilot
- notifications
- audit
- ai
- billing (reservado para futuro)

---

## 4. Estrutura inicial do banco

Todas as entidades de negócio devem carregar `organization_id` quando aplicável.

### Identidade e tenancy

- users
- organizations
- organization_members
- roles
- permissions
- invitations

### Integrações

- integration_accounts
- integration_credentials
- integration_sync_runs
- webhooks
- webhook_events

### Marketing

- campaigns
- ad_sets
- ads
- campaign_snapshots
- metric_snapshots
- audiences
- creatives
- creative_assets
- creative_performance

### Metas e inteligência

- goals
- goal_progress_snapshots
- recommendations
- recommendation_evidence
- decision_runs
- decision_actions
- optimization_policies

### Experimentos

- experiments
- experiment_variants
- experiment_assignments
- experiment_results

### Conteúdo

- content_items
- content_calendar_entries
- content_variants
- content_performance

### CRM / leads

- leads
- lead_events
- conversations
- sales
- attribution_touchpoints

### Operação

- worker_runs
- system_events
- notifications
- audit_logs

### Segurança

Credenciais externas devem ser armazenadas criptografadas no backend. O banco não deverá expor tokens de acesso em queries comuns.

---

## 5. Estrutura das páginas

### Públicas

- `/`
- `/login`
- `/signup`
- `/forgot-password`

### App

- `/app`
- `/app/dashboard`
- `/app/campaigns`
- `/app/campaigns/new`
- `/app/goals`
- `/app/creatives`
- `/app/content`
- `/app/calendar`
- `/app/leads`
- `/app/experiments`
- `/app/recommendations`
- `/app/radar`
- `/app/autopilot`
- `/app/live`
- `/app/reports`
- `/app/integrations`
- `/app/settings`

### Contexto de empresa

A empresa ativa ficará no contexto da sessão e todas as consultas serão filtradas por organização. O seletor de empresa ficará no topo/sidebar.

---

## 6. Design visual recomendado

### Direção

Visual premium, escuro, técnico e limpo — mais próximo de Linear, Vercel, Stripe e ferramentas profissionais de analytics do que de um painel administrativo genérico.

### Linguagem visual

- fundo escuro profundo;
- superfícies com contraste discreto;
- bordas finas;
- tipografia limpa;
- densidade de informação controlada;
- cor de destaque usada com moderação;
- gráficos como elemento principal, não decorativo;
- motion curto e funcional;
- estados de loading, vazio, erro e sincronização desenhados desde o início.

### Layout principal

```text
┌───────────────────────────────────────────────────────────────┐
│ Topbar: empresa | período | sync | alertas | usuário          │
├───────────────┬───────────────────────────────────────────────┤
│ Sidebar       │ Conteúdo                                     │
│ Dashboard     │                                               │
│ Campanhas     │ KPIs + metas + tendências                    │
│ Metas         │                                               │
│ Criativos     │ Gráficos e insights                          │
│ Conteúdo      │                                               │
│ Leads         │ Recomendações acionáveis                     │
│ Experimentos  │                                               │
│ Radar IA      │ Atividade recente dos workers                │
│ Autopilot     │                                               │
└───────────────┴───────────────────────────────────────────────┘
```

### Regra de UX

Não usar cards indiscriminadamente. Cards só entram quando agrupam informação real e relacionada.

---

## 7. Motor de otimização

O motor será dividido em quatro camadas.

### Camada 1 — Coleta

Recebe métricas reais das integrações e grava snapshots históricos.

### Camada 2 — Feature Engine

Calcula sinais derivados, por exemplo:

- CPA móvel;
- CTR móvel;
- tendência de gasto;
- frequência;
- saturação;
- estabilidade;
- velocidade de conversão;
- tamanho de amostra;
- distância do custo-alvo;
- distância da meta;
- performance relativa ao grupo de controle.

### Camada 3 — Decision Engine

Gera recomendações considerando:

- confiança estatística;
- gasto mínimo;
- duração mínima;
- limites da conta;
- orçamento diário;
- orçamento total;
- política do cliente;
- modo SAFE / MANAGED / AUTOPILOT / AGGRESSIVE;
- histórico recente;
- risco de saturação;
- impacto esperado.

Nunca usar regra simples do tipo “menor CPA ganha tudo”.

### Camada 4 — Action Engine

Transforma decisões aprovadas em ações concretas por adapter de plataforma.

Toda ação deverá registrar:

- motivo;
- dados usados;
- regra/política;
- valor anterior;
- valor novo;
- usuário ou agente responsável;
- horário;
- resultado da API externa.

### Primeira versão do motor

Antes de IA generativa controlar orçamento, o sistema começará com um motor determinístico e auditável de recomendações. IA generativa poderá explicar, resumir e propor alternativas, mas não será a única responsável pela decisão.

---

## 8. APIs necessárias

### Primeira versão

- Meta Marketing API
- Instagram Graph API
- WhatsApp Cloud API

### Futuras

- TikTok Marketing API
- TikTok Content / Business APIs conforme permissões disponíveis
- Telegram Bot API
- Google Ads API
- YouTube Data / Analytics APIs

### Infra / produto

- provedor de IA via adapter
- e-mail transacional
- storage S3-compatible
- observabilidade

### Regra

Antes de implementar qualquer integração externa, confirmar documentação atual, permissões, revisão necessária, quotas, limitações e políticas da plataforma.

---

## 9. Custos iniciais prováveis

No desenvolvimento e primeiros testes, o objetivo é manter custo baixo e usar tiers gratuitos quando suficientes.

Estimativa inicial de MVP pequeno:

| Item | Faixa inicial |
|---|---:|
| Vercel | R$0–R$120/mês |
| API + worker | R$30–R$150/mês |
| PostgreSQL | R$0–R$120/mês |
| Redis | R$0–R$60/mês |
| Storage | baixo no início |
| IA | variável por uso |
| Observabilidade | gratuito no início |

O gasto com mídia da Meta não faz parte do custo de infraestrutura do GerenteMarketing.

Não devemos contratar infraestrutura cara antes de medir carga real.

---

## 10. Roadmap da primeira versão funcional

### Fase 0 — Planejamento técnico

- arquitetura
- stack
- schemas conceituais
- limites de automação
- organização do repositório

### Fase 1 — Fundação

- monorepo
- lint
- format
- TypeScript
- CI
- variáveis de ambiente
- app web
- API
- worker

### Fase 2 — Design system + dashboard

- shell do produto
- sidebar
- topbar
- componentes
- gráficos
- dashboard com dados mockados claramente identificados

### Fase 3 — Banco + autenticação + empresas

- login
- usuários
- organizações
- membros
- isolamento multiempresa

### Fase 4 — Campanhas e metas

- CRUD interno
- metas
- progresso
- projeções iniciais

### Fase 5 — Meta

- OAuth / conexão autorizada
- contas de anúncio
- campanhas
- ad sets
- anúncios
- ingestão de métricas

### Fase 6 — Métricas reais

- snapshots
- dashboard real
- histórico
- comparação de períodos

### Fase 7 — Recomendações

- feature engine
- regras de decisão
- explicações
- evidências

### Fase 8 — Experimentos

- criação
- variantes
- acompanhamento
- definição de vencedor

### Fase 9 — Autopilot controlado

- SAFE
- MANAGED
- AUTOPILOT
- AGGRESSIVE
- limites e kill switches

### Fase 10 — Leads + WhatsApp

- CRM
- conversas
- origem
- atribuição
- venda

### Após validação

- TikTok
- Telegram
- billing SaaS
- planos
- agency mode

---

## Decisões de produto para o MVP

1. Não vamos construir microserviços agora.
2. Não vamos permitir ação automática sem trilha de auditoria.
3. Não vamos mostrar score sem fórmula e dados de origem.
4. Não vamos prometer quantidade garantida de seguidores, leads ou vendas.
5. Não vamos simular atividade falsa no Live Engine.
6. Não vamos acoplar o produto a um único provedor de IA.
7. O primeiro cliente de validação será o Tem Na Loja.
8. Meta/Instagram + WhatsApp será a primeira vertical de integração.
