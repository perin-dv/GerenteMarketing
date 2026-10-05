import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard, type AuthenticatedRequest } from "../auth/auth.guard";
import { CreateAutoCampaignDto } from "./auto-campaign.dto";
import { AutoCampaignService } from "./auto-campaign.service";

@Controller("campaign-automation")
@UseGuards(AuthGuard)
export class AutoCampaignController {
  constructor(private readonly automation: AutoCampaignService) {}

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateAutoCampaignDto) {
    return this.automation.create(request.user?.companyId, request.user!.sub, dto);
  }
}
