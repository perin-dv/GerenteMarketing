import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import {
  AutopilotMode,
  CampaignChannel,
  CampaignMode,
  CampaignObjective,
  CampaignStatus,
  ContentStatus,
  ContentType,
  IntegrationProvider,
  IntegrationStatus,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { CreateAutoCampaignDto } from "./auto-campaign.dto";

@Injectable()
export class AutoCampaignService {
  constructor(private readonly prisma: PrismaService) {}

  private companyIdOrThrow(companyId: string | null | undefined) {
    if (!companyId) throw new ForbiddenException("Nenhuma empresa ativa na sessão.");
    return companyId;
  }

  private object(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private json(value: unknown): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }

  private normalizeTag(value: string) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .trim();
  }

  private topicHashtags(topic: string) {
    const base = topic
      .split(/\s+/)
      .map((word) => this.normalizeTag(word))
      .filter((word) => word.length >= 3)
      .slice(0, 5)
      .map((word) => `#${word.charAt(0).toUpperCase()}${word.slice(1)}`);
    const lower = topic.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (/(carro|autopec|peca|automot|farol|lampad)/.test(lower)) {
      base.push("#Autopecas", "#PecasAutomotivas", "#DicasAutomotivas");
    }
    return Array.from(new Map(base.map((tag) => [tag.toLowerCase(), tag])).values()).slice(0, 7);
  }

  private async learnedHashtags(companyId: string) {
    const published = await this.prisma.contentItem.findMany({
      where: { companyId, status: ContentStatus.PUBLISHED },
      select: { metadata: true },
      orderBy: { publishedAt: "desc" },
      take: 100,
    });
    const scores = new Map<string, { hashtag: string; score: number }>();
    for (const item of published) {
      const metadata = this.object(item.metadata);
      const performance = this.object(metadata.metaPerformance);
      const tags = Array.isArray(performance.hashtags)
        ? performance.hashtags.filter((tag): tag is string => typeof tag === "string")
        : [];
      const score = Number(performance.engagements || 0) * 10
        + Number(performance.reach || 0)
        + Number(performance.views || 0) * 0.25;
      for (const hashtag of tags) {
        const key = hashtag.toLocaleLowerCase("pt-BR");
        const current = scores.get(key) || { hashtag, score: 0 };
        current.score += score;
        scores.set(key, current);
      }
    }
    return Array.from(scores.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((item) => item.hashtag);
  }

  private async preferredHours(companyId: string, timezone: string) {
    const published = await this.prisma.contentItem.findMany({
      where: { companyId, status: ContentStatus.PUBLISHED, publishedAt: { not: null } },
      select: { publishedAt: true, metadata: true },
      orderBy: { publishedAt: "desc" },
      take: 100,
    });
    const byHour = new Map<number, { score: number; samples: number }>();
    const formatter = new Intl.DateTimeFormat("pt-BR", {
      timeZone: timezone,
      hour: "2-digit",
      hourCycle: "h23",
    });
    for (const item of published) {
      if (!item.publishedAt) continue;
      const metadata = this.object(item.metadata);
      const performance = this.object(metadata.metaPerformance);
      const score = Number(performance.engagements || 0) * 10
        + Number(performance.reach || 0)
        + Number(performance.views || 0) * 0.25;
      if (score <= 0) continue;
      const hour = Number(formatter.format(item.publishedAt));
      if (!Number.isFinite(hour)) continue;
      const current = byHour.get(hour) || { score: 0, samples: 0 };
      current.score += score;
      current.samples += 1;
      byHour.set(hour, current);
    }
    const learned = Array.from(byHour.entries())
      .filter(([, value]) => value.samples >= 1)
      .sort((a, b) => (b[1].score / b[1].samples) - (a[1].score / a[1].samples))
      .map(([hour]) => hour)
      .slice(0, 2);
    return learned.length ? learned : [12, 19];
  }

  private zonedDate(date: Date, hour: number, minute: number, timezone: string) {
    const utcGuess = Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      hour,
      minute,
      0,
      0,
    );
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(utcGuess));
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
    const representedAsUtc = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour"),
      get("minute"),
      get("second"),
    );
    const offsetMs = representedAsUtc - utcGuess;
    return new Date(utcGuess - offsetMs);
  }

  private buildCaption(topic: string, objective: CampaignObjective, cta: string, hashtags: string[]) {
    const opening = objective === CampaignObjective.SALES
      ? `${topic}: veja uma opção útil antes de decidir a compra.`
      : objective === CampaignObjective.LEADS || objective === CampaignObjective.WHATSAPP
        ? `${topic}: tire sua dúvida antes de escolher a peça certa.`
        : `${topic}: informação prática para ajudar você a escolher melhor.`;
    return `${opening}\n\n${cta}\n\n${hashtags.join(" ")}`.trim();
  }

  async create(
    companyIdInput: string | null | undefined,
    userId: string,
    dto: CreateAutoCampaignDto,
  ) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new BadRequestException("Empresa não encontrada.");

    const fingerprints = dto.media.map((item) => item.fingerprint.trim().toLowerCase());
    if (new Set(fingerprints).size !== fingerprints.length) {
      throw new BadRequestException("Há arquivos repetidos neste lote. Cada mídia deve entrar apenas uma vez.");
    }

    const previous = await this.prisma.contentItem.findMany({
      where: { companyId },
      select: { metadata: true },
    });
    const usedFingerprints = new Set<string>();
    for (const item of previous) {
      const metadata = this.object(item.metadata);
      const autoMedia = this.object(metadata.autoCampaignMedia);
      if (typeof autoMedia.fingerprint === "string") usedFingerprints.add(autoMedia.fingerprint.toLowerCase());
    }
    const repeated = fingerprints.filter((fingerprint) => usedFingerprints.has(fingerprint));
    if (repeated.length) {
      throw new BadRequestException(
        `Este lote contém ${repeated.length} mídia(s) já usadas em outra publicação automática. O GerenteMarketing não repete o mesmo arquivo.`,
      );
    }

    let integrationId = dto.integrationId?.trim() || undefined;
    if (dto.autoPublish) {
      const integration = integrationId
        ? await this.prisma.integrationAccount.findFirst({
            where: {
              id: integrationId,
              companyId,
              provider: IntegrationProvider.META_INSTAGRAM,
              status: IntegrationStatus.CONNECTED,
            },
          })
        : await this.prisma.integrationAccount.findFirst({
            where: { companyId, provider: IntegrationProvider.META_INSTAGRAM, status: IntegrationStatus.CONNECTED },
            orderBy: { updatedAt: "desc" },
          });
      if (!integration) throw new BadRequestException("Conecte o Instagram antes de ativar publicação automática.");
      integrationId = integration.id;

      await this.prisma.autopilotPolicy.upsert({
        where: { companyId },
        create: {
          companyId,
          mode: AutopilotMode.MANAGED,
          enabled: true,
          killSwitch: false,
          allowPublishing: true,
          allowReplies: false,
          allowBudgetChanges: false,
          maxActionsPerDay: 2,
        },
        update: {
          mode: AutopilotMode.MANAGED,
          enabled: true,
          killSwitch: false,
          allowPublishing: true,
          maxActionsPerDay: { set: 2 },
        },
      });
    }

    const objective = dto.objective ?? CampaignObjective.LEADS;
    const days = dto.days ?? Math.max(7, dto.media.length * 2);
    const start = dto.startDate ? new Date(dto.startDate) : new Date();
    const end = new Date(start.getTime() + Math.max(0, days - 1) * 86_400_000);
    const learnedTags = await this.learnedHashtags(companyId);
    const hashtags = Array.from(new Map([
      ...learnedTags,
      ...this.topicHashtags(dto.topic),
    ].map((tag) => [tag.toLocaleLowerCase("pt-BR"), tag])).values()).slice(0, 10);
    const preferredHours = await this.preferredHours(companyId, company.timezone);
    const cta = dto.cta?.trim() || "Chame no WhatsApp para tirar sua dúvida ou pedir orçamento.";
    const caption = this.buildCaption(dto.topic.trim(), objective, cta, hashtags);
    const videos = dto.media.filter((item) => item.mediaKind === "VIDEO").length;
    const images = dto.media.length - videos;

    const result = await this.prisma.$transaction(async (tx) => {
      const campaign = await tx.campaign.create({
        data: {
          companyId,
          name: dto.campaignName?.trim() || `${dto.topic.trim()} · Automática`,
          mode: CampaignMode.ORGANIC,
          channel: CampaignChannel.INSTAGRAM,
          objective,
          status: CampaignStatus.ACTIVE,
          budgetTotal: 0,
          plannedReels: videos,
          plannedPosts: images,
          plannedStories: 0,
          startDate: start,
          endDate: end,
          notes: `Campanha criada automaticamente. ${dto.media.length} mídia(s) únicas, sem repetição.`,
        },
      });

      const created = [];
      for (let index = 0; index < dto.media.length; index += 1) {
        const media = dto.media[index]!;
        const dayOffset = dto.media.length === 1
          ? 0
          : Math.round((index * Math.max(0, days - 1)) / (dto.media.length - 1));
        const baseDate = new Date(start.getTime() + dayOffset * 86_400_000);
        const hour = preferredHours[index % preferredHours.length]!;
        let scheduledAt = this.zonedDate(baseDate, hour, 0, company.timezone);
        if (scheduledAt.getTime() < Date.now() + 5 * 60_000) {
          const tomorrow = new Date(baseDate.getTime() + 86_400_000);
          scheduledAt = this.zonedDate(tomorrow, hour, 0, company.timezone);
        }
        const type = media.mediaKind === "VIDEO" ? ContentType.REEL : ContentType.POST;
        const item = await tx.contentItem.create({
          data: {
            companyId,
            campaignId: campaign.id,
            type,
            status: dto.autoPublish ? ContentStatus.SCHEDULED : ContentStatus.READY,
            title: `${dto.topic.trim()} · ${type === ContentType.REEL ? "Reel" : "Post"} ${index + 1}`,
            hook: dto.topic.trim(),
            caption,
            cta,
            channel: CampaignChannel.INSTAGRAM,
            scheduledAt,
            metadata: this.json({
              autoCampaignMedia: {
                publicUrl: media.publicUrl,
                mediaKind: media.mediaKind,
                fingerprint: media.fingerprint.toLowerCase(),
                originalName: media.originalName || null,
                integrationId: integrationId || null,
                autoPublish: Boolean(dto.autoPublish),
                neverRepeat: true,
              },
              planning: {
                preferredHour: hour,
                timezone: company.timezone,
                learnedHashtags: learnedTags,
                hashtags,
              },
            }),
          },
        });
        created.push(item);
      }

      await tx.auditLog.create({
        data: {
          userId,
          companyId,
          action: "campaign.auto.created",
          metadata: this.json({
            campaignId: campaign.id,
            media: created.length,
            autoPublish: Boolean(dto.autoPublish),
            preferredHours,
            noRepeat: true,
          }),
        },
      });
      return { campaign, created };
    });

    return {
      ok: true,
      campaign: result.campaign,
      items: result.created.map((item) => ({
        id: item.id,
        title: item.title,
        type: item.type,
        status: item.status,
        scheduledAt: item.scheduledAt,
      })),
      preferredHours,
      hashtags,
      autoPublish: Boolean(dto.autoPublish),
      noRepeat: true,
    };
  }
}
