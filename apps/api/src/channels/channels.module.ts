import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaService } from "../prisma.service";
import { ChannelsController } from "./channels.controller";
import { ChannelsService } from "./channels.service";

@Module({
  imports: [AuthModule],
  controllers: [ChannelsController],
  providers: [ChannelsService, PrismaService],
})
export class ChannelsModule {}
