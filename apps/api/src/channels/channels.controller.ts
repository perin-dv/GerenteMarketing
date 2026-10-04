import { BadRequestException, Controller, Get, Headers, Param, Post, Query, Req, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { AuthGuard, type AuthenticatedRequest } from "../auth/auth.guard";
import { ChannelsService } from "./channels.service";

@Controller("channels")
export class ChannelsController {
  constructor(private readonly channels: ChannelsService) {}

  @Post("tiktok/oauth-url")
  @UseGuards(AuthGuard)
  tiktokOauthUrl(@Req() request: AuthenticatedRequest) {
    return this.channels.tiktokOauthUrl(request.user?.companyId, request.user!.sub);
  }

  @Get("tiktok/callback")
  async tiktokCallback(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Res() response: Response,
  ) {
    if (!code || !state) throw new BadRequestException("Callback TikTok sem code/state.");
    const result = await this.channels.completeTiktokOauth(code, state);
    const frontend = process.env.FRONTEND_URL || "http://localhost:3000";
    return response.redirect(`${frontend}/integrations?connected=tiktok&name=${encodeURIComponent(result.displayName)}`);
  }

  @Post("tiktok/sync")
  @UseGuards(AuthGuard)
  syncTiktok(@Req() request: AuthenticatedRequest) {
    return this.channels.syncTiktok(request.user?.companyId, request.user!.sub);
  }

  @Post("telegram/connect")
  @UseGuards(AuthGuard)
  connectTelegram(@Req() request: AuthenticatedRequest) {
    return this.channels.connectTelegram(request.user?.companyId, request.user!.sub);
  }

  @Post("telegram/webhook/:integrationId")
  telegramWebhook(
    @Param("integrationId") integrationId: string,
    @Headers("x-telegram-bot-api-secret-token") secret: string | undefined,
    @Req() request: { body: unknown },
  ) {
    return this.channels.receiveTelegramWebhook(integrationId, secret, request.body);
  }
}
