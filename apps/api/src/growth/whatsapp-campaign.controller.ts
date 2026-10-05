import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard, type AuthenticatedRequest } from "../auth/auth.guard";
import { CreateWhatsappCampaignDto, WhatsappMarketingConsentDto } from "./whatsapp-campaign.dto";
import { WhatsappCampaignService } from "./whatsapp-campaign.service";

@Controller("whatsapp-campaigns")
@UseGuards(AuthGuard)
export class WhatsappCampaignController {
  constructor(private readonly campaigns: WhatsappCampaignService) {}

  @Get("templates")
  templates(@Req() request: AuthenticatedRequest) {
    return this.campaigns.listTemplates(request.user?.companyId);
  }

  @Get("audience")
  audience(@Req() request: AuthenticatedRequest) {
    return this.campaigns.listAudience(request.user?.companyId);
  }

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.campaigns.listCampaigns(request.user?.companyId);
  }

  @Patch("audience/:leadId/consent")
  consent(
    @Req() request: AuthenticatedRequest,
    @Param("leadId") leadId: string,
    @Body() dto: WhatsappMarketingConsentDto,
  ) {
    return this.campaigns.setConsent(request.user?.companyId, request.user!.sub, leadId, dto.optIn);
  }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateWhatsappCampaignDto) {
    return this.campaigns.createCampaign(request.user?.companyId, request.user!.sub, dto);
  }
}
