import { ForbiddenException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { IntegrationProvider } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../prisma.service";

@Injectable()
export class MetaBusinessLoginService {
  constructor(private readonly prisma: PrismaService) {}

  async createOauthUrl(companyIdInput: string | null | undefined, userId: string) {
    if (!companyIdInput) throw new ForbiddenException("Nenhuma empresa ativa na sessão.");

    const appId = process.env.META_APP_ID;
    const redirectUri = process.env.META_REDIRECT_URI;
    const configId = process.env.META_LOGIN_CONFIG_ID;

    if (!appId || !redirectUri || !configId) {
      throw new ServiceUnavailableException(
        "Configure META_APP_ID, META_REDIRECT_URI e META_LOGIN_CONFIG_ID antes de conectar a Meta.",
      );
    }

    await this.prisma.integrationOAuthState.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    const state = randomBytes(32).toString("hex");
    await this.prisma.integrationOAuthState.create({
      data: {
        companyId: companyIdInput,
        userId,
        provider: IntegrationProvider.META_INSTAGRAM,
        state,
        expiresAt: new Date(Date.now() + 10 * 60_000),
      },
    });

    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      state,
      response_type: "code",
      config_id: configId,
      override_default_response_type: "true",
    });

    return {
      url: `https://www.facebook.com/${process.env.META_GRAPH_VERSION || "v26.0"}/dialog/oauth?${params.toString()}`,
      flow: "FACEBOOK_LOGIN_FOR_BUSINESS",
      expiresInSeconds: 600,
    };
  }
}
