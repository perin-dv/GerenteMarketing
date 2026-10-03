# GerenteMarketing — Regras de desenvolvimento

## Fluxo Git

- `main` deve permanecer estável.
- Desenvolvimento sempre em branches.
- Features grandes devem usar branch própria.
- Commits pequenos e descritivos.
- Mudanças importantes devem passar por Pull Request.
- Evitar misturar refactor, feature e correção no mesmo commit.

## Antes de implementar feature grande

1. analisar;
2. definir comportamento esperado;
3. definir arquitetura e impactos;
4. implementar;
5. testar;
6. validar regressões;
7. documentar decisões relevantes.

## Qualidade

Toda feature deverá, quando aplicável, ter:

- validação de entrada;
- tratamento de erro;
- estados de loading/empty/error no frontend;
- autorização;
- isolamento por organização;
- logs adequados;
- testes;
- documentação de variáveis de ambiente;
- nenhum secret versionado.

## Integrações externas

Antes de implementar uma API externa:

- confirmar documentação oficial atual;
- confirmar permissões e escopos;
- confirmar quotas/limites;
- confirmar política de uso;
- confirmar processo de revisão quando existir;
- registrar estratégia de retry;
- prever idempotência para webhooks;
- armazenar eventos brutos quando útil para auditoria.

## IA e automação

- IA generativa não terá acesso irrestrito a ações de campanha.
- Toda recomendação precisa apontar evidências.
- Toda ação automática precisa respeitar limites definidos pela organização.
- Modos SAFE, MANAGED, AUTOPILOT e AGGRESSIVE não alteram regras das plataformas.
- Deve existir kill switch para automações.
- Decisões devem ser reproduzíveis ou ao menos explicáveis por logs e dados de entrada.

## Métricas

- Não inventar métricas.
- Mock data deve ser explicitamente marcado como mock/dev.
- Registrar `source`, `captured_at` e janela de agregação quando aplicável.
- Scores precisam de fórmula versionada.
- Projeções precisam diferenciar realizado de estimado.

## Segurança

- tokens apenas no backend;
- criptografia de credenciais externas;
- secrets via variáveis/secret manager;
- rate limiting;
- RBAC;
- audit logs;
- isolamento multiempresa;
- backups;
- sanitização de entradas;
- proteção contra replay/idempotência em webhooks.

## UX

- design premium desde a fundação;
- evitar admin template genérico;
- não usar cards sem necessidade;
- estados vazios devem orientar o usuário;
- números importantes precisam de contexto e comparação;
- ações perigosas precisam de confirmação e feedback claro;
- automações precisam mostrar o que fizeram e por quê.
