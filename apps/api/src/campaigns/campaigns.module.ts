import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaService } from "../prisma.service";
import { CampaignsController } from "./campaigns.controller";
import { CampaignsService } from "./campaigns.service";

@Module({
  imports: [AuthModule],
  controllers: [CampaignsController],
  providers: [CampaignsService, PrismaService],
})
export class CampaignsModule {}
