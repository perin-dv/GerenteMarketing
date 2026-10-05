import { Injectable, NotFoundException } from "@nestjs/common";
import {
  IntegrationProvider,
  IntegrationStatus,
  LeadSource,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../prisma.service";

type StoredWhatsappMessage = {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  type: string;
  text: string;
  at: string;
};

@Injectable()
export class WhatsappConversationService {
  constructor(private readonly prisma: PrismaService) {}

  private json(value: unknown): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }

  private metadataObject(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? { ...(value as Record<string, unknown>) }
      : {};
  }

  private storedMessages(value: Prisma.JsonValue | null | undefined): StoredWhatsappMessage[] {
    const metadata = this.metadataObject(value);
    const raw = Array.isArray(metadata.messages) ? metadata.messages : [];
    return raw
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
      .map((item): StoredWhatsappMessage => ({
        id: String(item.id || ""),
        direction: item.direction === "OUTBOUND" ? "OUTBOUND" : "INBOUND",
        type: String(item.type || "text"),
        text: String(item.text || ""),
        at: String(item.at || new Date(0).toISOString()),
      }))
      .filter((item) => item.id);
  }

  private normalizePhone(value: unknown) {
    return String(value || "").replace(/\D/g, "");
  }

  private messageText(message: any) {
    const type = String(message?.type || "text");
    if (type === "text") return String(message?.text?.body || "");
    if (type === "button") return String(message?.button?.text || message?.button?.payload || "[botão]");
    if (type === "interactive") {
      return String(
        message?.interactive?.button_reply?.title ||
        message?.interactive?.list_reply?.title ||
        "[interativo]",
      );
    }
    if (type === "image") return String(message?.image?.caption || "[imagem]");
    if (type === "document") return String(message?.document?.caption || message?.document?.filename || "[documento]");
    if (type === "audio") return "[áudio]";
    return `[${type}]`;
  }

  private async appendMessage(
    conversationId: string,
    message: StoredWhatsappMessage,
    incrementMessageCount: boolean,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const conversation = await tx.conversation.findUnique({ where: { id: conversationId } });
      if (!conversation) return false;

      const metadata = this.metadataObject(conversation.metadata);
      const messages = this.storedMessages(conversation.metadata);
      if (messages.some((item) => item.id === message.id)) return false;

      const nextMessages = [...messages, message].slice(-200);
      await tx.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(message.at),
          externalId: message.id,
          ...(incrementMessageCount ? { messageCount: { increment: 1 } } : {}),
          metadata: this.json({
            ...metadata,
            messages: nextMessages,
            lastMessage: {
              id: message.id,
              direction: message.direction,
              type: message.type,
              text: message.text,
              at: message.at,
            },
          }),
        },
      });
      return true;
    });
  }

  private async recentConversation(companyId: string, leadId: string) {
    return this.prisma.conversation.findFirst({
      where: {
        companyId,
        leadId,
        source: LeadSource.WHATSAPP,
        lastMessageAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      orderBy: { lastMessageAt: "desc" },
    });
  }

  async recordInboundPayload(payload: any) {
    const entries = Array.isArray(payload?.entry) ? payload.entry : [];
    let stored = 0;

    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of changes) {
        const value = change?.value || {};
        const phoneNumberId = typeof value?.metadata?.phone_number_id === "string"
          ? value.metadata.phone_number_id
          : "";
        if (!phoneNumberId) continue;

        const integration = await this.prisma.integrationAccount.findFirst({
          where: {
            provider: IntegrationProvider.WHATSAPP,
            status: IntegrationStatus.CONNECTED,
            externalAccountId: phoneNumberId,
          },
        });
        if (!integration) continue;

        const messages = Array.isArray(value?.messages) ? value.messages : [];
        for (const message of messages) {
          const phone = this.normalizePhone(message?.from);
          const messageId = String(message?.id || "");
          if (!phone || !messageId) continue;

          const lead = await this.prisma.lead.findFirst({
            where: { companyId: integration.companyId, phone },
          });
          if (!lead) continue;

          let conversation = await this.recentConversation(integration.companyId, lead.id);
          if (!conversation) {
            conversation = await this.prisma.conversation.create({
              data: {
                companyId: integration.companyId,
                leadId: lead.id,
                source: LeadSource.WHATSAPP,
                externalId: messageId,
                messageCount: 1,
              },
            });
          }

          const timestampSeconds = Number(message?.timestamp || 0);
          const at = timestampSeconds > 0
            ? new Date(timestampSeconds * 1000).toISOString()
            : new Date().toISOString();
          const inserted = await this.appendMessage(
            conversation.id,
            {
              id: messageId,
              direction: "INBOUND",
              type: String(message?.type || "text"),
              text: this.messageText(message).slice(0, 4096),
              at,
            },
            false,
          );
          if (inserted) stored += 1;
        }
      }
    }

    return { stored };
  }

  async recordOutboundEvent(payload: any) {
    const phoneNumberId = String(payload?.phoneNumberId || "").trim();
    const phone = this.normalizePhone(payload?.phone);
    const messageId = String(payload?.messageId || "").trim();
    if (!phoneNumberId || !phone || !messageId || payload?.direction !== "outbound") {
      return { ok: true, stored: false, reason: "invalid-payload" };
    }

    const integration = await this.prisma.integrationAccount.findFirst({
      where: {
        provider: IntegrationProvider.WHATSAPP,
        status: IntegrationStatus.CONNECTED,
        externalAccountId: phoneNumberId,
      },
    });
    if (!integration) return { ok: true, stored: false, reason: "integration-not-found" };

    let lead = await this.prisma.lead.findFirst({
      where: { companyId: integration.companyId, phone },
    });
    if (!lead) {
      lead = await this.prisma.lead.create({
        data: {
          companyId: integration.companyId,
          phone,
          source: LeadSource.WHATSAPP,
          externalId: phone,
          name: typeof payload?.clientName === "string" ? payload.clientName : undefined,
        },
      });
    }

    let conversation = await this.recentConversation(integration.companyId, lead.id);
    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          companyId: integration.companyId,
          leadId: lead.id,
          source: LeadSource.WHATSAPP,
          externalId: messageId,
          messageCount: 0,
        },
      });
    }

    const atCandidate = new Date(payload?.at || Date.now());
    const at = Number.isNaN(atCandidate.getTime()) ? new Date().toISOString() : atCandidate.toISOString();
    const inserted = await this.appendMessage(
      conversation.id,
      {
        id: messageId,
        direction: "OUTBOUND",
        type: String(payload?.type || "text"),
        text: String(payload?.text || "").slice(0, 4096),
        at,
      },
      true,
    );

    if (inserted) {
      await this.prisma.integrationAccount.update({
        where: { id: integration.id },
        data: { lastSyncedAt: new Date() },
      });
    }

    return { ok: true, stored: inserted };
  }

  async listLeadMessages(companyIdInput: string | null | undefined, leadId: string) {
    if (!companyIdInput) throw new NotFoundException("Empresa ativa não encontrada.");
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, companyId: companyIdInput },
      select: { id: true, name: true, phone: true, source: true },
    });
    if (!lead) throw new NotFoundException("Lead não encontrado.");

    const conversations = await this.prisma.conversation.findMany({
      where: { companyId: companyIdInput, leadId, source: LeadSource.WHATSAPP },
      orderBy: { startedAt: "asc" },
      select: { id: true, startedAt: true, lastMessageAt: true, metadata: true },
    });

    const messages = conversations
      .flatMap((conversation) => this.storedMessages(conversation.metadata))
      .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
      .slice(-200);

    return { lead, messages };
  }
}
