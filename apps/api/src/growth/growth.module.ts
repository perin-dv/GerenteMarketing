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
import { WhatsappConversationController } from "./whatsapp-conversation.controller";
import { WhatsappConversationService } from "./whatsapp-conversation.service";
import { WhatsappRelayController } from "./whatsapp-relay.controller";

@Module({
  imports: [AuthModule],
  controllers: [
    IntegrationsController,
    WhatsappWebhookController,
    WhatsappRelayController,
    WhatsappConversationController,
    MetricsController,
    ContentController,
    RecommendationsController,
    ExperimentsController,
    AutopilotController,
    LeadsController,
  ],
  providers: [
    GrowthService,
    MetaBusinessLoginService,
    WhatsappConversationService,
    PrismaService,
  ],
  exports: [GrowthService],
})
export class GrowthModule {}
