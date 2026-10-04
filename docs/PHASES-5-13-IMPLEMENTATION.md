# GerenteMarketing — Fases 5 a 13

## Direção atual

O produto prioriza crescimento orgânico com investimento de mídia opcional. O orçamento zero é um caso de uso de primeira classe.

## Fase 5 — Meta / Instagram

Implementado nesta branch:

- conexão autorizada via OAuth;
- Graph API versionada por `META_GRAPH_VERSION`;
- armazenamento de tokens criptografados com AES-256-GCM;
- descoberta de Página + conta profissional do Instagram;
- sincronização inicial de perfil, mídia e insights disponíveis;
- registro de sync runs, erros e timestamps;
- nenhuma métrica inventada.

A versão padrão configurada é `v26.0`. O valor continua configurável para permitir atualização sem alterar domínio.

## Fase 6 — Métricas reais

Implementado:

- `MetricSnapshot` com origem e timestamp;
- resumo de período;
- histórico por métrica;
- followers, content published e engagements na sincronização básica;
- reach/views coletados quando o tipo de mídia disponibiliza esses insights;
- metas compatíveis recebem o valor real mais recente.

## Fase 7 — Recomendações + conteúdo

Implementado:

- Content Engine que transforma o plano de campanha em fila de Reels/posts/stories;
- Radar/Decision Engine determinístico;
- recomendação com evidência, confiança e impacto;
- integração ausente, meta fora do ritmo e conteúdo abaixo do plano viram sinais explícitos;
- aplicar/dispensar recomendação fica auditável.

## Fase 8 — Experimentos

Implementado:

- criação de teste A/B;
- hipótese;
- métrica principal;
- variantes;
- tamanho de amostra;
- valor observado;
- início/conclusão;
- seleção de vencedor pelo melhor valor entre variantes com amostra.

Antes de automação estatística mais forte, o sistema evita afirmar significância sem tamanho de amostra e metodologia adequados.

## Fase 9 — Autopilot

Implementado:

- SAFE / MANAGED / AUTOPILOT / AGGRESSIVE;
- `enabled` separado de modo;
- kill switch;
- limite de ações/dia;
- permissões de publicação e respostas separadas;
- orçamento bloqueado (`allowBudgetChanges=false`) nesta etapa;
- execução atual gera e prioriza recomendações, sem gasto externo.

## Fase 10 — Leads + WhatsApp

Implementado:

- conexão com WhatsApp Cloud API;
- token criptografado;
- webhook GET de verificação;
- validação HMAC `X-Hub-Signature-256` no POST;
- criação automática de lead por remetente;
- conversa com janela operacional de 24h;
- contagem de novas conversas como métrica;
- CRM com estágios NEW / CONTACTED / QUALIFIED / WON / LOST.

## Fase 11 — TikTok

Base preparada:

- provider reservado no schema;
- variáveis `TIKTOK_CLIENT_KEY` e `TIKTOK_CLIENT_SECRET`;
- readiness no backend.

A conexão real só será habilitada depois de configurar um aplicativo TikTok aprovado e confirmar os escopos disponíveis para a conta do cliente.

## Fase 12 — Telegram

Base preparada:

- provider reservado no schema;
- variável `TELEGRAM_BOT_TOKEN`;
- readiness no backend.

O adapter de Bot API será ligado em branch própria depois da validação das fases Meta/WhatsApp.

## Fase 13 — SaaS / multiempresa

A fundação já existe desde a Fase 3:

- Company;
- Membership;
- roles;
- isolamento por `companyId` no backend;
- entidades novas também carregam `companyId`.

Próximo bloco desta fase:

- troca de workspace na sessão;
- convites;
- planos/billing;
- limites por plano;
- agency mode.

## Regras permanentes

1. Nunca fabricar seguidores, views, likes ou conversas.
2. Nunca prometer número garantido de crescimento orgânico.
3. Tokens nunca voltam ao frontend depois de armazenados.
4. Toda automação externa deve ser auditável e ter kill switch.
5. Meta/Instagram/WhatsApp usam APIs oficiais.
6. Tráfego pago é opcional; orçamento zero continua suportado.
7. O primeiro cliente de validação continua sendo o Tem Na Loja.
