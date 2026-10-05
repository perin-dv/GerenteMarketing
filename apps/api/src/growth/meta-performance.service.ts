import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  ContentStatus,
  IntegrationProvider,
  IntegrationStatus,
  Prisma,
} from "@prisma/client";
import { createDecipheriv } from "node:crypto";
import { PrismaService } from "../prisma.service";

type Insight = {
  name?: string;
  values?: Array<{ value?: number }>;
  total_value?: { value?: number };
};

type PerformanceRecord = {
  contentId: string;
  title: string;
  type: string;
  mediaId: string;
  permalink: string | null;
  caption: string;
  hashtags: string[];
  likes: number;
  comments: number;
  engagements: number;
  reach: number;
  views: number;
  engagementRate: number | null;
  publishedAt: Date | null;
  syncedAt: string;
};

@Injectable()
export class MetaPerformanceService {
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
      throw new ServiceUnavailableException("INTEGRATION_ENCRYPTION_KEY inválida.");
    }
    return key;
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

  private object(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private async externalJson<T>(url: string): Promise<T> {
    const response = await fetch(url);
    const text = await response.text();
    let data: any = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    if (!response.ok) {
      const detail = data?.error?.message || text || `HTTP ${response.status}`;
      throw new BadRequestException(`Meta recusou a leitura de desempenho: ${String(detail).slice(0, 500)}`);
    }
    return data as T;
  }

  private extractHashtags(caption: string) {
    const matches = caption.match(/#[A-Za-zÀ-ÖØ-öø-ÿ0-9_]+/g) || [];
    const unique = new Map<string, string>();
    for (const tag of matches) unique.set(tag.toLocaleLowerCase("pt-BR"), tag);
    return Array.from(unique.values()).slice(0, 30);
  }

  private insightValue(insights: Insight[], name: string) {
    const insight = insights.find((item) => item.name === name);
    if (!insight) return 0;
    return Number(insight.total_value?.value ?? insight.values?.[0]?.value ?? 0) || 0;
  }

  async sync(companyIdInput: string | null | undefined, userId: string) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    const [items, integrations] = await Promise.all([
      this.prisma.contentItem.findMany({
        where: {
          companyId,
          status: ContentStatus.PUBLISHED,
          externalId: { not: null },
        },
        orderBy: { publishedAt: "desc" },
        take: 50,
      }),
      this.prisma.integrationAccount.findMany({
        where: {
          companyId,
          provider: IntegrationProvider.META_INSTAGRAM,
          status: IntegrationStatus.CONNECTED,
        },
      }),
    ]);

    if (!integrations.length) throw new BadRequestException("Nenhuma conta profissional do Instagram conectada.");
    if (!items.length) return { ok: true, processed: 0, updated: 0, failed: 0 };

    const integrationById = new Map(integrations.map((item) => [item.id, item]));
    const tokenCache = new Map<string, string>();
    let updated = 0;
    let failed = 0;

    for (const item of items) {
      if (!item.externalId) continue;
      const metadata = this.object(item.metadata);
      const publishing = this.object(metadata.metaPublishing);
      const requestedIntegration = typeof publishing.integrationId === "string"
        ? integrationById.get(publishing.integrationId)
        : undefined;
      const integration = requestedIntegration || integrations[0];
      if (!integration?.accessTokenCiphertext) {
        failed += 1;
        continue;
      }

      try {
        let token = tokenCache.get(integration.id);
        if (!token) {
          token = this.decryptSecret(integration.accessTokenCiphertext);
          tokenCache.set(integration.id, token);
        }

        const mediaId = encodeURIComponent(item.externalId);
        const media = await this.externalJson<{
          id?: string;
          caption?: string;
          media_type?: string;
          media_product_type?: string;
          permalink?: string;
          timestamp?: string;
          like_count?: number;
          comments_count?: number;
        }>(
          `https://graph.facebook.com/${this.graphVersion()}/${mediaId}?fields=id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count&access_token=${encodeURIComponent(token)}`,
        );

        let insights: Insight[] = [];
        try {
          const result = await this.externalJson<{ data?: Insight[] }>(
            `https://graph.facebook.com/${this.graphVersion()}/${mediaId}/insights?metric=reach,views&access_token=${encodeURIComponent(token)}`,
          );
          insights = result.data || [];
        } catch {
          // Nem todo formato disponibiliza os mesmos insights. Likes e comentários continuam válidos.
        }

        const likes = Number(media.like_count || 0);
        const comments = Number(media.comments_count || 0);
        const engagements = likes + comments;
        const reach = this.insightValue(insights, "reach");
        const views = this.insightValue(insights, "views");
        const caption = String(media.caption || item.caption || "");
        const hashtags = this.extractHashtags(caption);
        const engagementRate = reach > 0 ? Number(((engagements / reach) * 100).toFixed(2)) : null;
        const syncedAt = new Date().toISOString();

        const performance = {
          integrationId: integration.id,
          mediaId: item.externalId,
          permalink: media.permalink || null,
          mediaType: media.media_type || null,
          mediaProductType: media.media_product_type || null,
          caption,
          hashtags,
          likes,
          comments,
          engagements,
          reach,
          views,
          engagementRate,
          syncedAt,
        };

        await this.prisma.contentItem.update({
          where: { id: item.id },
          data: { metadata: this.json({ ...metadata, metaPerformance: performance }) },
        });
        updated += 1;
      } catch {
        failed += 1;
      }
    }

    await this.prisma.auditLog.create({
      data: {
        userId,
        companyId,
        action: "content.meta.performance_synced",
        metadata: this.json({ processed: items.length, updated, failed }),
      },
    });

    return { ok: true, processed: items.length, updated, failed };
  }

  async summary(companyIdInput: string | null | undefined) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    const items = await this.prisma.contentItem.findMany({
      where: { companyId, status: ContentStatus.PUBLISHED, externalId: { not: null } },
      orderBy: { publishedAt: "desc" },
      take: 100,
    });

    const records: PerformanceRecord[] = [];
    for (const item of items) {
      if (!item.externalId) continue;
      const metadata = this.object(item.metadata);
      const performance = this.object(metadata.metaPerformance);
      if (!performance.syncedAt) continue;
      records.push({
        contentId: item.id,
        title: item.title,
        type: item.type,
        mediaId: item.externalId,
        permalink: typeof performance.permalink === "string" ? performance.permalink : null,
        caption: typeof performance.caption === "string" ? performance.caption : "",
        hashtags: Array.isArray(performance.hashtags)
          ? performance.hashtags.filter((tag): tag is string => typeof tag === "string")
          : [],
        likes: Number(performance.likes || 0),
        comments: Number(performance.comments || 0),
        engagements: Number(performance.engagements || 0),
        reach: Number(performance.reach || 0),
        views: Number(performance.views || 0),
        engagementRate: performance.engagementRate === null || performance.engagementRate === undefined
          ? null
          : Number(performance.engagementRate),
        publishedAt: item.publishedAt,
        syncedAt: String(performance.syncedAt),
      });
    }

    const hashtagMap = new Map<string, {
      hashtag: string;
      posts: number;
      reach: number;
      views: number;
      engagements: number;
    }>();

    for (const record of records) {
      for (const hashtag of record.hashtags) {
        const key = hashtag.toLocaleLowerCase("pt-BR");
        const current = hashtagMap.get(key) || { hashtag, posts: 0, reach: 0, views: 0, engagements: 0 };
        current.posts += 1;
        current.reach += record.reach;
        current.views += record.views;
        current.engagements += record.engagements;
        hashtagMap.set(key, current);
      }
    }

    const hashtags = Array.from(hashtagMap.values())
      .map((item) => ({
        ...item,
        engagementRate: item.reach > 0 ? Number(((item.engagements / item.reach) * 100).toFixed(2)) : null,
      }))
      .sort((a, b) => b.engagements - a.engagements || b.reach - a.reach || b.views - a.views)
      .slice(0, 20);

    const topContent = [...records]
      .sort((a, b) => b.engagements - a.engagements || b.reach - a.reach || b.views - a.views)
      .slice(0, 10);

    return {
      syncedContent: records.length,
      totals: {
        reach: records.reduce((sum, item) => sum + item.reach, 0),
        views: records.reduce((sum, item) => sum + item.views, 0),
        engagements: records.reduce((sum, item) => sum + item.engagements, 0),
      },
      topContent,
      hashtags,
      note: "Hashtags ranqueadas pelo desempenho observado nos próprios conteúdos da conta, não por tendência externa presumida.",
    };
  }
}
