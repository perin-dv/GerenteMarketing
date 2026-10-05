import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  CampaignChannel,
  ContentStatus,
  ContentType,
  IntegrationProvider,
  IntegrationStatus,
  Prisma,
} from "@prisma/client";
import { createDecipheriv } from "node:crypto";
import { PrismaService } from "../prisma.service";
import { MetaMediaKind, PublishMetaContentDto } from "./meta-publishing.dto";

@Injectable()
export class MetaPublishingService {
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
    if (key.length !== 32) throw new ServiceUnavailableException("INTEGRATION_ENCRYPTION_KEY inválida.");
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

  private objectMetadata(value: Prisma.JsonValue | null | undefined) {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private async externalJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, init);
    const text = await response.text();
    let data: any = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    if (!response.ok) {
      const detail = data?.error?.message || data?.error?.error_user_msg || text || `HTTP ${response.status}`;
      throw new BadRequestException(`Meta recusou a publicação: ${String(detail).slice(0, 500)}`);
    }
    return data as T;
  }

  private ensurePublicMediaUrl(raw: string) {
    let url: URL;
    try { url = new URL(raw); } catch { throw new BadRequestException("Informe uma URL válida da mídia."); }
    if (url.protocol !== "https:") {
      throw new BadRequestException("A Meta exige uma URL HTTPS pública para a mídia.");
    }
    return url.toString();
  }

  private publicationKind(type: ContentType, dto: PublishMetaContentDto) {
    if (type === ContentType.POST || type === ContentType.IMAGE) return MetaMediaKind.IMAGE;
    if (type === ContentType.REEL || type === ContentType.VIDEO) return MetaMediaKind.VIDEO;
    if (type === ContentType.STORY) {
      if (!dto.mediaKind) throw new BadRequestException("Para Story, informe se a mídia é IMAGE ou VIDEO.");
      return dto.mediaKind;
    }
    throw new BadRequestException("Nesta etapa, a publicação oficial suporta imagem, Reel/vídeo e Story. Carrossel e texto entram no próximo bloco.");
  }

  private async waitForContainer(containerId: string, token: string) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const status = await this.externalJson<{ status_code?: string }>(
        `https://graph.facebook.com/${this.graphVersion()}/${encodeURIComponent(containerId)}?fields=status_code&access_token=${encodeURIComponent(token)}`,
      );
      if (status.status_code === "FINISHED") return;
      if (["ERROR", "EXPIRED"].includes(String(status.status_code || ""))) {
        throw new BadRequestException(`A Meta não conseguiu processar a mídia (${status.status_code}).`);
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    throw new BadRequestException("A Meta ainda está processando a mídia. Tente publicar novamente em alguns segundos.");
  }

  async publish(
    companyIdInput: string | null | undefined,
    userId: string,
    contentId: string,
    dto: PublishMetaContentDto,
  ) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    const item = await this.prisma.contentItem.findFirst({ where: { id: contentId, companyId } });
    if (!item) throw new NotFoundException("Conteúdo não encontrado.");
    if (item.channel !== CampaignChannel.INSTAGRAM && item.channel !== CampaignChannel.MULTICHANNEL) {
      throw new BadRequestException("Este conteúdo não está configurado para Instagram.");
    }

    const integration = dto.integrationId
      ? await this.prisma.integrationAccount.findFirst({
          where: {
            id: dto.integrationId,
            companyId,
            provider: IntegrationProvider.META_INSTAGRAM,
            status: IntegrationStatus.CONNECTED,
          },
        })
      : await this.prisma.integrationAccount.findFirst({
          where: { companyId, provider: IntegrationProvider.META_INSTAGRAM, status: IntegrationStatus.CONNECTED },
          orderBy: { updatedAt: "desc" },
        });

    if (!integration?.externalAccountId || !integration.accessTokenCiphertext) {
      throw new BadRequestException("Conecte uma conta profissional do Instagram antes de publicar.");
    }
    if (!integration.scopes.includes("instagram_content_publish")) {
      throw new BadRequestException("A conta conectada não possui a permissão instagram_content_publish.");
    }

    const mediaUrl = this.ensurePublicMediaUrl(dto.mediaUrl.trim());
    const mediaKind = this.publicationKind(item.type, dto);
    const token = this.decryptSecret(integration.accessTokenCiphertext);
    const caption = (dto.caption?.trim() || [item.caption, item.cta].filter(Boolean).join("\n\n")).slice(0, 2200);
    const previousMetadata = this.objectMetadata(item.metadata);

    try {
      const params = new URLSearchParams({ access_token: token });
      if (caption) params.set("caption", caption);

      if (item.type === ContentType.STORY) {
        params.set("media_type", "STORIES");
        params.set(mediaKind === MetaMediaKind.VIDEO ? "video_url" : "image_url", mediaUrl);
      } else if (mediaKind === MetaMediaKind.VIDEO) {
        params.set("media_type", "REELS");
        params.set("video_url", mediaUrl);
        params.set("share_to_feed", String(dto.shareToFeed ?? true));
      } else {
        params.set("image_url", mediaUrl);
        if (dto.altText?.trim()) params.set("alt_text", dto.altText.trim().slice(0, 1000));
      }

      const container = await this.externalJson<{ id?: string }>(
        `https://graph.facebook.com/${this.graphVersion()}/${encodeURIComponent(integration.externalAccountId)}/media`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: params,
        },
      );
      if (!container.id) throw new BadRequestException("A Meta não retornou o ID do container de mídia.");

      await this.waitForContainer(container.id, token);

      const publishParams = new URLSearchParams({
        creation_id: container.id,
        access_token: token,
      });
      const published = await this.externalJson<{ id?: string }>(
        `https://graph.facebook.com/${this.graphVersion()}/${encodeURIComponent(integration.externalAccountId)}/media_publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: publishParams,
        },
      );
      if (!published.id) throw new BadRequestException("A Meta não retornou o ID da publicação.");

      const updated = await this.prisma.contentItem.update({
        where: { id: item.id },
        data: {
          status: ContentStatus.PUBLISHED,
          externalId: published.id,
          publishedAt: new Date(),
          metadata: this.json({
            ...previousMetadata,
            metaPublishing: {
              integrationId: integration.id,
              instagramAccountId: integration.externalAccountId,
              mediaKind,
              mediaUrl,
              containerId: container.id,
              mediaId: published.id,
              publishedAt: new Date().toISOString(),
            },
          }),
        },
      });

      await this.prisma.auditLog.create({
        data: {
          userId,
          companyId,
          action: "content.meta.published",
          metadata: this.json({ contentId: item.id, integrationId: integration.id, mediaId: published.id }),
        },
      });

      return { ok: true, content: updated, mediaId: published.id, account: integration.username || integration.displayName };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha desconhecida na publicação.";
      await this.prisma.contentItem.update({
        where: { id: item.id },
        data: {
          status: ContentStatus.FAILED,
          metadata: this.json({
            ...previousMetadata,
            metaPublishing: {
              integrationId: integration.id,
              mediaKind,
              mediaUrl,
              failedAt: new Date().toISOString(),
              error: message.slice(0, 500),
            },
          }),
        },
      });
      await this.prisma.auditLog.create({
        data: {
          userId,
          companyId,
          action: "content.meta.publish_failed",
          metadata: this.json({ contentId: item.id, integrationId: integration.id, error: message.slice(0, 500) }),
        },
      });
      throw error;
    }
  }
}
