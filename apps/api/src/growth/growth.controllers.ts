import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  RawBodyRequest,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { IntegrationProvider, IntegrationStatus, LeadSource, MetricKey } from "@prisma/client";
import type { Request, Response } from "express";
import { AuthGuard, type AuthenticatedRequest } from "../auth/auth.guard";
import { PrismaService } from "../prisma.service";
import {
  ConnectWhatsappDto,
  CreateContentDto,
  CreateExperimentDto,
  CreateLeadDto,
  CreateMetricDto,
  GenerateContentPlanDto,
  UpdateAutopilotDto,
  UpdateContentDto,
  UpdateExperimentDto,
  UpdateLeadDto,
  UpdateRecommendationDto,
} from "./growth.dto";
import { GrowthService } from "./growth.service";
import { MetaBusinessLoginService } from "./meta-business-login.service";

@Controller("integrations")
export class IntegrationsController {
  constructor(
    private readonly growth: GrowthService,
    private readonly metaLogin: MetaBusinessLoginService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @UseGuards(AuthGuard)
  list(@Req() request: AuthenticatedRequest) {
    return this.growth.listIntegrations(request.user?.companyId);
  }

  @Get("readiness")
  @UseGuards(AuthGuard)
  readiness() {
    const readiness = this.growth.integrationReadiness();
    return {
      ...readiness,
      meta: {
        ...readiness.meta,
        ready: readiness.meta.ready && Boolean(process.env.META_LOGIN_CONFIG_ID),
        required: [...readiness.meta.required, "META_LOGIN_CONFIG_ID"],
      },
    };
  }

  @Post("meta/oauth-url")
  @UseGuards(AuthGuard)
  metaOauthUrl(@Req() request: AuthenticatedRequest) {
    return this.metaLogin.createOauthUrl(request.user?.companyId, request.user!.sub);
  }

  @Get("meta/callback")
  async metaCallback(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Res() response: Response,
  ) {
    if (!code || !state) throw new BadRequestException("Callback da Meta sem code/state.");
    const result = await this.growth.completeMetaOauth(code, state);
    const frontend = process.env.FRONTEND_URL || "http://localhost:3000";
    return response.redirect(`${frontend}/integrations?connected=meta&accounts=${result.connected}`);
  }

  @Post("meta/sync")
  @UseGuards(AuthGuard)
  syncMeta(@Req() request: AuthenticatedRequest) {
    return this.growth.syncMeta(request.user?.companyId, request.user!.sub);
  }

  @Post("whatsapp/connect")
  @UseGuards(AuthGuard)
  connectWhatsapp(@Req() request: AuthenticatedRequest, @Body() dto: ConnectWhatsappDto) {
    return this.growth.connectWhatsapp(request.user?.companyId, request.user!.sub, dto);
  }

  @Post("whatsapp/test")
  @UseGuards(AuthGuard)
  async testWhatsapp(@Req() request: AuthenticatedRequest) {
    const companyId = request.user?.companyId;
    if (!companyId) throw new BadRequestException("Nenhuma empresa ativa na sessão.");

    const integration = await this.prisma.integrationAccount.findFirst({
      where: {
        companyId,
        provider: IntegrationProvider.WHATSAPP,
        status: IntegrationStatus.CONNECTED,
      },
      orderBy: { updatedAt: "desc" },
    });
    if (!integration) throw new BadRequestException("Nenhum WhatsApp conectado nesta empresa.");

    const latestConversation = await this.prisma.conversation.findFirst({
      where: { companyId, source: LeadSource.WHATSAPP },
      orderBy: { lastMessageAt: "desc" },
      select: { lastMessageAt: true, messageCount: true },
    });

    return {
      ok: true,
      connected: true,
      lastMessageAt: latestConversation?.lastMessageAt ?? integration.lastSyncedAt,
      messageCount: latestConversation?.messageCount ?? 0,
    };
  }

  @Delete(":id")
  @UseGuards(AuthGuard)
  disconnect(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.growth.disconnectIntegration(request.user?.companyId, request.user!.sub, id);
  }
}

@Controller("webhooks/whatsapp")
export class WhatsappWebhookController {
  constructor(private readonly growth: GrowthService) {}

  @Get()
  verify(
    @Query("hub.mode") mode?: string,
    @Query("hub.verify_token") token?: string,
    @Query("hub.challenge") challenge?: string,
  ) {
    return this.growth.verifyWhatsappChallenge(mode, token, challenge);
  }

  @Post()
  async receive(
    @Req() request: RawBodyRequest<Request>,
    @Headers("x-hub-signature-256") signature?: string,
  ) {
    this.growth.verifyWhatsappSignature(request.rawBody, signature);
    return this.growth.receiveWhatsappWebhook(request.body);
  }
}

@Controller("metrics")
@UseGuards(AuthGuard)
export class MetricsController {
  constructor(private readonly growth: GrowthService) {}

  @Get("summary")
  summary(@Req() request: AuthenticatedRequest, @Query("days") days?: string) {
    return this.growth.metricsSummary(request.user?.companyId, Number(days || 30));
  }

  @Get("history/:metric")
  history(
    @Req() request: AuthenticatedRequest,
    @Param("metric") metric: MetricKey,
    @Query("days") days?: string,
  ) {
    if (!Object.values(MetricKey).includes(metric)) throw new BadRequestException("Métrica inválida.");
    return this.growth.metricHistory(request.user?.companyId, metric, Number(days || 30));
  }

  @Post("manual")
  manual(@Req() request: AuthenticatedRequest, @Body() dto: CreateMetricDto) {
    return this.growth.createManualMetric(request.user?.companyId, request.user!.sub, dto);
  }
}

@Controller("content")
@UseGuards(AuthGuard)
export class ContentController {
  constructor(private readonly growth: GrowthService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.growth.listContent(request.user?.companyId);
  }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateContentDto) {
    return this.growth.createContent(request.user?.companyId, request.user!.sub, dto);
  }

  @Post("generate-plan")
  generatePlan(@Req() request: AuthenticatedRequest, @Body() dto: GenerateContentPlanDto) {
    return this.growth.generateContentPlan(request.user?.companyId, request.user!.sub, dto.campaignId);
  }

  @Patch(":id")
  update(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() dto: UpdateContentDto) {
    return this.growth.updateContent(request.user?.companyId, request.user!.sub, id, dto);
  }
}

@Controller("recommendations")
@UseGuards(AuthGuard)
export class RecommendationsController {
  constructor(private readonly growth: GrowthService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest, @Query("history") history?: string) {
    return this.growth.listRecommendations(request.user?.companyId, history === "true");
  }

  @Post("generate")
  generate(@Req() request: AuthenticatedRequest) {
    return this.growth.generateRecommendations(request.user?.companyId, request.user!.sub);
  }

  @Patch(":id")
  update(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() dto: UpdateRecommendationDto,
  ) {
    return this.growth.updateRecommendation(request.user?.companyId, request.user!.sub, id, dto);
  }
}

@Controller("experiments")
@UseGuards(AuthGuard)
export class ExperimentsController {
  constructor(private readonly growth: GrowthService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.growth.listExperiments(request.user?.companyId);
  }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateExperimentDto) {
    return this.growth.createExperiment(request.user?.companyId, request.user!.sub, dto);
  }

  @Patch(":id")
  update(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() dto: UpdateExperimentDto,
  ) {
    return this.growth.updateExperiment(request.user?.companyId, request.user!.sub, id, dto);
  }
}

@Controller("autopilot")
@UseGuards(AuthGuard)
export class AutopilotController {
  constructor(private readonly growth: GrowthService) {}

  @Get()
  get(@Req() request: AuthenticatedRequest) {
    return this.growth.getAutopilot(request.user?.companyId);
  }

  @Patch()
  update(@Req() request: AuthenticatedRequest, @Body() dto: UpdateAutopilotDto) {
    return this.growth.updateAutopilot(request.user?.companyId, request.user!.sub, dto);
  }

  @Post("run")
  run(@Req() request: AuthenticatedRequest) {
    return this.growth.runAutopilot(request.user?.companyId, request.user!.sub);
  }
}

@Controller("leads")
@UseGuards(AuthGuard)
export class LeadsController {
  constructor(private readonly growth: GrowthService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.growth.listLeads(request.user?.companyId);
  }

  @Get("summary")
  summary(@Req() request: AuthenticatedRequest) {
    return this.growth.leadSummary(request.user?.companyId);
  }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateLeadDto) {
    return this.growth.createLead(request.user?.companyId, request.user!.sub, dto);
  }

  @Patch(":id")
  update(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() dto: UpdateLeadDto) {
    return this.growth.updateLead(request.user?.companyId, request.user!.sub, id, dto);
  }
}
