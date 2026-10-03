import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { CreateCampaignDto, UpdateCampaignDto } from "./campaign.dto";

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  private companyIdOrThrow(companyId: string | null | undefined) {
    if (!companyId) throw new ForbiddenException("Nenhuma empresa ativa na sessão.");
    return companyId;
  }

  private serialize(campaign: any) {
    return {
      ...campaign,
      budgetTotal: Number(campaign.budgetTotal),
      dailyBudget: campaign.dailyBudget == null ? null : Number(campaign.dailyBudget),
    };
  }

  async list(companyIdInput: string | null | undefined) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    const campaigns = await this.prisma.campaign.findMany({
      where: { companyId },
      include: { _count: { select: { goals: true } } },
      orderBy: { createdAt: "desc" },
    });
    return campaigns.map((campaign) => this.serialize(campaign));
  }

  async get(companyIdInput: string | null | undefined, id: string) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, companyId },
      include: { goals: { orderBy: { createdAt: "desc" } } },
    });
    if (!campaign) throw new NotFoundException("Campanha não encontrada.");
    return this.serialize(campaign);
  }

  async create(companyIdInput: string | null | undefined, userId: string, dto: CreateCampaignDto) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    const campaign = await this.prisma.campaign.create({
      data: {
        companyId,
        name: dto.name.trim(),
        objective: dto.objective,
        budgetTotal: dto.budgetTotal,
        dailyBudget: dto.dailyBudget,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        notes: dto.notes?.trim() || undefined,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        companyId,
        action: "campaign.created",
        metadata: { campaignId: campaign.id, name: campaign.name, objective: campaign.objective },
      },
    });

    return this.serialize(campaign);
  }

  async update(companyIdInput: string | null | undefined, userId: string, id: string, dto: UpdateCampaignDto) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    const existing = await this.prisma.campaign.findFirst({ where: { id, companyId } });
    if (!existing) throw new NotFoundException("Campanha não encontrada.");

    const campaign = await this.prisma.campaign.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        objective: dto.objective,
        status: dto.status,
        budgetTotal: dto.budgetTotal,
        dailyBudget: dto.dailyBudget,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        notes: dto.notes === undefined ? undefined : dto.notes.trim() || null,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        companyId,
        action: "campaign.updated",
        metadata: { campaignId: id, fields: Object.keys(dto) },
      },
    });

    return this.serialize(campaign);
  }

  async remove(companyIdInput: string | null | undefined, userId: string, id: string) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    const existing = await this.prisma.campaign.findFirst({ where: { id, companyId } });
    if (!existing) throw new NotFoundException("Campanha não encontrada.");

    await this.prisma.campaign.delete({ where: { id } });
    await this.prisma.auditLog.create({
      data: { userId, companyId, action: "campaign.deleted", metadata: { campaignId: id, name: existing.name } },
    });

    return { ok: true };
  }
}
