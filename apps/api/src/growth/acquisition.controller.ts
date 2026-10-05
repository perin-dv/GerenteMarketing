import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard, type AuthenticatedRequest } from "../auth/auth.guard";
import { AcquisitionService } from "./acquisition.service";
import { CreateAcquisitionPlanDto } from "./acquisition.dto";

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
}
