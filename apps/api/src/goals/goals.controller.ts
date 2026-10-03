import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard, type AuthenticatedRequest } from "../auth/auth.guard";
import { CreateGoalDto, UpdateGoalDto } from "./goal.dto";
import { GoalsService } from "./goals.service";

@Controller("goals")
@UseGuards(AuthGuard)
export class GoalsController {
  constructor(private readonly goals: GoalsService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.goals.list(request.user?.companyId);
  }

  @Get(":id")
  get(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.goals.get(request.user?.companyId, id);
  }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateGoalDto) {
    return this.goals.create(request.user?.companyId, request.user!.sub, dto);
  }

  @Patch(":id")
  update(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() dto: UpdateGoalDto) {
    return this.goals.update(request.user?.companyId, request.user!.sub, id, dto);
  }

  @Delete(":id")
  remove(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.goals.remove(request.user?.companyId, request.user!.sub, id);
  }
}
