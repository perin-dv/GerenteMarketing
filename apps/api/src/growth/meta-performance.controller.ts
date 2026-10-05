import { Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard, type AuthenticatedRequest } from "../auth/auth.guard";
import { MetaPerformanceService } from "./meta-performance.service";

@Controller("performance")
@UseGuards(AuthGuard)
export class MetaPerformanceController {
  constructor(private readonly performance: MetaPerformanceService) {}

  @Get()
  summary(@Req() request: AuthenticatedRequest) {
    return this.performance.summary(request.user?.companyId);
  }

  @Post("sync")
  sync(@Req() request: AuthenticatedRequest) {
    return this.performance.sync(request.user?.companyId, request.user!.sub);
  }
}
