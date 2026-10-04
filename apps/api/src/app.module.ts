import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AuthModule } from "./auth/auth.module";
import { CampaignsModule } from "./campaigns/campaigns.module";
import { ChannelsModule } from "./channels/channels.module";
import { GoalsModule } from "./goals/goals.module";
import { GrowthModule } from "./growth/growth.module";
import { WorkspaceModule } from "./workspace/workspace.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    CampaignsModule,
    GoalsModule,
    GrowthModule,
    ChannelsModule,
    WorkspaceModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
