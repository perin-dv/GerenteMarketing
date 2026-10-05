import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import {
  CampaignChannel,
  CampaignMode,
  CampaignObjective,
  CampaignStatus,
  ContentStatus,
  ContentType,
  Prisma,
  RecommendationStatus,
  RecommendationType,
} from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { CreateAcquisitionPlanDto } from "./acquisition.dto";

@Injectable()
export class AcquisitionService {
  constructor(private readonly prisma: PrismaService) {}

  private companyIdOrThrow(companyId: string | null | undefined) {
    if (!companyId) throw new ForbiddenException("Nenhuma empresa ativa na sessão.");
    return companyId;
  }

  private json(value: unknown): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }

  private contentBlueprints(offer: string, audience: string) {
    return [
      {
        pillar: "PROBLEMA",
        hook: `Se você é ${audience}, provavelmente já perdeu tempo ou dinheiro com isso.`,
        angle: `Mostre o problema que ${offer} resolve e por que ele merece atenção agora.`,
      },
      {
        pillar: "EDUCAÇÃO",
        hook: `3 coisas para saber antes de escolher ${offer}.`,
        angle: `Ensine algo útil e simples que ajude o público a tomar uma decisão melhor.`,
      },
      {
        pillar: "PROVA",
        hook: `Veja como ${offer} resolve uma situação real sem complicação.`,
        angle: `Use demonstração, bastidor, comparação, resultado ou caso real quando houver evidência.`,
      },
      {
        pillar: "OBJEÇÃO",
        hook: `Vale a pena escolher ${offer}? Depende destes pontos.`,
        angle: `Responda uma objeção frequente de preço, prazo, qualidade, confiança ou compatibilidade.`,
      },
      {
        pillar: "OFERTA",
        hook: `${offer}: o próximo passo pode ser mais simples do que parece.`,
        angle: `Apresente a oferta com benefício claro e CTA direto para conversa ou orçamento.`,
      },
      {
        pillar: "COMPARAÇÃO",
        hook: `O que muda entre uma escolha comum e uma escolha certa em ${offer}?`,
        angle: `Compare critérios reais sem prometer resultado garantido e ajude o público a escolher.`,
      },
    ];
  }

  private defaultCta(objective: CampaignObjective) {
    if (objective === CampaignObjective.WHATSAPP || objective === CampaignObjective.LEADS || objective === CampaignObjective.SALES) {
      return "Chame no WhatsApp para tirar sua dúvida ou pedir orçamento.";
    }
    return "Siga o perfil e acompanhe os próximos conteúdos.";
  }

  private caption(offer: string, audience: string, region: string | undefined, hook: string, cta: string) {
    const location = region?.trim() ? ` para ${audience} em ${region.trim()}` : ` para ${audience}`;
    return `${hook}\n\nConteúdo sobre ${offer}${location}. Informação prática, sem promessa de resultado garantido.\n\n${cta}`;
  }

  private schedule(start: Date, index: number, total: number, days: number) {
    const offset = total <= 1 ? 0 : Math.round((index * Math.max(0, days - 1)) / (total - 1));
    const date = new Date(start.getTime() + offset * 86_400_000);
    date.setHours(index % 2 === 0 ? 12 : 19, 0, 0, 0);
    if (date.getTime() < Date.now() + 10 * 60_000) date.setDate(date.getDate() + 1);
    return date;
  }

  async list(companyIdInput: string | null | undefined) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    const campaigns = await this.prisma.campaign.findMany({
      where: { companyId, notes: { startsWith: "[ACQUISITION]" } },
      include: {
        contentItems: {
          orderBy: { scheduledAt: "asc" },
          select: {
            id: true,
            title: true,
            type: true,
            channel: true,
            status: true,
            hook: true,
            script: true,
            caption: true,
            cta: true,
            scheduledAt: true,
            metadata: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return campaigns;
  }

  async create(companyIdInput: string | null | undefined, userId: string, dto: CreateAcquisitionPlanDto) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new BadRequestException("Empresa não encontrada.");

    const includeInstagram = dto.includeInstagram !== false;
    const includeTikTok = dto.includeTikTok !== false;
    if (!includeInstagram && !includeTikTok) {
      throw new BadRequestException("Selecione pelo menos Instagram ou TikTok para aquisição.");
    }

    const objective = dto.objective ?? CampaignObjective.LEADS;
    const days = dto.days ?? 14;
    const videosPerWeek = dto.videosPerWeek ?? 3;
    const totalIdeas = Math.max(2, Math.min(20, Math.ceil((days / 7) * videosPerWeek)));
    const offer = dto.offer.trim();
    const audience = dto.audience.trim();
    const region = dto.region?.trim() || undefined;
    const cta = dto.cta?.trim() || this.defaultCta(objective);
    const channels: CampaignChannel[] = [];
    if (includeInstagram) channels.push(CampaignChannel.INSTAGRAM);
    if (includeTikTok) channels.push(CampaignChannel.TIKTOK);
    const blueprints = this.contentBlueprints(offer, audience);
    const start = new Date();
    const end = new Date(start.getTime() + (days - 1) * 86_400_000);

    const result = await this.prisma.$transaction(async (tx) => {
      const campaign = await tx.campaign.create({
        data: {
          companyId,
          name: `${offer} · Aquisição`,
          mode: CampaignMode.ORGANIC,
          channel: channels.length > 1 ? CampaignChannel.MULTICHANNEL : channels[0]!,
          objective,
          status: CampaignStatus.ACTIVE,
          budgetTotal: 0,
          plannedReels: includeInstagram ? totalIdeas : 0,
          plannedPosts: 0,
          plannedStories: 0,
          startDate: start,
          endDate: end,
          notes: `[ACQUISITION] Público: ${audience}${region ? ` · Região: ${region}` : ""} · Bootstrap sem histórico obrigatório.`,
        },
      });

      const items = [];
      let sequence = 0;
      for (let ideaIndex = 0; ideaIndex < totalIdeas; ideaIndex += 1) {
        const blueprint = blueprints[ideaIndex % blueprints.length]!;
        for (const channel of channels) {
          const scheduledAt = this.schedule(start, sequence, totalIdeas * channels.length, days);
          const platformInstruction = channel === CampaignChannel.TIKTOK
            ? "Vídeo vertical curto, ritmo rápido, gancho nos 2 primeiros segundos e CTA falado/visual no final."
            : "Reel vertical curto, gancho nos 2 primeiros segundos, demonstração objetiva e CTA para conversa.";
          const title = `${offer} · ${blueprint.pillar} · ${channel === CampaignChannel.TIKTOK ? "TikTok" : "Instagram"}`;
          const caption = this.caption(offer, audience, region, blueprint.hook, cta);
          const item = await tx.contentItem.create({
            data: {
              companyId,
              campaignId: campaign.id,
              type: channel === CampaignChannel.TIKTOK ? ContentType.VIDEO : ContentType.REEL,
              status: ContentStatus.IDEA,
              title,
              hook: blueprint.hook,
              script: `${blueprint.angle}\n\n${platformInstruction}\n\nPúblico: ${audience}${region ? ` em ${region}` : ""}.`,
              caption,
              cta,
              channel,
              scheduledAt,
              metadata: this.json({
                acquisition: {
                  offer,
                  audience,
                  region: region || null,
                  pillar: blueprint.pillar,
                  bootstrap: true,
                  historicalDataRequired: false,
                  goal: objective,
                  nextStep: "PRODUCE_OR_ATTACH_MEDIA",
                },
              }),
            },
          });
          items.push(item);
          sequence += 1;
        }
      }

      await tx.recommendation.createMany({
        data: [
          {
            companyId,
            type: RecommendationType.CONTENT,
            status: RecommendationStatus.OPEN,
            title: `Aquisição: produzir os criativos de ${offer}`,
            rationale: `O plano começou sem depender de seguidores ou histórico. Há ${totalIdeas} ideias de criativos para testar em ${channels.length} canal(is).`,
            actionText: "Produza ou anexe os vídeos da fila e publique pelos canais oficiais conectados.",
            confidence: 0.8,
            impactScore: 90,
            evidence: this.json({ campaignId: campaign.id, totalIdeas, channels }),
          },
          {
            companyId,
            type: RecommendationType.GOAL,
            status: RecommendationStatus.OPEN,
            title: "Medir cliente, não só seguidor",
            rationale: "O objetivo principal do motor de aquisição é aumentar conversas, leads e vendas; seguidores entram como sinal secundário.",
            actionText: "Acompanhe CTA para WhatsApp, leads novos e conversões por campanha.",
            confidence: 0.95,
            impactScore: 100,
            evidence: this.json({ campaignId: campaign.id, objective }),
          },
        ],
      });

      await tx.auditLog.create({
        data: {
          userId,
          companyId,
          action: "acquisition.plan.created",
          metadata: this.json({ campaignId: campaign.id, offer, audience, region, days, totalIdeas, channels }),
        },
      });

      return { campaign, items };
    });

    return {
      ok: true,
      campaign: result.campaign,
      items: result.items,
      bootstrap: true,
      message: "Plano de aquisição criado sem exigir seguidores, leads ou histórico prévio.",
    };
  }
}
