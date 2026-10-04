import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  Post,
  ServiceUnavailableException,
} from "@nestjs/common";
import { createHash, timingSafeEqual } from "node:crypto";
import { GrowthService } from "./growth.service";

@Controller("webhooks/whatsapp/relay")
export class WhatsappRelayController {
  constructor(private readonly growth: GrowthService) {}

  @Post()
  receive(
    @Body() payload: unknown,
    @Headers("x-gerentemarketing-relay-secret") providedSecret?: string,
  ) {
    const expectedSecret = process.env.GERENTEMARKETING_RELAY_SECRET || "";
    if (!expectedSecret) {
      throw new ServiceUnavailableException(
        "GERENTEMARKETING_RELAY_SECRET não configurado.",
      );
    }
    if (!providedSecret || !sameSecret(providedSecret, expectedSecret)) {
      throw new ForbiddenException("Relay do WhatsApp não autorizado.");
    }
    return this.growth.receiveWhatsappWebhook(payload);
  }
}

function sameSecret(provided: string, expected: string) {
  const providedHash = createHash("sha256").update(provided, "utf8").digest();
  const expectedHash = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(providedHash, expectedHash);
}
