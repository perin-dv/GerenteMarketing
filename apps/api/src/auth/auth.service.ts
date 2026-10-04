import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { compare } from "bcryptjs";
import { PrismaService } from "../prisma.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(emailInput: string, password: string) {
    const email = emailInput.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          include: { company: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!user || !user.active || !(await compare(password, user.passwordHash))) {
      throw new UnauthorizedException("E-mail ou senha inválidos.");
    }

    const companies = user.memberships.map((membership) => ({
      id: membership.company.id,
      name: membership.company.name,
      slug: membership.company.slug,
      role: membership.role,
    }));

    const token = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      companyId: companies[0]?.id ?? null,
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        companyId: companies[0]?.id,
        action: "AUTH_LOGIN_SUCCESS",
      },
    });

    return {
      token,
      user: { id: user.id, email: user.email, name: user.name },
      companies,
    };
  }

  async me(userId: string, activeCompanyId?: string | null) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: { company: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!user || !user.active) {
      throw new UnauthorizedException();
    }

    const companies = user.memberships.map((membership) => ({
      id: membership.company.id,
      name: membership.company.name,
      slug: membership.company.slug,
      role: membership.role,
    }));

    if (activeCompanyId) {
      companies.sort((a, b) => {
        const aActive = a.id === activeCompanyId ? 1 : 0;
        const bActive = b.id === activeCompanyId ? 1 : 0;
        return bActive - aActive;
      });
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      activeCompanyId: activeCompanyId ?? companies[0]?.id ?? null,
      companies,
    };
  }
}
