import {
  Controller,
  ForbiddenException,
  Headers,
  Post,
  RawBodyRequest,
  Req,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { Request } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { GrowthService } from "./growth.service";

@Controller("webhooks/whatsapp/relay")
export class WhatsappRelayController {
  constructor(private readonly growth: GrowthService) {}

  @Post()
  receive(
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

    return this.growth.receiveWhatsappWebhook(request.body);
  }
}
