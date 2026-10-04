import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaService } from "../prisma.service";
import {
  AutopilotController,
  ContentController,
  ExperimentsController,
  IntegrationsController,
  LeadsController,
  MetricsController,
  RecommendationsController,
  WhatsappWebhookController,
} from "./growth.controllers";
import { GrowthService } from "./growth.service";
import { MetaBusinessLoginService } from "./meta-business-login.service";
import { WhatsappRelayController } from "./whatsapp-relay.controller";

@Module({
  imports: [AuthModule],
  controllers: [
    IntegrationsController,
    WhatsappWebhookController,
    WhatsappRelayController,
    MetricsController,
    ContentController,
    RecommendationsController,
    ExperimentsController,
    AutopilotController,
    LeadsController,
  ],
  providers: [GrowthService, MetaBusinessLoginService, PrismaService],
  exports: [GrowthService],
})
export class GrowthModule {}
