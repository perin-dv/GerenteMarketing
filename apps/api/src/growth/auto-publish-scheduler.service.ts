import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ContentStatus } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { MetaMediaKind } from "./meta-publishing.dto";
import { MetaPublishingService } from "./meta-publishing.service";

@Injectable()
export class AutoPublishSchedulerService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: MetaPublishingService,
  ) {}

  onModuleInit() {
    if (String(process.env.AUTO_PUBLISH_SCHEDULER || "true").toLowerCase() === "false") return;
    this.timer = setInterval(() => void this.tick(), 60_000);
    this.timer.unref();
    setTimeout(() => void this.tick(), 8_000).unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private object(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const due = await this.prisma.contentItem.findMany({
        where: {
          status: ContentStatus.SCHEDULED,
          scheduledAt: { lte: new Date() },
        },
        include: {
          company: { include: { autopilotPolicy: true } },
        },
        orderBy: { scheduledAt: "asc" },
        take: 20,
      });

      for (const item of due) {
        const policy = item.company.autopilotPolicy;
        if (!policy?.enabled || policy.killSwitch || !policy.allowPublishing) continue;

        const metadata = this.object(item.metadata);
        const media = this.object(metadata.autoCampaignMedia);
        if (media.autoPublish !== true) continue;
        const mediaUrl = typeof media.publicUrl === "string" ? media.publicUrl : "";
        const mediaKind = media.mediaKind === "VIDEO" ? MetaMediaKind.VIDEO
          : media.mediaKind === "IMAGE" ? MetaMediaKind.IMAGE
            : undefined;
        if (!mediaUrl || !mediaKind) continue;

        const publishedLast24h = await this.prisma.auditLog.count({
          where: {
            companyId: item.companyId,
            action: "content.meta.published",
            createdAt: { gte: new Date(Date.now() - 86_400_000) },
          },
        });
        if (publishedLast24h >= policy.maxActionsPerDay) continue;

        const claimed = await this.prisma.contentItem.updateMany({
          where: { id: item.id, status: ContentStatus.SCHEDULED },
          data: { status: ContentStatus.READY },
        });
        if (claimed.count !== 1) continue;

        try {
          await this.publisher.publish(item.companyId, null, item.id, {
            mediaUrl,
            mediaKind,
            integrationId: typeof media.integrationId === "string" && media.integrationId ? media.integrationId : undefined,
            caption: item.caption || undefined,
            shareToFeed: true,
          });
        } catch (error) {
          console.error("auto_publish_failed", {
            contentId: item.id,
            message: error instanceof Error ? error.message : "unknown",
          });
        }
      }
    } catch (error) {
      console.error("auto_publish_scheduler_failed", error instanceof Error ? error.message : error);
    } finally {
      this.running = false;
    }
  }
}
