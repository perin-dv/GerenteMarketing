import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { CompanyStatus, UserRole } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../prisma.service";

@Injectable()
export class WorkspaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async list(userId: string, activeCompanyId: string | null | undefined) {
    const memberships = await this.prisma.membership.findMany({
      where: { userId, company: { status: CompanyStatus.ACTIVE } },
      include: { company: true },
      orderBy: { createdAt: "asc" },
    });
    return memberships.map((membership) => ({
      id: membership.company.id,
      name: membership.company.name,
      slug: membership.company.slug,
      role: membership.role,
      active: membership.company.id === activeCompanyId,
    }));
  }

  async switch(userId: string, email: string, companyId: string) {
    const membership = await this.prisma.membership.findFirst({
      where: { userId, companyId, company: { status: CompanyStatus.ACTIVE } },
      include: { company: true },
    });
    if (!membership) throw new ForbiddenException("Você não possui acesso a este workspace.");
    const token = await this.jwt.signAsync({ sub: userId, email, companyId });
    await this.prisma.auditLog.create({
      data: {
        userId,
        companyId,
        action: "workspace.switched",
        metadata: { companyName: membership.company.name, role: membership.role },
      },
    });
    return { token, company: { id: membership.company.id, name: membership.company.name, slug: membership.company.slug, role: membership.role } };
  }

  private baseSlug(name: string) {
    return name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "workspace";
  }

  async create(userId: string, nameInput: string) {
    const name = nameInput.trim();
    const base = this.baseSlug(name);
    let slug = base;
    const exists = await this.prisma.company.findUnique({ where: { slug } });
    if (exists) slug = `${base}-${randomBytes(3).toString("hex")}`;

    const company = await this.prisma.company.create({
      data: {
        name,
        slug,
        memberships: { create: { userId, role: UserRole.OWNER } },
        autopilotPolicy: { create: { enabled: false, killSwitch: true, allowBudgetChanges: false } },
      },
    });
    await this.prisma.auditLog.create({
      data: { userId, companyId: company.id, action: "workspace.created", metadata: { name: company.name, slug: company.slug } },
    });
    return { id: company.id, name: company.name, slug: company.slug, role: UserRole.OWNER };
  }

  async assertOwner(userId: string, companyId: string) {
    const membership = await this.prisma.membership.findUnique({ where: { userId_companyId: { userId, companyId } } });
    if (!membership) throw new NotFoundException("Workspace não encontrado.");
    if (membership.role !== UserRole.OWNER && membership.role !== UserRole.ADMIN) {
      throw new ForbiddenException("Apenas owner/admin pode administrar este workspace.");
    }
    return membership;
  }
}
