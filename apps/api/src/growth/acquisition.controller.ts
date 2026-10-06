import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { AuthGuard, type AuthenticatedRequest } from "../auth/auth.guard";
import { AcquisitionService } from "./acquisition.service";
import { CreateAcquisitionPlanDto, ImportAcquisitionProspectDto, PrepareAcquisitionOutreachDto, UpdateAcquisitionOutreachDto } from "./acquisition.dto";

@Controller("acquisition")
@UseGuards(AuthGuard)
export class AcquisitionController {
  constructor(private readonly acquisition: AcquisitionService) {}

  @Get("plans")
  list(@Req() request: AuthenticatedRequest) {
    return this.acquisition.list(request.user?.companyId);
  }

  @Post("plans")
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateAcquisitionPlanDto) {
    return this.acquisition.create(request.user?.companyId, request.user!.sub, dto);
  }

  @Get("prospects")
  searchProspects(
    @Req() request: AuthenticatedRequest,
    @Query("query") query?: string,
    @Query("region") region?: string,
  ) {
    return this.acquisition.searchProspects(request.user?.companyId, request.user!.sub, query, region);
  }

  @Post("prospects/import")
  importProspect(@Req() request: AuthenticatedRequest, @Body() dto: ImportAcquisitionProspectDto) {
    return this.acquisition.importProspect(request.user?.companyId, request.user!.sub, dto);
  }

  @Get("prospects/crm")
  listCrmProspects(@Req() request: AuthenticatedRequest) {
    return this.acquisition.listCrmProspects(request.user?.companyId);
  }

  @Post("prospects/:leadId/outreach/prepare")
  prepareOutreach(
    @Req() request: AuthenticatedRequest,
    @Param("leadId") leadId: string,
    @Body() dto: PrepareAcquisitionOutreachDto,
  ) {
    return this.acquisition.prepareOutreach(request.user?.companyId, request.user!.sub, leadId, dto);
  }

  @Patch("prospects/:leadId/outreach")
  updateOutreach(
    @Req() request: AuthenticatedRequest,
    @Param("leadId") leadId: string,
    @Body() dto: UpdateAcquisitionOutreachDto,
  ) {
    return this.acquisition.updateOutreach(request.user?.companyId, request.user!.sub, leadId, dto);
  }
}
