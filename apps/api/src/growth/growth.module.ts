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

@Module({
  imports: [AuthModule],
  controllers: [
    IntegrationsController,
    WhatsappWebhookController,
    MetricsController,
    ContentController,
    RecommendationsController,
    ExperimentsController,
    AutopilotController,
    LeadsController,
  ],
  providers: [GrowthService, PrismaService],
  exports: [GrowthService],
})
export class GrowthModule {}
