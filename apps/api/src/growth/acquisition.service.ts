import { BadRequestException, ForbiddenException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import {
  CampaignChannel,
  CampaignMode,
  CampaignObjective,
  CampaignStatus,
  ContentStatus,
  ContentType,
  LeadSource,
  LeadStage,
  Prisma,
  RecommendationStatus,
  RecommendationType,
} from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { CreateAcquisitionPlanDto, ImportAcquisitionProspectDto, PrepareAcquisitionOutreachDto, UpdateAcquisitionOutreachDto } from "./acquisition.dto";

type NominatimPlace = {
  place_id?: number;
  osm_type?: string;
  osm_id?: number;
  name?: string;
  display_name?: string;
  category?: string;
  type?: string;
  lat?: string;
  lon?: string;
  extratags?: Record<string, string>;
  namedetails?: Record<string, string>;
};

@Injectable()
export class AcquisitionService {
  private lastProspectSearchAt = 0;

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
        angle: "Ensine algo útil e simples que ajude o público a tomar uma decisão melhor.",
      },
      {
        pillar: "PROVA",
        hook: `Veja como ${offer} resolve uma situação real sem complicação.`,
        angle: "Use demonstração, bastidor, comparação, resultado ou caso real quando houver evidência.",
      },
      {
        pillar: "OBJEÇÃO",
        hook: `Vale a pena escolher ${offer}? Depende destes pontos.`,
        angle: "Responda uma objeção frequente de preço, prazo, qualidade, confiança ou compatibilidade.",
      },
      {
        pillar: "OFERTA",
        hook: `${offer}: o próximo passo pode ser mais simples do que parece.`,
        angle: "Apresente a oferta com benefício claro e CTA direto para conversa ou orçamento.",
      },
      {
        pillar: "COMPARAÇÃO",
        hook: `O que muda entre uma escolha comum e uma escolha certa em ${offer}?`,
        angle: "Compare critérios reais sem prometer resultado garantido e ajude o público a escolher.",
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
    return this.prisma.campaign.findMany({
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
          const item = await tx.contentItem.create({
            data: {
              companyId,
              campaignId: campaign.id,
              type: channel === CampaignChannel.TIKTOK ? ContentType.VIDEO : ContentType.REEL,
              status: ContentStatus.IDEA,
              title,
              hook: blueprint.hook,
              script: `${blueprint.angle}\n\n${platformInstruction}\n\nPúblico: ${audience}${region ? ` em ${region}` : ""}.`,
              caption: this.caption(offer, audience, region, blueprint.hook, cta),
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

  async searchProspects(
    companyIdInput: string | null | undefined,
    userId: string,
    queryInput: string | undefined,
    regionInput: string | undefined,
  ) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    const query = String(queryInput || "").trim();
    const region = String(regionInput || "").trim();
    if (query.length < 3) throw new BadRequestException("Informe o tipo de cliente que deseja encontrar.");

    const elapsed = Date.now() - this.lastProspectSearchAt;
    if (elapsed < 1100) await new Promise((resolve) => setTimeout(resolve, 1100 - elapsed));
    this.lastProspectSearchAt = Date.now();

    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("q", region ? `${query}, ${region}` : query);
    url.searchParams.set("limit", "15");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("extratags", "1");
    url.searchParams.set("namedetails", "1");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let places: NominatimPlace[];
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "GerenteMarketing/0.1 public-prospect-research",
          Accept: "application/json",
        },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      places = await response.json() as NominatimPlace[];
    } catch {
      throw new ServiceUnavailableException("A fonte pública de empresas não respondeu agora. Tente novamente em alguns segundos.");
    } finally {
      clearTimeout(timeout);
    }

    const results = places.map((place) => {
      const extras = place.extratags || {};
      const name = place.name || place.namedetails?.name || String(place.display_name || "").split(",")[0] || "Estabelecimento";
      return {
        sourceRef: place.place_id ? `osm:${place.place_id}` : `${place.osm_type || "osm"}:${place.osm_id || "unknown"}`,
        name,
        category: place.type || place.category || "business",
        address: place.display_name || "",
        phone: extras.phone || extras["contact:phone"] || extras["contact:mobile"] || "",
        email: extras.email || extras["contact:email"] || "",
        website: extras.website || extras["contact:website"] || "",
        latitude: place.lat || null,
        longitude: place.lon || null,
        publicSource: "OpenStreetMap/Nominatim",
      };
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        companyId,
        action: "acquisition.prospects.searched",
        metadata: this.json({ query, region: region || null, results: results.length, source: "OpenStreetMap/Nominatim" }),
      },
    });

    return { query, region: region || null, results };
  }

  async importProspect(
    companyIdInput: string | null | undefined,
    userId: string,
    dto: ImportAcquisitionProspectDto,
  ) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    const phone = String(dto.phone || "").replace(/\D/g, "") || undefined;
    const email = dto.email?.trim().toLowerCase() || undefined;
    const externalId = dto.sourceRef?.trim() || undefined;
    const conditions: Prisma.LeadWhereInput[] = [];
    if (phone) conditions.push({ phone });
    if (email) conditions.push({ email });
    if (externalId) conditions.push({ externalId });

    if (conditions.length) {
      const existing = await this.prisma.lead.findFirst({ where: { companyId, OR: conditions } });
      if (existing) return { ok: true, duplicate: true, lead: existing };
    }

    const lead = await this.prisma.lead.create({
      data: {
        companyId,
        name: dto.name.trim(),
        phone,
        email,
        source: LeadSource.OTHER,
        externalId,
        campaignTag: "PUBLIC_PROSPECTING",
        notes: dto.address?.trim() || undefined,
        metadata: this.json({
          publicProspect: true,
          publicSource: "OpenStreetMap/Nominatim",
          website: dto.website?.trim() || null,
          category: dto.category?.trim() || null,
          address: dto.address?.trim() || null,
          importedAt: new Date().toISOString(),
          outreachStatus: "REVIEW_REQUIRED",
        }),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        companyId,
        action: "acquisition.prospect.imported",
        metadata: this.json({ leadId: lead.id, source: "OpenStreetMap/Nominatim" }),
      },
    });

    return { ok: true, duplicate: false, lead };
  }

  private metadataObject(value: Prisma.JsonValue | null | undefined): Record<string, any> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? { ...(value as Record<string, any>) }
      : {};
  }

  private prospectScore(lead: { phone?: string | null; email?: string | null; metadata?: Prisma.JsonValue | null }) {
    const metadata = this.metadataObject(lead.metadata);
    let score = 10;
    if (lead.phone) score += 35;
    if (lead.email) score += 25;
    if (metadata.website) score += 15;
    if (metadata.category) score += 10;
    if (metadata.address) score += 5;
    return Math.min(100, score);
  }

  async listCrmProspects(companyIdInput: string | null | undefined) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    const leads = await this.prisma.lead.findMany({
      where: { companyId, campaignTag: "PUBLIC_PROSPECTING" },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });

    const items = leads.map((lead) => {
      const metadata = this.metadataObject(lead.metadata);
      const outreach = this.metadataObject(metadata.outreach);
      const nextFollowUpAt = typeof outreach.nextFollowUpAt === "string" ? outreach.nextFollowUpAt : null;
      const due = Boolean(nextFollowUpAt && new Date(nextFollowUpAt).getTime() <= Date.now());
      const score = this.prospectScore(lead);
      const outreachStatus = typeof outreach.status === "string"
        ? outreach.status
        : typeof metadata.outreachStatus === "string"
          ? metadata.outreachStatus
          : "REVIEW_REQUIRED";

      let priority: "HOT" | "WARM" | "REVIEW" | "DONE" = "REVIEW";
      let priorityReason = "Revisar dados públicos e decidir se vale uma abordagem.";
      if (lead.stage === LeadStage.WON || lead.stage === LeadStage.LOST) {
        priority = "DONE";
        priorityReason = lead.stage === LeadStage.WON ? "Prospect convertido em cliente." : "Prospect encerrado sem interesse.";
      } else if (due) {
        priority = "HOT";
        priorityReason = "Follow-up vencido: precisa de ação hoje.";
      } else if (outreachStatus === "REPLIED") {
        priority = "HOT";
        priorityReason = "Prospect respondeu e está mais perto de avançar.";
      } else if (score >= 70 && ["DRAFT_READY", "CONTACTED", "FOLLOW_UP_DUE"].includes(outreachStatus)) {
        priority = "HOT";
        priorityReason = "Boa qualidade de contato e abordagem já iniciada.";
      } else if (score >= 50 || ["DRAFT_READY", "CONTACTED"].includes(outreachStatus)) {
        priority = "WARM";
        priorityReason = outreachStatus === "DRAFT_READY"
          ? "Abordagem pronta para revisão e primeiro contato."
          : "Prospect com dados suficientes para priorizar.";
      }

      const priorityWeight = priority === "HOT" ? 3 : priority === "WARM" ? 2 : priority === "REVIEW" ? 1 : 0;
      return {
        id: lead.id,
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        stage: lead.stage,
        source: lead.source,
        notes: lead.notes,
        website: typeof metadata.website === "string" ? metadata.website : null,
        category: typeof metadata.category === "string" ? metadata.category : null,
        address: typeof metadata.address === "string" ? metadata.address : null,
        publicSource: typeof metadata.publicSource === "string" ? metadata.publicSource : null,
        score,
        priority,
        priorityReason,
        priorityWeight,
        outreach: {
          status: outreachStatus,
          offer: typeof outreach.offer === "string" ? outreach.offer : null,
          preparedAt: typeof outreach.preparedAt === "string" ? outreach.preparedAt : null,
          lastContactAt: typeof outreach.lastContactAt === "string" ? outreach.lastContactAt : null,
          nextFollowUpAt,
          due,
          drafts: this.metadataObject(outreach.drafts),
        },
      };
    });

    return items.sort((a, b) =>
      b.priorityWeight - a.priorityWeight ||
      Number(b.outreach.due) - Number(a.outreach.due) ||
      b.score - a.score
    );
  }

  async prepareOutreach(
    companyIdInput: string | null | undefined,
    userId: string,
    leadId: string,
    dto: PrepareAcquisitionOutreachDto,
  ) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, companyId, campaignTag: "PUBLIC_PROSPECTING" },
    });
    if (!lead) throw new BadRequestException("Prospect público não encontrado no CRM.");

    const metadata = this.metadataObject(lead.metadata);
    const category = typeof metadata.category === "string" ? metadata.category : "empresa";
    const offer = dto.offer.trim();
    const note = dto.note?.trim();
    const name = lead.name || "empresa";
    const context = note ? ` Contexto adicional: ${note}` : "";

    const drafts = {
      whatsapp:
        `Olá! Tudo bem? Encontrei o contato comercial da ${name} em uma fonte pública. Trabalho com ${offer} e, pelo perfil de ${category}, achei que pode fazer sentido conversar. Posso te mandar uma apresentação curta?${context} Se não quiser receber contato, me avise e eu não volto a chamar.`,
      emailSubject: `Possível parceria: ${offer}`,
      emailBody:
        `Olá, equipe da ${name}. Encontrei os dados comerciais da empresa em uma fonte pública e estou entrando em contato porque trabalho com ${offer}. Acredito que pode existir uma oportunidade de parceria para o perfil de ${category}. Se fizer sentido, responda este e-mail e eu envio uma apresentação objetiva. Se não houver interesse, sem problema — encerro o contato por aqui.${context}`,
      phoneOpening:
        `Olá, falo com a ${name}? Meu contato é sobre ${offer}. Vi o cadastro comercial público da empresa e queria confirmar se faz sentido eu explicar a proposta em menos de um minuto.`,
      followUp:
        `Olá! Passando apenas para saber se conseguiu ver minha mensagem sobre ${offer}. Se não for prioridade agora, sem problema e encerro por aqui.`,
    };
    const now = new Date().toISOString();
    const nextMetadata = {
      ...metadata,
      outreachStatus: "DRAFT_READY",
      outreach: {
        ...this.metadataObject(metadata.outreach),
        status: "DRAFT_READY",
        offer,
        preparedAt: now,
        lastContactAt: null,
        nextFollowUpAt: null,
        drafts,
      },
    };

    const updated = await this.prisma.lead.update({
      where: { id: lead.id },
      data: { metadata: this.json(nextMetadata) },
    });
    await this.prisma.auditLog.create({
      data: {
        userId,
        companyId,
        action: "acquisition.outreach.prepared",
        metadata: this.json({ leadId: lead.id, offer, automatedSend: false }),
      },
    });

    return {
      ok: true,
      leadId: updated.id,
      score: this.prospectScore(updated),
      outreach: nextMetadata.outreach,
      message: "Abordagem preparada para revisão. Nenhuma mensagem foi enviada automaticamente.",
    };
  }

  async updateOutreach(
    companyIdInput: string | null | undefined,
    userId: string,
    leadId: string,
    dto: UpdateAcquisitionOutreachDto,
  ) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, companyId, campaignTag: "PUBLIC_PROSPECTING" },
    });
    if (!lead) throw new BadRequestException("Prospect público não encontrado no CRM.");

    const metadata = this.metadataObject(lead.metadata);
    const currentOutreach = this.metadataObject(metadata.outreach);
    const now = new Date();
    const followUpDays = dto.followUpDays ?? (dto.status === "REPLIED" ? 2 : 3);
    let nextFollowUpAt: string | null = null;
    let stage = lead.stage;

    if (dto.status === "CONTACTED") {
      stage = LeadStage.CONTACTED;
      nextFollowUpAt = new Date(now.getTime() + followUpDays * 86_400_000).toISOString();
    } else if (dto.status === "REPLIED") {
      stage = LeadStage.CONTACTED;
      nextFollowUpAt = new Date(now.getTime() + followUpDays * 86_400_000).toISOString();
    } else if (dto.status === "FOLLOW_UP_DUE") {
      stage = LeadStage.CONTACTED;
      nextFollowUpAt = now.toISOString();
    } else if (dto.status === "WON") {
      stage = LeadStage.WON;
    } else if (dto.status === "NOT_INTERESTED") {
      stage = LeadStage.LOST;
    }

    const nextOutreach = {
      ...currentOutreach,
      status: dto.status,
      lastContactAt: ["CONTACTED", "REPLIED", "WON", "NOT_INTERESTED"].includes(dto.status)
        ? now.toISOString()
        : currentOutreach.lastContactAt || null,
      nextFollowUpAt,
      updatedAt: now.toISOString(),
    };

    const updated = await this.prisma.lead.update({
      where: { id: lead.id },
      data: {
        stage,
        metadata: this.json({
          ...metadata,
          outreachStatus: dto.status,
          outreach: nextOutreach,
        }),
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId,
        companyId,
        action: "acquisition.outreach.updated",
        metadata: this.json({ leadId: lead.id, status: dto.status, nextFollowUpAt }),
      },
    });

    return { ok: true, leadId: updated.id, stage: updated.stage, outreach: nextOutreach };
  }
}
