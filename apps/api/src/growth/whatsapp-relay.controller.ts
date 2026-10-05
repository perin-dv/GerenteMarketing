import {
  Controller,
  ForbiddenException,
  Headers,
  Post,
  RawBodyRequest,
  Req,
  ServiceUnavailableException,
} from "@nestjs/common";
import { IntegrationProvider, IntegrationStatus } from "@prisma/client";
import type { Request } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { PrismaService } from "../prisma.service";
import { GrowthService } from "./growth.service";

@Controller("webhooks/whatsapp/relay")
export class WhatsappRelayController {
  constructor(
    private readonly growth: GrowthService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  async receive(
    @Req() request: RawBodyRequest<Request>,
    @Headers("x-gerentemarketing-relay-signature") providedSignature?: string,
  ) {
    const appSecret = process.env.META_APP_SECRET || "";
    if (!appSecret) {
      throw new ServiceUnavailableException("META_APP_SECRET não configurado.");
    }
    if (!request.rawBody || !providedSignature?.startsWith("sha256=")) {
      throw new ForbiddenException("Assinatura do relay ausente.");
    }

    const expectedSignature = `sha256=${createHmac("sha256", appSecret).update(request.rawBody).digest("hex")}`;
    const provided = Buffer.from(providedSignature);
    const expected = Buffer.from(expectedSignature);
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      throw new ForbiddenException("Assinatura do relay inválida.");
    }

    const result = await this.growth.receiveWhatsappWebhook(request.body);
    if (result.messagesProcessed > 0) {
      const phoneNumberIds = new Set<string>();
      for (const entry of Array.isArray(request.body?.entry) ? request.body.entry : []) {
        for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
          const phoneNumberId = change?.value?.metadata?.phone_number_id;
          if (typeof phoneNumberId === "string" && phoneNumberId) phoneNumberIds.add(phoneNumberId);
        }
      }
      if (phoneNumberIds.size) {
        await this.prisma.integrationAccount.updateMany({
          where: {
            provider: IntegrationProvider.WHATSAPP,
            status: IntegrationStatus.CONNECTED,
            externalAccountId: { in: [...phoneNumberIds] },
          },
          data: { lastSyncedAt: new Date() },
        });
      }
    }

    return result;
  }
}
