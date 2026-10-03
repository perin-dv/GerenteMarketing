import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard, type AuthenticatedRequest } from "../auth/auth.guard";
import { CreateCampaignDto, UpdateCampaignDto } from "./campaign.dto";
import { CampaignsService } from "./campaigns.service";

@Controller("campaigns")
@UseGuards(AuthGuard)
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.campaigns.list(request.user?.companyId);
  }

  @Get(":id")
  get(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.campaigns.get(request.user?.companyId, id);
  }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateCampaignDto) {
    return this.campaigns.create(request.user?.companyId, request.user!.sub, dto);
  }

  @Patch(":id")
  update(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() dto: UpdateCampaignDto) {
    return this.campaigns.update(request.user?.companyId, request.user!.sub, id, dto);
  }

  @Delete(":id")
  remove(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.campaigns.remove(request.user?.companyId, request.user!.sub, id);
  }
}
