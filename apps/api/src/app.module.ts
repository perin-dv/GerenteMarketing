import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AuthModule } from "./auth/auth.module";
import { CampaignsModule } from "./campaigns/campaigns.module";
import { GoalsModule } from "./goals/goals.module";
import { GrowthModule } from "./growth/growth.module";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), AuthModule, CampaignsModule, GoalsModule, GrowthModule],
  controllers: [AppController],
})
export class AppModule {}
