import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { CreateGoalDto, UpdateGoalDto } from "./goal.dto";

@Injectable()
export class GoalsService {
  constructor(private readonly prisma: PrismaService) {}

  private companyIdOrThrow(companyId: string | null | undefined) {
    if (!companyId) throw new ForbiddenException("Nenhuma empresa ativa na sessão.");
    return companyId;
  }

  private projection(goal: any) {
    const targetValue = Number(goal.targetValue);
    const currentValue = Number(goal.currentValue);
    const createdAt = new Date(goal.createdAt).getTime();
    const targetDate = new Date(goal.targetDate).getTime();
    const now = Date.now();
    const dayMs = 86_400_000;
    const elapsedDays = Math.max(1, (Math.min(now, targetDate) - createdAt) / dayMs);
    const remainingDays = Math.max(0, (targetDate - now) / dayMs);
    const velocity = currentValue / elapsedDays;
    const projectedValue = Math.max(currentValue, currentValue + velocity * remainingDays);
    const progressPercent = targetValue > 0 ? Math.min(999, (currentValue / targetValue) * 100) : 0;
    const projectedPercent = targetValue > 0 ? (projectedValue / targetValue) * 100 : 0;

    let paceStatus: "NO_DATA" | "AHEAD" | "ON_TRACK" | "AT_RISK" = "NO_DATA";
    if (currentValue > 0) {
      if (projectedPercent >= 110) paceStatus = "AHEAD";
      else if (projectedPercent >= 90) paceStatus = "ON_TRACK";
      else paceStatus = "AT_RISK";
    }

    return {
      ...goal,
      targetValue,
      currentValue,
      projection: {
        projectedValue: Number(projectedValue.toFixed(2)),
        progressPercent: Number(progressPercent.toFixed(1)),
        projectedPercent: Number(projectedPercent.toFixed(1)),
        paceStatus,
      },
    };
  }

  private async validateCampaign(companyId: string, campaignId?: string) {
    if (!campaignId) return;
    const campaign = await this.prisma.campaign.findFirst({ where: { id: campaignId, companyId } });
    if (!campaign) throw new NotFoundException("Campanha vinculada não encontrada.");
  }

  async list(companyIdInput: string | null | undefined) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    const goals = await this.prisma.goal.findMany({
      where: { companyId },
      include: { campaign: { select: { id: true, name: true, status: true } } },
      orderBy: [{ status: "asc" }, { targetDate: "asc" }],
    });
    return goals.map((goal) => this.projection(goal));
  }

  async get(companyIdInput: string | null | undefined, id: string) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    const goal = await this.prisma.goal.findFirst({
      where: { id, companyId },
      include: { campaign: { select: { id: true, name: true, status: true } } },
    });
    if (!goal) throw new NotFoundException("Meta não encontrada.");
    return this.projection(goal);
  }

  async create(companyIdInput: string | null | undefined, userId: string, dto: CreateGoalDto) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    await this.validateCampaign(companyId, dto.campaignId);

    const goal = await this.prisma.goal.create({
      data: {
        companyId,
        campaignId: dto.campaignId,
        name: dto.name.trim(),
        metric: dto.metric,
        targetValue: dto.targetValue,
        currentValue: dto.currentValue ?? 0,
        targetDate: new Date(dto.targetDate),
      },
      include: { campaign: { select: { id: true, name: true, status: true } } },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        companyId,
        action: "goal.created",
        metadata: { goalId: goal.id, name: goal.name, metric: goal.metric, campaignId: goal.campaignId },
      },
    });

    return this.projection(goal);
  }

  async update(companyIdInput: string | null | undefined, userId: string, id: string, dto: UpdateGoalDto) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    const existing = await this.prisma.goal.findFirst({ where: { id, companyId } });
    if (!existing) throw new NotFoundException("Meta não encontrada.");
    await this.validateCampaign(companyId, dto.campaignId);

    const goal = await this.prisma.goal.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        metric: dto.metric,
        targetValue: dto.targetValue,
        currentValue: dto.currentValue,
        targetDate: dto.targetDate ? new Date(dto.targetDate) : undefined,
        campaignId: dto.campaignId,
        status: dto.status,
      },
      include: { campaign: { select: { id: true, name: true, status: true } } },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        companyId,
        action: "goal.updated",
        metadata: { goalId: id, fields: Object.keys(dto) },
      },
    });

    return this.projection(goal);
  }

  async remove(companyIdInput: string | null | undefined, userId: string, id: string) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    const existing = await this.prisma.goal.findFirst({ where: { id, companyId } });
    if (!existing) throw new NotFoundException("Meta não encontrada.");

    await this.prisma.goal.delete({ where: { id } });
    await this.prisma.auditLog.create({
      data: { userId, companyId, action: "goal.deleted", metadata: { goalId: id, name: existing.name } },
    });

    return { ok: true };
  }
}
