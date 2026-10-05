import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  AutopilotMode,
  CampaignChannel,
  CampaignStatus,
  ContentStatus,
  ContentType,
  ExperimentStatus,
  GoalMetric,
  GoalStatus,
  IntegrationProvider,
  IntegrationStatus,
  LeadSource,
  LeadStage,
  MetricKey,
  Prisma,
  RecommendationStatus,
  RecommendationType,
  SyncStatus,
} from "@prisma/client";
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { PrismaService } from "../prisma.service";
import {
  ConnectWhatsappDto,
  CreateContentDto,
  CreateExperimentDto,
  CreateLeadDto,
  CreateMetricDto,
  UpdateAutopilotDto,
  UpdateContentDto,
  UpdateExperimentDto,
  UpdateLeadDto,
  UpdateRecommendationDto,
} from "./growth.dto";

@Injectable()
export class GrowthService {
  constructor(private readonly prisma: PrismaService) {}

  private companyIdOrThrow(companyId: string | null | undefined) {
    if (!companyId) throw new ForbiddenException("Nenhuma empresa ativa na sessão.");
    return companyId;
  }

  private graphVersion() {
    return process.env.META_GRAPH_VERSION || "v26.0";
  }

  private integrationKey() {
    const key = Buffer.from(process.env.INTEGRATION_ENCRYPTION_KEY || "", "base64");
    if (key.length !== 32) {
      throw new ServiceUnavailableException(
        "INTEGRATION_ENCRYPTION_KEY precisa ser uma chave base64 de 32 bytes.",
      );
    }
    return key;
  }

  private encryptSecret(value: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.integrationKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
  }

  private decryptSecret(value: string) {
    const [ivRaw, tagRaw, encryptedRaw] = value.split(".");
    if (!ivRaw || !tagRaw || !encryptedRaw) throw new BadRequestException("Credencial criptografada inválida.");
    const decipher = createDecipheriv("aes-256-gcm", this.integrationKey(), Buffer.from(ivRaw, "base64url"));
    decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedRaw, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  }

  private json(value: unknown): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }

  private async externalJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, init);
    const text = await response.text();
    let data: unknown = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }
    if (!response.ok) {
      const message = typeof data === "object" && data && "error" in data
        ? JSON.stringify((data as { error: unknown }).error)
        : `HTTP ${response.status}`;
      throw new BadRequestException(`Integração externa recusou a operação: ${message}`);
    }
    return data as T;
  }

  async listIntegrations(companyIdInput: string | null | undefined) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    return this.prisma.integrationAccount.findMany({
      where: { companyId },
      select: {
        id: true,
        provider: true,
        status: true,
        externalAccountId: true,
        displayName: true,
        username: true,
        scopes: true,
        tokenExpiresAt: true,
        metadata: true,
        lastSyncedAt: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ provider: "asc" }, { createdAt: "asc" }],
    });
  }

  integrationReadiness() {
    return {
      meta: {
        ready: Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET && process.env.META_REDIRECT_URI && process.env.INTEGRATION_ENCRYPTION_KEY),
        graphVersion: this.graphVersion(),
        required: ["META_APP_ID", "META_APP_SECRET", "META_REDIRECT_URI", "INTEGRATION_ENCRYPTION_KEY"],
      },
      whatsapp: {
        ready: Boolean(process.env.META_APP_SECRET && process.env.WHATSAPP_VERIFY_TOKEN && process.env.INTEGRATION_ENCRYPTION_KEY),
        required: ["META_APP_SECRET", "WHATSAPP_VERIFY_TOKEN", "INTEGRATION_ENCRYPTION_KEY"],
      },
      tiktok: {
        ready: Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET),
        status: "adapter-reserved",
      },
      telegram: {
        ready: Boolean(process.env.TELEGRAM_BOT_TOKEN),
        status: "adapter-reserved",
      },
    };
  }

  async createMetaOauthUrl(companyIdInput: string | null | undefined, userId: string) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    const appId = process.env.META_APP_ID;
    const redirectUri = process.env.META_REDIRECT_URI;
    if (!appId || !redirectUri) {
      throw new ServiceUnavailableException("Configure META_APP_ID e META_REDIRECT_URI antes de conectar a Meta.");
    }

    await this.prisma.integrationOAuthState.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    const state = randomBytes(32).toString("hex");
    await this.prisma.integrationOAuthState.create({
      data: {
        companyId,
        userId,
        provider: IntegrationProvider.META_INSTAGRAM,
        state,
        expiresAt: new Date(Date.now() + 10 * 60_000),
      },
    });

    const scopes = [
      "pages_show_list",
      "pages_read_engagement",
      "instagram_basic",
      "instagram_manage_insights",
      "instagram_content_publish",
    ];
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      state,
      response_type: "code",
      scope: scopes.join(","),
    });
    return {
      url: `https://www.facebook.com/${this.graphVersion()}/dialog/oauth?${params.toString()}`,
      scopes,
      expiresInSeconds: 600,
    };
  }

  async completeMetaOauth(code: string, state: string) {
    const pending = await this.prisma.integrationOAuthState.findUnique({ where: { state } });
    if (!pending || pending.provider !== IntegrationProvider.META_INSTAGRAM) {
      throw new BadRequestException("Estado OAuth inválido ou já utilizado.");
    }
    if (pending.expiresAt.getTime() < Date.now()) {
      await this.prisma.integrationOAuthState.delete({ where: { id: pending.id } });
      throw new BadRequestException("A conexão com a Meta expirou. Inicie novamente.");
    }

    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    const redirectUri = process.env.META_REDIRECT_URI;
    if (!appId || !appSecret || !redirectUri) throw new ServiceUnavailableException("Credenciais da Meta não configuradas.");

    const tokenParams = new URLSearchParams({ client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code });
    const short = await this.externalJson<{ access_token: string; expires_in?: number }>(
      `https://graph.facebook.com/${this.graphVersion()}/oauth/access_token?${tokenParams.toString()}`,
    );

    let accessToken = short.access_token;
    let expiresIn = short.expires_in;
    try {
      const longParams = new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: short.access_token,
      });
      const longToken = await this.externalJson<{ access_token: string; expires_in?: number }>(
        `https://graph.facebook.com/${this.graphVersion()}/oauth/access_token?${longParams.toString()}`,
      );
      accessToken = longToken.access_token;
      expiresIn = longToken.expires_in ?? expiresIn;
    } catch {
      // O token curto ainda permite concluir a conexão quando o exchange não estiver disponível.
    }

    type MetaPage = {
      id: string;
      name?: string;
      access_token?: string;
      instagram_business_account?: { id: string; username?: string };
    };
    const pages = await this.externalJson<{ data?: MetaPage[] }>(
      `https://graph.facebook.com/${this.graphVersion()}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&limit=100&access_token=${encodeURIComponent(accessToken)}`,
    );
    const scopes = ["pages_show_list", "pages_read_engagement", "instagram_basic", "instagram_manage_insights", "instagram_content_publish"];
    const connected: Array<{ id: string; username?: string; pageName?: string }> = [];

    for (const page of pages.data ?? []) {
      const instagram = page.instagram_business_account;
      if (!instagram?.id) continue;
      const existing = await this.prisma.integrationAccount.findFirst({
        where: { companyId: pending.companyId, provider: IntegrationProvider.META_INSTAGRAM, externalAccountId: instagram.id },
      });
      const common = {
        status: IntegrationStatus.CONNECTED,
        displayName: page.name || instagram.username || "Instagram",
        username: instagram.username,
        accessTokenCiphertext: this.encryptSecret(page.access_token || accessToken),
        scopes,
        tokenExpiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
        metadata: this.json({ facebookPageId: page.id, facebookPageName: page.name || null }),
        errorMessage: null,
      };
      if (existing) {
        await this.prisma.integrationAccount.update({ where: { id: existing.id }, data: common });
      } else {
        await this.prisma.integrationAccount.create({
          data: { companyId: pending.companyId, provider: IntegrationProvider.META_INSTAGRAM, externalAccountId: instagram.id, ...common },
        });
      }
      connected.push({ id: instagram.id, username: instagram.username, pageName: page.name });
    }

    await this.prisma.auditLog.create({
      data: { userId: pending.userId, companyId: pending.companyId, action: "integration.meta.connected", metadata: this.json({ accounts: connected.length }) },
    });
    await this.prisma.integrationOAuthState.delete({ where: { id: pending.id } });
    return { companyId: pending.companyId, connected: connected.length, accounts: connected };
  }

  async connectWhatsapp(companyIdInput: string | null | undefined, userId: string, dto: ConnectWhatsappDto) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    const profile = await this.externalJson<{ display_phone_number?: string; verified_name?: string; id: string }>(
      `https://graph.facebook.com/${this.graphVersion()}/${encodeURIComponent(dto.phoneNumberId)}?fields=id,display_phone_number,verified_name`,
      { headers: { Authorization: `Bearer ${dto.accessToken}` } },
    );
    const existing = await this.prisma.integrationAccount.findFirst({
      where: { companyId, provider: IntegrationProvider.WHATSAPP, externalAccountId: dto.phoneNumberId },
    });
    const common = {
      status: IntegrationStatus.CONNECTED,
      displayName: dto.displayName || profile.verified_name || profile.display_phone_number || "WhatsApp",
      accessTokenCiphertext: this.encryptSecret(dto.accessToken),
      scopes: ["whatsapp_business_management", "whatsapp_business_messaging"],
      metadata: this.json({
        wabaId: dto.wabaId,
        phoneNumberId: dto.phoneNumberId,
        displayPhoneNumber: profile.display_phone_number || null,
        verifiedName: profile.verified_name || null,
      }),
      errorMessage: null,
    };
    const account = existing
      ? await this.prisma.integrationAccount.update({ where: { id: existing.id }, data: common })
      : await this.prisma.integrationAccount.create({
          data: { companyId, provider: IntegrationProvider.WHATSAPP, externalAccountId: dto.phoneNumberId, ...common },
        });
    await this.prisma.auditLog.create({
      data: { userId, companyId, action: "integration.whatsapp.connected", metadata: this.json({ integrationId: account.id }) },
    });
    return { id: account.id, provider: account.provider, status: account.status, displayName: account.displayName };
  }

  async disconnectIntegration(companyIdInput: string | null | undefined, userId: string, id: string) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    const account = await this.prisma.integrationAccount.findFirst({ where: { id, companyId } });
    if (!account) throw new NotFoundException("Integração não encontrada.");
    await this.prisma.integrationAccount.update({
      where: { id },
      data: { status: IntegrationStatus.DISCONNECTED, accessTokenCiphertext: null, refreshTokenCiphertext: null, errorMessage: null },
    });
    await this.prisma.auditLog.create({
      data: { userId, companyId, action: "integration.disconnected", metadata: this.json({ integrationId: id, provider: account.provider }) },
    });
    return { ok: true };
  }

  private async writeMetric(
    companyId: string,
    metric: MetricKey,
    value: number,
    source: IntegrationProvider,
    externalObjectId?: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    const snapshot = await this.prisma.metricSnapshot.create({
      data: { companyId, metric, value, source, externalObjectId, metadata },
    });
    if (Object.values(GoalMetric).includes(metric as unknown as GoalMetric)) {
      await this.prisma.goal.updateMany({
        where: { companyId, metric: metric as unknown as GoalMetric, status: GoalStatus.ACTIVE },
        data: { currentValue: value },
      });
    }
    return snapshot;
  }

  async createManualMetric(companyIdInput: string | null | undefined, userId: string, dto: CreateMetricDto) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    const source = dto.source || IntegrationProvider.MANUAL;
    const snapshot = await this.writeMetric(companyId, dto.metric, dto.value, source, dto.externalObjectId, this.json({ manual: true }));
    await this.prisma.auditLog.create({
      data: { userId, companyId, action: "metric.manual.created", metadata: this.json({ metric: dto.metric, value: dto.value }) },
    });
    return { ...snapshot, value: Number(snapshot.value) };
  }

  async syncMeta(companyIdInput: string | null | undefined, userId: string) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    const accounts = await this.prisma.integrationAccount.findMany({
      where: { companyId, provider: IntegrationProvider.META_INSTAGRAM, status: IntegrationStatus.CONNECTED },
    });
    if (!accounts.length) throw new BadRequestException("Nenhuma conta profissional do Instagram conectada.");

    const results: Array<{ integrationId: string; ok: boolean; written?: number; error?: string }> = [];
    for (const account of accounts) {
      if (!account.externalAccountId || !account.accessTokenCiphertext) continue;
      const run = await this.prisma.integrationSyncRun.create({ data: { integrationAccountId: account.id, status: SyncStatus.RUNNING } });
      try {
        const token = this.decryptSecret(account.accessTokenCiphertext);
        const profile = await this.externalJson<{ id: string; username?: string; followers_count?: number; media_count?: number }>(
          `https://graph.facebook.com/${this.graphVersion()}/${account.externalAccountId}?fields=id,username,followers_count,media_count&access_token=${encodeURIComponent(token)}`,
        );
        let written = 0;
        if (typeof profile.followers_count === "number") {
          await this.writeMetric(companyId, MetricKey.FOLLOWERS, profile.followers_count, IntegrationProvider.META_INSTAGRAM, account.externalAccountId);
          written += 1;
        }
        if (typeof profile.media_count === "number") {
          await this.writeMetric(companyId, MetricKey.CONTENT_PUBLISHED, profile.media_count, IntegrationProvider.META_INSTAGRAM, account.externalAccountId);
          written += 1;
        }
        const media = await this.externalJson<{ data?: Array<{ id: string; like_count?: number; comments_count?: number }> }>(
          `https://graph.facebook.com/${this.graphVersion()}/${account.externalAccountId}/media?fields=id,like_count,comments_count&limit=25&access_token=${encodeURIComponent(token)}`,
        );
        const items = media.data ?? [];
        const engagements = items.reduce((sum, item) => sum + (item.like_count || 0) + (item.comments_count || 0), 0);
        await this.writeMetric(companyId, MetricKey.ENGAGEMENTS, engagements, IntegrationProvider.META_INSTAGRAM, account.externalAccountId, this.json({ sample: "latest_25_media", items: items.length }));
        written += 1;

        let reach = 0;
        let views = 0;
        let insightSamples = 0;
        for (const item of items.slice(0, 10)) {
          try {
            const insights = await this.externalJson<{ data?: Array<{ name: string; values?: Array<{ value: number }>; total_value?: { value?: number } }> }>(
              `https://graph.facebook.com/${this.graphVersion()}/${item.id}/insights?metric=reach,views&access_token=${encodeURIComponent(token)}`,
            );
            for (const insight of insights.data ?? []) {
              const value = Number(insight.total_value?.value ?? insight.values?.[0]?.value ?? 0);
              if (insight.name === "reach") reach += value;
              if (insight.name === "views") views += value;
            }
            insightSamples += 1;
          } catch {
            // A disponibilidade de insights depende do tipo de mídia e permissões da conta.
          }
        }
        if (insightSamples > 0) {
          await this.writeMetric(companyId, MetricKey.REACH, reach, IntegrationProvider.META_INSTAGRAM, account.externalAccountId, this.json({ sample: `latest_${insightSamples}_media` }));
          await this.writeMetric(companyId, MetricKey.VIEWS, views, IntegrationProvider.META_INSTAGRAM, account.externalAccountId, this.json({ sample: `latest_${insightSamples}_media` }));
          written += 2;
        }

        await this.prisma.integrationAccount.update({
          where: { id: account.id },
          data: { lastSyncedAt: new Date(), errorMessage: null, username: profile.username || account.username },
        });
        await this.prisma.integrationSyncRun.update({
          where: { id: run.id },
          data: { status: SyncStatus.SUCCESS, recordsRead: items.length + 1, recordsWritten: written, finishedAt: new Date() },
        });
        results.push({ integrationId: account.id, ok: true, written });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Falha desconhecida";
        await this.prisma.integrationAccount.update({ where: { id: account.id }, data: { errorMessage: message } });
        await this.prisma.integrationSyncRun.update({
          where: { id: run.id },
          data: { status: SyncStatus.FAILED, errorMessage: message, finishedAt: new Date() },
        });
        results.push({ integrationId: account.id, ok: false, error: message });
      }
    }
    await this.prisma.auditLog.create({
      data: { userId, companyId, action: "integration.meta.synced", metadata: this.json({ accounts: results.length }) },
    });
    return { results };
  }

  async metricsSummary(companyIdInput: string | null | undefined, days = 30) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    const safeDays = Math.max(1, Math.min(Number.isFinite(days) ? days : 30, 365));
    const since = new Date(Date.now() - safeDays * 86_400_000);
    const snapshots = await this.prisma.metricSnapshot.findMany({
      where: { companyId, capturedAt: { gte: since } },
      orderBy: { capturedAt: "asc" },
    });
    const grouped = new Map<MetricKey, typeof snapshots>();
    for (const snapshot of snapshots) grouped.set(snapshot.metric, [...(grouped.get(snapshot.metric) ?? []), snapshot]);
    const metrics = Array.from(grouped.entries()).map(([metric, points]) => {
      const firstPoint = points[0]!;
      const latestPoint = points[points.length - 1]!;
      const first = Number(firstPoint.value);
      const latest = Number(latestPoint.value);
      return {
        metric,
        latest,
        first,
        delta: Number((latest - first).toFixed(2)),
        points: points.length,
        source: latestPoint.source,
        updatedAt: latestPoint.capturedAt,
      };
    });
    return { days: safeDays, metrics };
  }

  async metricHistory(companyIdInput: string | null | undefined, metric: MetricKey, days = 30) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    const safeDays = Math.max(1, Math.min(Number.isFinite(days) ? days : 30, 365));
    const points = await this.prisma.metricSnapshot.findMany({
      where: { companyId, metric, capturedAt: { gte: new Date(Date.now() - safeDays * 86_400_000) } },
      orderBy: { capturedAt: "asc" },
      select: { id: true, value: true, source: true, capturedAt: true, metadata: true },
    });
    return points.map((point) => ({ ...point, value: Number(point.value) }));
  }

  async listContent(companyIdInput: string | null | undefined) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    return this.prisma.contentItem.findMany({
      where: { companyId },
      include: { campaign: { select: { id: true, name: true } } },
      orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
    });
  }

  async createContent(companyIdInput: string | null | undefined, userId: string, dto: CreateContentDto) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    if (dto.campaignId) {
      const campaign = await this.prisma.campaign.findFirst({ where: { id: dto.campaignId, companyId } });
      if (!campaign) throw new NotFoundException("Campanha não encontrada.");
    }
    const item = await this.prisma.contentItem.create({
      data: {
        companyId,
        campaignId: dto.campaignId,
        title: dto.title.trim(),
        type: dto.type,
        channel: dto.channel,
        hook: dto.hook?.trim(),
        script: dto.script?.trim(),
        caption: dto.caption?.trim(),
        cta: dto.cta?.trim(),
      },
    });
    await this.prisma.auditLog.create({
      data: { userId, companyId, action: "content.created", metadata: this.json({ contentId: item.id, type: item.type }) },
    });
    return item;
  }

  async generateContentPlan(companyIdInput: string | null | undefined, userId: string, campaignId: string) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    const campaign = await this.prisma.campaign.findFirst({ where: { id: campaignId, companyId } });
    if (!campaign) throw new NotFoundException("Campanha não encontrada.");
    const existing = await this.prisma.contentItem.findMany({ where: { companyId, campaignId } });
    const targetPlan: Array<{ type: ContentType; target: number; prefix: string }> = [
      { type: ContentType.REEL, target: campaign.plannedReels, prefix: "Reel" },
      { type: ContentType.POST, target: campaign.plannedPosts, prefix: "Post" },
      { type: ContentType.STORY, target: campaign.plannedStories, prefix: "Story" },
    ];
    const data: Prisma.ContentItemCreateManyInput[] = [];
    for (const plan of targetPlan) {
      const existingCount = existing.filter((item) => item.type === plan.type).length;
      for (let index = existingCount; index < plan.target; index += 1) {
        data.push({
          companyId,
          campaignId,
          type: plan.type,
          status: ContentStatus.IDEA,
          title: `${plan.prefix} ${index + 1} · ${campaign.name}`,
          hook: campaign.notes || "Comece por uma dúvida real do cliente e entregue a resposta rapidamente.",
          cta: campaign.objective === "WHATSAPP" ? "Chame no WhatsApp para tirar sua dúvida ou pedir orçamento." : "Salve e compartilhe este conteúdo.",
          channel: campaign.channel,
        });
      }
    }
    if (data.length) await this.prisma.contentItem.createMany({ data });
    await this.prisma.auditLog.create({
      data: { userId, companyId, action: "content.plan.generated", metadata: this.json({ campaignId, created: data.length }) },
    });
    return { created: data.length, totalPlanned: campaign.plannedReels + campaign.plannedPosts + campaign.plannedStories };
  }

  async updateContent(companyIdInput: string | null | undefined, userId: string, id: string, dto: UpdateContentDto) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    const existing = await this.prisma.contentItem.findFirst({ where: { id, companyId } });
    if (!existing) throw new NotFoundException("Conteúdo não encontrado.");
    const item = await this.prisma.contentItem.update({
      where: { id },
      data: {
        status: dto.status,
        title: dto.title?.trim(),
        hook: dto.hook?.trim(),
        script: dto.script?.trim(),
        caption: dto.caption?.trim(),
        cta: dto.cta?.trim(),
        publishedAt: dto.status === ContentStatus.PUBLISHED ? new Date() : undefined,
      },
    });
    await this.prisma.auditLog.create({
      data: { userId, companyId, action: "content.updated", metadata: this.json({ contentId: id, fields: Object.keys(dto) }) },
    });
    return item;
  }

  async listRecommendations(companyIdInput: string | null | undefined, includeHistory = false) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    const items = await this.prisma.recommendation.findMany({
      where: {
        companyId,
        ...(includeHistory ? {} : { status: RecommendationStatus.OPEN }),
      },
      orderBy: [{ impactScore: "desc" }, { generatedAt: "desc" }],
    });
    return items.map((item) => ({ ...item, confidence: Number(item.confidence) }));
  }

  async generateRecommendations(companyIdInput: string | null | undefined, userId?: string) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    await this.prisma.recommendation.deleteMany({ where: { companyId, status: RecommendationStatus.OPEN } });
    const [integrations, campaigns, goals, content] = await Promise.all([
      this.prisma.integrationAccount.findMany({ where: { companyId, status: IntegrationStatus.CONNECTED } }),
      this.prisma.campaign.findMany({ where: { companyId, status: CampaignStatus.ACTIVE } }),
      this.prisma.goal.findMany({ where: { companyId, status: GoalStatus.ACTIVE } }),
      this.prisma.contentItem.findMany({ where: { companyId } }),
    ]);
    const recommendations: Prisma.RecommendationCreateManyInput[] = [];
    if (!integrations.some((item) => item.provider === IntegrationProvider.META_INSTAGRAM)) {
      recommendations.push({
        companyId,
        type: RecommendationType.CHANNEL,
        title: "Conecte o Instagram profissional",
        rationale: "Sem a integração oficial, alcance, seguidores e desempenho de conteúdo continuam sem leitura automática.",
        actionText: "Conectar Meta / Instagram em Integrações.",
        confidence: 1,
        impactScore: 95,
        evidence: this.json({ source: "integration_status", metaConnected: false }),
      });
    }
    const whatsappGoal = goals.some((goal) => goal.metric === GoalMetric.WHATSAPP_CONVERSATIONS);
    const hasWhatsapp = integrations.some((item) => item.provider === IntegrationProvider.WHATSAPP);
    if (whatsappGoal && !hasWhatsapp) {
      recommendations.push({
        companyId,
        type: RecommendationType.CHANNEL,
        title: "Conecte o WhatsApp para medir conversas reais",
        rationale: "Existe meta de conversas no WhatsApp, mas a fonte oficial ainda não está conectada.",
        actionText: "Adicionar a Cloud API oficial na tela de Integrações.",
        confidence: 1,
        impactScore: 100,
        evidence: this.json({ whatsappGoal: true, whatsappConnected: false }),
      });
    }
    for (const campaign of campaigns) {
      const planned = campaign.plannedReels + campaign.plannedPosts + campaign.plannedStories;
      const created = content.filter((item) => item.campaignId === campaign.id).length;
      if (planned > 0 && created < planned) {
        recommendations.push({
          companyId,
          type: RecommendationType.FREQUENCY,
          title: `Complete o calendário de ${campaign.name}`,
          rationale: `${created} de ${planned} conteúdos planejados já estão estruturados.`,
          actionText: "Gerar os itens restantes do plano de conteúdo.",
          confidence: 0.98,
          impactScore: 80,
          evidence: this.json({ campaignId: campaign.id, planned, created }),
        });
      }
    }
    const now = Date.now();
    for (const goal of goals) {
      const target = Number(goal.targetValue);
      const current = Number(goal.currentValue);
      const totalWindow = Math.max(1, goal.targetDate.getTime() - goal.createdAt.getTime());
      const elapsed = Math.max(0, Math.min(totalWindow, now - goal.createdAt.getTime()));
      const expected = target * (elapsed / totalWindow);
      if (expected > 0 && current < expected * 0.8) {
        recommendations.push({
          companyId,
          type: RecommendationType.GOAL,
          title: `Meta em ritmo abaixo do esperado: ${goal.name}`,
          rationale: `O valor atual é ${current}, enquanto o ritmo proporcional indica aproximadamente ${expected.toFixed(1)}.`,
          actionText: goal.metric === GoalMetric.WHATSAPP_CONVERSATIONS
            ? "Reforce CTA para WhatsApp e aumente a frequência dos conteúdos que geram intenção."
            : "Revise frequência, formato e distribuição do conteúdo ligado a esta meta.",
          confidence: 0.85,
          impactScore: 90,
          evidence: this.json({ goalId: goal.id, current, expected: Number(expected.toFixed(2)), target }),
        });
      }
    }
    if (!recommendations.length) {
      recommendations.push({
        companyId,
        type: RecommendationType.CONTENT,
        title: "Operação dentro do planejado",
        rationale: "Nenhum desvio determinístico relevante foi identificado com os dados disponíveis.",
        actionText: "Continue alimentando dados reais para aumentar a qualidade das decisões.",
        confidence: 0.7,
        impactScore: 20,
        evidence: this.json({ campaigns: campaigns.length, goals: goals.length, integrations: integrations.length }),
      });
    }
    await this.prisma.recommendation.createMany({ data: recommendations });
    if (userId) {
      await this.prisma.auditLog.create({
        data: { userId, companyId, action: "recommendations.generated", metadata: this.json({ count: recommendations.length }) },
      });
    }
    return this.listRecommendations(companyId);
  }

  async updateRecommendation(companyIdInput: string | null | undefined, userId: string, id: string, dto: UpdateRecommendationDto) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    const existing = await this.prisma.recommendation.findFirst({ where: { id, companyId } });
    if (!existing) throw new NotFoundException("Recomendação não encontrada.");
    const item = await this.prisma.recommendation.update({
      where: { id },
      data: { status: dto.status, appliedAt: dto.status === RecommendationStatus.APPLIED ? new Date() : null },
    });
    await this.prisma.auditLog.create({
      data: { userId, companyId, action: "recommendation.updated", metadata: this.json({ recommendationId: id, status: dto.status }) },
    });
    return { ...item, confidence: Number(item.confidence) };
  }

  async listExperiments(companyIdInput: string | null | undefined) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    const experiments = await this.prisma.experiment.findMany({
      where: { companyId },
      include: { variants: { orderBy: { key: "asc" } }, campaign: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
    return experiments.map((experiment) => ({
      ...experiment,
      variants: experiment.variants.map((variant) => ({ ...variant, metricValue: Number(variant.metricValue) })),
    }));
  }

  async createExperiment(companyIdInput: string | null | undefined, userId: string, dto: CreateExperimentDto) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    if (dto.campaignId) {
      const campaign = await this.prisma.campaign.findFirst({ where: { id: dto.campaignId, companyId } });
      if (!campaign) throw new NotFoundException("Campanha não encontrada.");
    }
    const experiment = await this.prisma.experiment.create({
      data: {
        companyId,
        campaignId: dto.campaignId,
        name: dto.name.trim(),
        hypothesis: dto.hypothesis.trim(),
        metric: dto.metric,
        variants: { create: dto.variants.map((label, index) => ({ key: String.fromCharCode(65 + index), label: label.trim() })) },
      },
      include: { variants: true },
    });
    await this.prisma.auditLog.create({
      data: { userId, companyId, action: "experiment.created", metadata: this.json({ experimentId: experiment.id }) },
    });
    return experiment;
  }

  async updateExperiment(companyIdInput: string | null | undefined, userId: string, id: string, dto: UpdateExperimentDto) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    const existing = await this.prisma.experiment.findFirst({ where: { id, companyId }, include: { variants: true } });
    if (!existing) throw new NotFoundException("Experimento não encontrado.");
    if (dto.variantId) {
      const variant = existing.variants.find((item) => item.id === dto.variantId);
      if (!variant) throw new NotFoundException("Variante não encontrada neste experimento.");
      await this.prisma.experimentVariant.update({
        where: { id: variant.id },
        data: { sampleSize: dto.sampleSize, metricValue: dto.metricValue },
      });
    }
    let winnerKey: string | undefined;
    if (dto.status === ExperimentStatus.COMPLETED) {
      const variants = await this.prisma.experimentVariant.findMany({ where: { experimentId: id } });
      const eligible = variants.filter((variant) => variant.sampleSize > 0).sort((a, b) => Number(b.metricValue) - Number(a.metricValue));
      winnerKey = eligible[0]?.key;
    }
    const experiment = await this.prisma.experiment.update({
      where: { id },
      data: {
        status: dto.status,
        startedAt: dto.status === ExperimentStatus.RUNNING && !existing.startedAt ? new Date() : undefined,
        endedAt: dto.status === ExperimentStatus.COMPLETED ? new Date() : undefined,
        winnerKey,
      },
      include: { variants: true },
    });
    await this.prisma.auditLog.create({
      data: { userId, companyId, action: "experiment.updated", metadata: this.json({ experimentId: id, status: dto.status || existing.status }) },
    });
    return {
      ...experiment,
      variants: experiment.variants.map((variant) => ({ ...variant, metricValue: Number(variant.metricValue) })),
    };
  }

  async getAutopilot(companyIdInput: string | null | undefined) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    return this.prisma.autopilotPolicy.upsert({
      where: { companyId },
      update: {},
      create: { companyId, mode: AutopilotMode.SAFE, enabled: false, killSwitch: true, allowBudgetChanges: false },
    });
  }

  async updateAutopilot(companyIdInput: string | null | undefined, userId: string, dto: UpdateAutopilotDto) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    const current = await this.getAutopilot(companyId);
    const policy = await this.prisma.autopilotPolicy.update({
      where: { companyId },
      data: {
        mode: dto.mode,
        enabled: dto.enabled,
        killSwitch: dto.killSwitch,
        allowPublishing: dto.allowPublishing,
        allowReplies: dto.allowReplies,
        maxActionsPerDay: dto.maxActionsPerDay,
        allowBudgetChanges: false,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId,
        companyId,
        action: "autopilot.policy.updated",
        metadata: this.json({
          before: { mode: current.mode, enabled: current.enabled, killSwitch: current.killSwitch },
          after: { mode: policy.mode, enabled: policy.enabled, killSwitch: policy.killSwitch },
        }),
      },
    });
    return policy;
  }

  async runAutopilot(companyIdInput: string | null | undefined, userId: string) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    const policy = await this.getAutopilot(companyId);
    if (!policy.enabled || policy.killSwitch) {
      return { executed: false, reason: policy.killSwitch ? "KILL_SWITCH_ACTIVE" : "AUTOPILOT_DISABLED", policy };
    }
    const recommendations = await this.generateRecommendations(companyId);
    const actions = recommendations
      .filter((item) => item.status === RecommendationStatus.OPEN)
      .slice(0, policy.maxActionsPerDay)
      .map((item) => ({ recommendationId: item.id, action: "RECOMMEND_ONLY", title: item.title }));
    await this.prisma.auditLog.create({
      data: { userId, companyId, action: "autopilot.run", metadata: this.json({ mode: policy.mode, actions, externalActions: 0 }) },
    });
    return { executed: true, mode: policy.mode, actions, externalActions: 0 };
  }

  async listLeads(companyIdInput: string | null | undefined) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    return this.prisma.lead.findMany({
      where: { companyId },
      include: { _count: { select: { conversations: true } } },
      orderBy: { updatedAt: "desc" },
    });
  }

  async leadSummary(companyIdInput: string | null | undefined) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    const leads = await this.prisma.lead.findMany({ where: { companyId }, select: { stage: true, source: true } });
    const byStage = Object.fromEntries(Object.values(LeadStage).map((stage) => [stage, leads.filter((lead) => lead.stage === stage).length]));
    const bySource = Object.fromEntries(Object.values(LeadSource).map((source) => [source, leads.filter((lead) => lead.source === source).length]));
    return { total: leads.length, byStage, bySource };
  }

  async createLead(companyIdInput: string | null | undefined, userId: string, dto: CreateLeadDto) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    const lead = await this.prisma.lead.create({
      data: {
        companyId,
        name: dto.name?.trim(),
        phone: dto.phone?.trim(),
        email: dto.email?.trim().toLowerCase(),
        source: dto.source,
        campaignTag: dto.campaignTag?.trim(),
        notes: dto.notes?.trim(),
      },
    });
    await this.prisma.auditLog.create({
      data: { userId, companyId, action: "lead.created", metadata: this.json({ leadId: lead.id, source: lead.source }) },
    });
    return lead;
  }

  async updateLead(companyIdInput: string | null | undefined, userId: string, id: string, dto: UpdateLeadDto) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    const existing = await this.prisma.lead.findFirst({ where: { id, companyId } });
    if (!existing) throw new NotFoundException("Lead não encontrado.");
    const lead = await this.prisma.lead.update({
      where: { id },
      data: {
        stage: dto.stage,
        name: dto.name?.trim(),
        phone: dto.phone?.trim(),
        email: dto.email?.trim().toLowerCase(),
        notes: dto.notes?.trim(),
      },
    });
    await this.prisma.auditLog.create({
      data: { userId, companyId, action: "lead.updated", metadata: this.json({ leadId: id, fields: Object.keys(dto) }) },
    });
    return lead;
  }

  verifyWhatsappChallenge(mode?: string, token?: string, challenge?: string) {
    const expected = process.env.WHATSAPP_VERIFY_TOKEN;
    if (mode !== "subscribe" || !expected || token !== expected || !challenge) {
      throw new ForbiddenException("Falha na verificação do webhook do WhatsApp.");
    }
    return challenge;
  }

  verifyWhatsappSignature(rawBody: Buffer | undefined, signature?: string) {
    const secret = process.env.META_APP_SECRET;
    if (!secret) throw new ServiceUnavailableException("META_APP_SECRET é obrigatório para validar o webhook.");
    if (!rawBody || !signature?.startsWith("sha256=")) throw new ForbiddenException("Assinatura do webhook ausente.");
    const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
    const providedBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
      throw new ForbiddenException("Assinatura do webhook inválida.");
    }
  }

  async receiveWhatsappWebhook(payload: any) {
    const entries = Array.isArray(payload?.entry) ? payload.entry : [];
    let messagesProcessed = 0;
    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of changes) {
        const value = change?.value;
        const phoneNumberId = typeof value?.metadata?.phone_number_id === "string" ? value.metadata.phone_number_id : undefined;
        if (!phoneNumberId) continue;
        const integration = await this.prisma.integrationAccount.findFirst({
          where: { provider: IntegrationProvider.WHATSAPP, externalAccountId: phoneNumberId, status: IntegrationStatus.CONNECTED },
        });
        if (!integration) continue;
        const messages = Array.isArray(value?.messages) ? value.messages : [];
        const contacts = Array.isArray(value?.contacts) ? value.contacts : [];
        for (const message of messages) {
          const phone = String(message?.from || "").trim();
          if (!phone) continue;
          const contact = contacts.find((candidate: any) => candidate?.wa_id === phone);
          const profileName = typeof contact?.profile?.name === "string" ? contact.profile.name : undefined;
          let lead = await this.prisma.lead.findFirst({ where: { companyId: integration.companyId, phone } });
          if (!lead) {
            lead = await this.prisma.lead.create({
              data: { companyId: integration.companyId, phone, name: profileName, source: LeadSource.WHATSAPP, externalId: phone },
            });
          } else if (!lead.name && profileName) {
            lead = await this.prisma.lead.update({ where: { id: lead.id }, data: { name: profileName } });
          }

          const cutoff = new Date(Date.now() - 24 * 60 * 60_000);
          const conversation = await this.prisma.conversation.findFirst({
            where: { companyId: integration.companyId, leadId: lead.id, source: LeadSource.WHATSAPP, lastMessageAt: { gte: cutoff } },
            orderBy: { lastMessageAt: "desc" },
          });
          if (conversation) {
            await this.prisma.conversation.update({
              where: { id: conversation.id },
              data: { lastMessageAt: new Date(), messageCount: { increment: 1 }, externalId: message?.id || conversation.externalId },
            });
          } else {
            await this.prisma.conversation.create({
              data: { companyId: integration.companyId, leadId: lead.id, source: LeadSource.WHATSAPP, externalId: message?.id, messageCount: 1 },
            });
            const latest = await this.prisma.metricSnapshot.findFirst({
              where: { companyId: integration.companyId, metric: MetricKey.WHATSAPP_CONVERSATIONS },
              orderBy: { capturedAt: "desc" },
            });
            await this.writeMetric(
              integration.companyId,
              MetricKey.WHATSAPP_CONVERSATIONS,
              Number(latest?.value || 0) + 1,
              IntegrationProvider.WHATSAPP,
              phoneNumberId,
              this.json({ source: "webhook", leadId: lead.id }),
            );
          }
          messagesProcessed += 1;
        }
      }
    }
    return { ok: true, messagesProcessed };
  }
}
