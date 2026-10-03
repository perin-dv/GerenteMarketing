import { Body, Controller, Get, Post, Req, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { AuthGuard, type AuthenticatedRequest } from "../auth/auth.guard";
import { CreateWorkspaceDto, SwitchWorkspaceDto } from "./workspace.dto";
import { WorkspaceService } from "./workspace.service";

@Controller("workspace")
@UseGuards(AuthGuard)
export class WorkspaceController {
  constructor(private readonly workspace: WorkspaceService) {}

  @Get("companies")
  list(@Req() request: AuthenticatedRequest) {
    return this.workspace.list(request.user!.sub, request.user?.companyId);
  }

  @Post("companies")
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateWorkspaceDto) {
    return this.workspace.create(request.user!.sub, dto.name);
  }

  @Post("switch")
  async switch(
    @Req() request: AuthenticatedRequest,
    @Body() dto: SwitchWorkspaceDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.workspace.switch(request.user!.sub, request.user!.email, dto.companyId);
    response.cookie("gm_access", result.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 8 * 60 * 60 * 1000,
      path: "/",
    });
    return { company: result.company };
  }
}
