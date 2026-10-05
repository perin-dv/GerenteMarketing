# GerenteMarketing

Plataforma web SaaS em desenvolvimento para gestão de marketing, campanhas, conteúdo, leads, métricas e automações.

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![NestJS](https://img.shields.io/badge/NestJS-12-E0234E?style=flat-square&logo=nestjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat-square&logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)

## Objetivo

O GerenteMarketing está sendo construído como um painel central para organizar campanhas, metas, conteúdo, métricas e decisões de marketing em uma única interface.

A proposta é trabalhar com **dados reais, metas, projeções e automações legítimas**. O sistema não fabrica seguidores, curtidas ou visualizações e não promete resultados garantidos.

## Arquitetura atual

O projeto usa um monorepo com três aplicações principais:

```text
apps/
├── web/       # interface web em Next.js
├── api/       # API em NestJS + Prisma
└── worker/    # processos assíncronos em TypeScript
```

Infraestrutura local:

```text
PostgreSQL
Redis
Docker Compose
```

## Stack

**Frontend**
- Next.js 16
- React 19
- TypeScript

**Backend**
- NestJS 12
- Prisma
- JWT
- validação com class-validator

**Infraestrutura**
- PostgreSQL
- Redis
- Docker / Docker Compose

## Escopo da primeira versão

- autenticação;
- dashboard de marketing;
- estrutura multiempresa;
- campanhas e metas;
- métricas reais;
- conteúdo e biblioteca de criativos;
- leads;
- recomendações e inteligência de decisão;
- integrações sociais por provedores oficiais quando aplicável.

## Rodar localmente

Pré-requisitos:

- Node.js 22.18+
- npm
- Docker Desktop / Docker Engine

```bash
git clone https://github.com/perin-dv/GerenteMarketing.git
cd GerenteMarketing
npm install
npm run infra:up
npm run dev:combined
```

Para iniciar o worker separadamente:

```bash
npm run dev:worker
```

## Scripts úteis

```bash
npm run build
npm run typecheck
npm run db:generate
npm run db:migrate
npm run db:seed
npm run infra:down
```

## Status

Projeto em desenvolvimento ativo. A arquitetura base já separa frontend, API, worker e infraestrutura para permitir evolução por módulos sem acoplamento excessivo.

## Portfólio

Veja outros projetos e cases em:

**https://guilherme-perin.vercel.app**

## Autor

**Guilherme Perin**  
Software • IA • Cloud • Automação
