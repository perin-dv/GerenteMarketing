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
import { MediaController } from "./media.controller";
import { MediaStorageService } from "./media-storage.service";
import { MetaBusinessLoginService } from "./meta-business-login.service";
import { MetaPerformanceController } from "./meta-performance.controller";
import { MetaPerformanceService } from "./meta-performance.service";
import { MetaPublishingController } from "./meta-publishing.controller";
import { MetaPublishingService } from "./meta-publishing.service";
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
    MetaPublishingController,
    MetaPerformanceController,
    MediaController,
    RecommendationsController,
    ExperimentsController,
    AutopilotController,
    LeadsController,
  ],
  providers: [
    GrowthService,
    MetaBusinessLoginService,
    MetaPublishingService,
    MetaPerformanceService,
    MediaStorageService,
    WhatsappConversationService,
    PrismaService,
  ],
  exports: [GrowthService],
})
export class GrowthModule {}
