import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
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
import { createDecipheriv } from "node:crypto";
import { PrismaService } from "../prisma.service";
import { CreateWhatsappCampaignDto } from "./whatsapp-campaign.dto";

type MetaTemplateComponent = { type?: string; format?: string; text?: string };
type MetaTemplate = {
  id?: string;
  name?: string;
  status?: string;
  category?: string;
  language?: string;
  components?: MetaTemplateComponent[];
};

@Injectable()
export class WhatsappCampaignService {
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

  private object(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? { ...(value as Record<string, unknown>) }
      : {};
  }

  private consentFromMetadata(value: unknown) {
    const metadata = this.object(value);
    const consent = this.object(metadata.whatsappMarketingConsent);
    return {
      optIn: consent.optIn === true,
      updatedAt: typeof consent.updatedAt === "string" ? consent.updatedAt : null,
      source: typeof consent.source === "string" ? consent.source : null,
    };
  }

  private async externalJson<T>(url: string): Promise<T> {
    const response = await fetch(url);
    const text = await response.text();
    let data: any = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    if (!response.ok) {
      const detail = data?.error?.message || text || `HTTP ${response.status}`;
      throw new BadRequestException(`WhatsApp/Meta recusou a leitura: ${String(detail).slice(0, 500)}`);
    }
    return data as T;
  }

  private async integration(companyId: string, integrationId?: string) {
    const account = integrationId
      ? await this.prisma.integrationAccount.findFirst({
          where: { id: integrationId, companyId, provider: IntegrationProvider.WHATSAPP, status: IntegrationStatus.CONNECTED },
        })
      : await this.prisma.integrationAccount.findFirst({
          where: { companyId, provider: IntegrationProvider.WHATSAPP, status: IntegrationStatus.CONNECTED },
          orderBy: { updatedAt: "desc" },
        });
    if (!account?.externalAccountId || !account.accessTokenCiphertext) {
      throw new BadRequestException("Conecte o WhatsApp Cloud API antes de criar campanhas.");
    }
    const metadata = this.object(account.metadata);
    const wabaId = typeof metadata.wabaId === "string" ? metadata.wabaId : "";
    if (!wabaId) throw new BadRequestException("A integração do WhatsApp não possui WABA ID.");
    return { account, wabaId, token: this.decryptSecret(account.accessTokenCiphertext) };
  }

  private templateShape(template: MetaTemplate) {
    const components = Array.isArray(template.components) ? template.components : [];
    const header = components.find((item) => String(item.type || "").toUpperCase() === "HEADER");
    const body = components.find((item) => String(item.type || "").toUpperCase() === "BODY");
    const bodyText = String(body?.text || "");
    const indexes = Array.from(bodyText.matchAll(/\{\{(\d+)\}\}/g)).map((match) => Number(match[1] || 0));
    return {
      id: template.id || "",
      name: template.name || "",
      status: template.status || "",
      category: template.category || "",
      language: template.language || "",
      headerFormat: String(header?.format || "").toUpperCase() || null,
      bodyText,
      bodyParameterCount: indexes.length ? Math.max(...indexes) : 0,
    };
  }

  private async approvedTemplates(companyId: string, integrationId?: string) {
    const { account, wabaId, token } = await this.integration(companyId, integrationId);
    const result = await this.externalJson<{ data?: MetaTemplate[] }>(
      `https://graph.facebook.com/${this.graphVersion()}/${encodeURIComponent(wabaId)}/message_templates?fields=id,name,status,category,language,components&limit=100&access_token=${encodeURIComponent(token)}`,
    );
    return {
      account,
      templates: (result.data || [])
        .filter((template) => String(template.status || "").toUpperCase() === "APPROVED")
        .map((template) => this.templateShape(template)),
    };
  }

  async listTemplates(companyIdInput: string | null | undefined) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    const { account, templates } = await this.approvedTemplates(companyId);
    return { integration: { id: account.id, displayName: account.displayName }, templates };
  }

  async listAudience(companyIdInput: string | null | undefined) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    const leads = await this.prisma.lead.findMany({
      where: { companyId, phone: { not: null } },
      select: { id: true, name: true, phone: true, source: true, stage: true, campaignTag: true, metadata: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 500,
    });
    return leads.map((lead) => ({
      id: lead.id,
      name: lead.name,
      phone: lead.phone,
      source: lead.source,
      stage: lead.stage,
      campaignTag: lead.campaignTag,
      consent: this.consentFromMetadata(lead.metadata),
    }));
  }

  async setConsent(companyIdInput: string | null | undefined, userId: string, leadId: string, optIn: boolean) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    const lead = await this.prisma.lead.findFirst({ where: { id: leadId, companyId } });
    if (!lead) throw new NotFoundException("Lead não encontrado.");
    const metadata = this.object(lead.metadata);
    const updatedAt = new Date().toISOString();
    await this.prisma.lead.update({
      where: { id: lead.id },
      data: {
        metadata: this.json({
          ...metadata,
          whatsappMarketingConsent: { optIn, updatedAt, source: "manual" },
        }),
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId,
        companyId,
        action: "whatsapp.marketing_consent.updated",
        metadata: this.json({ leadId, optIn, updatedAt }),
      },
    });
    return { ok: true, leadId, optIn, updatedAt };
  }

  async listCampaigns(companyIdInput: string | null | undefined) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    const items = await this.prisma.contentItem.findMany({
      where: { companyId, channel: CampaignChannel.WHATSAPP },
      include: { campaign: { select: { id: true, name: true, status: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return items.map((item) => {
      const metadata = this.object(item.metadata);
      const campaign = this.object(metadata.whatsappCampaign);
      const recipients = Array.isArray(campaign.recipients) ? campaign.recipients : [];
      return {
        id: item.id,
        title: item.title,
        status: item.status,
        scheduledAt: item.scheduledAt,
        campaign: item.campaign,
        templateName: typeof campaign.templateName === "string" ? campaign.templateName : null,
        recipients: recipients.length,
      };
    });
  }

  async createCampaign(companyIdInput: string | null | undefined, userId: string, dto: CreateWhatsappCampaignDto) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    if (!dto.confirmOptIn) {
      throw new BadRequestException("Confirme que a campanha usa somente contatos com consentimento registrado.");
    }
    const scheduledAt = new Date(dto.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) throw new BadRequestException("Data de agendamento inválida.");

    const { account, templates } = await this.approvedTemplates(companyId, dto.integrationId);
    const template = templates.find((item) => item.name === dto.templateName && item.language === dto.languageCode);
    if (!template) throw new BadRequestException("Selecione um template aprovado do WhatsApp.");

    const params = (dto.bodyParameters || []).map((value) => String(value || "").trim());
    if (params.length !== template.bodyParameterCount) {
      throw new BadRequestException(`O template exige ${template.bodyParameterCount} parâmetro(s); foram informados ${params.length}.`);
    }

    const leads = await this.prisma.lead.findMany({
      where: { companyId, id: { in: dto.leadIds }, phone: { not: null } },
      select: { id: true, name: true, phone: true, metadata: true },
    });
    const recipients = leads
      .filter((lead) => this.consentFromMetadata(lead.metadata).optIn)
      .map((lead) => ({ leadId: lead.id, phone: String(lead.phone), name: lead.name || null, status: "PENDING" }));
    if (!recipients.length) throw new BadRequestException("Nenhum contato selecionado possui consentimento de marketing ativo.");

    const headerFormat = String(template.headerFormat || "").toUpperCase();
    if (["IMAGE", "VIDEO"].includes(headerFormat) && (!dto.mediaUrl || dto.mediaKind !== headerFormat)) {
      throw new BadRequestException(`Este template exige cabeçalho ${headerFormat}.`);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const campaign = await tx.campaign.create({
        data: {
          companyId,
          name: dto.name.trim(),
          mode: CampaignMode.ORGANIC,
          channel: CampaignChannel.WHATSAPP,
          objective: CampaignObjective.WHATSAPP,
          status: CampaignStatus.ACTIVE,
          budgetTotal: 0,
          startDate: scheduledAt,
          endDate: scheduledAt,
          notes: `Campanha WhatsApp preparada com template aprovado ${template.name}.`,
        },
      });
      const content = await tx.contentItem.create({
        data: {
          companyId,
          campaignId: campaign.id,
          type: dto.mediaKind === "VIDEO" ? ContentType.VIDEO : dto.mediaKind === "IMAGE" ? ContentType.IMAGE : ContentType.TEXT,
          status: ContentStatus.READY,
          title: dto.name.trim(),
          hook: dto.topic.trim(),
          caption: template.bodyText || template.name,
          cta: "Responder no WhatsApp",
          channel: CampaignChannel.WHATSAPP,
          scheduledAt,
          metadata: this.json({
            whatsappCampaign: {
              integrationId: account.id,
              phoneNumberId: account.externalAccountId,
              templateName: template.name,
              languageCode: template.language,
              templateCategory: template.category,
              headerFormat: template.headerFormat,
              mediaUrl: dto.mediaUrl || null,
              mediaKind: dto.mediaKind || null,
              bodyParameters: params,
              topic: dto.topic.trim(),
              recipients,
              consentRequired: true,
              dispatchMode: "CONTROLLED",
              createdByUserId: userId,
              createdAt: new Date().toISOString(),
            },
          }),
        },
      });
      await tx.auditLog.create({
        data: {
          userId,
          companyId,
          action: "whatsapp.campaign.prepared",
          metadata: this.json({ campaignId: campaign.id, contentId: content.id, recipients: recipients.length, templateName: template.name }),
        },
      });
      return { campaign, content };
    });

    return {
      ok: true,
      campaignId: result.campaign.id,
      contentId: result.content.id,
      recipients: recipients.length,
      scheduledAt,
      template: template.name,
      status: "READY",
    };
  }
}
