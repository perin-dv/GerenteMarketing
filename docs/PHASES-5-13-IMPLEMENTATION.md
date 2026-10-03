# GerenteMarketing — Fases 5 a 13

## Direção atual

O produto prioriza crescimento orgânico com investimento de mídia opcional. O orçamento zero é um caso de uso de primeira classe.

## Fase 5 — Meta / Instagram

Implementado:

- conexão autorizada via OAuth;
- Graph API versionada por `META_GRAPH_VERSION`;
- tokens criptografados com AES-256-GCM;
- descoberta de Página + conta profissional do Instagram;
- sincronização inicial de perfil, mídia e insights disponíveis;
- registro de sync runs, erros e timestamps;
- nenhuma métrica inventada.

A versão padrão configurada é `v26.0` e permanece configurável.

## Fase 6 — Métricas reais

Implementado:

- `MetricSnapshot` com origem e timestamp;
- resumo de período e histórico por métrica;
- followers, conteúdo publicado e engagements;
- reach/views quando disponíveis;
- metas compatíveis recebem o valor real mais recente;
- dashboard passa a usar os snapshots reais.

## Fase 7 — Recomendações + conteúdo

Implementado:

- Content Engine para fila de Reels/posts/stories;
- Radar/Decision Engine determinístico;
- recomendação com evidência, confiança e impacto;
- detecção de integração ausente, meta fora do ritmo e conteúdo abaixo do plano;
- aplicar/dispensar recomendação auditável.

## Fase 8 — Experimentos

Implementado:

- teste A/B;
- hipótese e métrica principal;
- variantes, amostra e valor observado;
- início/conclusão;
- seleção de vencedor entre variantes que tenham amostra.

O sistema não afirma significância estatística sem metodologia e amostra adequadas.

## Fase 9 — Autopilot

Implementado:

- SAFE / MANAGED / AUTOPILOT / AGGRESSIVE;
- `enabled` separado de modo;
- kill switch;
- limite de ações/dia;
- permissões de publicação e respostas separadas;
- orçamento bloqueado (`allowBudgetChanges=false`);
- execução atual prioriza recomendações sem gasto externo.

## Fase 10 — Leads + WhatsApp

Implementado:

- WhatsApp Cloud API;
- token criptografado;
- webhook GET de verificação;
- validação HMAC `X-Hub-Signature-256`;
- lead automático por remetente;
- conversa com janela operacional de 24h;
- contagem de novas conversas como métrica;
- CRM NEW / CONTACTED / QUALIFIED / WON / LOST.

## Fase 11 — TikTok

Implementado tecnicamente:

- OAuth 2.0 via Login Kit;
- `user.info.basic`, `user.info.stats` e `video.list`;
- access/refresh token criptografados;
- Display API v2;
- sincronização de seguidores, quantidade de vídeos, views e interações dos vídeos recentes;
- tela `/channels`.

A conexão real depende de aplicativo TikTok aprovado e redirect URI HTTPS registrado.

## Fase 12 — Telegram

Implementado tecnicamente:

- Bot API oficial;
- validação por `getMe`;
- token criptografado;
- registro `setWebhook` quando existe URL pública HTTPS;
- `secret_token` validado no header oficial;
- mensagens reais criam/atualizam lead e conversa no CRM;
- novos leads geram snapshot real de LEADS.

## Fase 13 — SaaS / multiempresa

Implementado neste estágio:

- Company + Membership + roles;
- isolamento por `companyId`;
- criação de novo workspace;
- listagem dos workspaces do usuário;
- troca de empresa com validação de membership;
- nova sessão JWT ligada ao workspace escolhido;
- tela `/workspaces`.

Próximos submódulos comerciais da Fase 13 ficam separados do core técnico: convites por e-mail, planos/billing, limites por plano e agency mode.

## Regras permanentes

1. Nunca fabricar seguidores, views, likes ou conversas.
2. Nunca prometer número garantido de crescimento orgânico.
3. Tokens nunca voltam ao frontend depois de armazenados.
4. Toda automação externa deve ser auditável e ter kill switch.
5. Meta/Instagram, WhatsApp, TikTok e Telegram usam APIs oficiais.
6. Tráfego pago é opcional; orçamento zero continua suportado.
7. O primeiro cliente de validação continua sendo o Tem Na Loja.
