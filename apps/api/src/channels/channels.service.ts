import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  GoalMetric,
  GoalStatus,
  IntegrationProvider,
  IntegrationStatus,
  LeadSource,
  MetricKey,
  Prisma,
} from "@prisma/client";
import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";
import { PrismaService } from "../prisma.service";

@Injectable()
export class ChannelsService {
  constructor(private readonly prisma: PrismaService) {}

  private companyIdOrThrow(companyId: string | null | undefined) {
    if (!companyId) throw new ForbiddenException("Nenhuma empresa ativa na sessão.");
    return companyId;
  }

  private key() {
    const key = Buffer.from(process.env.INTEGRATION_ENCRYPTION_KEY || "", "base64");
    if (key.length !== 32) throw new ServiceUnavailableException("INTEGRATION_ENCRYPTION_KEY inválida.");
    return key;
  }

  private encrypt(value: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key(), iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
  }

  private decrypt(value: string) {
    const parts = value.split(".");
    const ivRaw = parts[0];
    const tagRaw = parts[1];
    const encryptedRaw = parts[2];
    if (!ivRaw || !tagRaw || !encryptedRaw) throw new BadRequestException("Credencial criptografada inválida.");
    const decipher = createDecipheriv("aes-256-gcm", this.key(), Buffer.from(ivRaw, "base64url"));
    decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(encryptedRaw, "base64url")), decipher.final()]).toString("utf8");
  }

  private json(value: unknown): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }

  private async external<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, init);
    const text = await response.text();
    let data: unknown = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    if (!response.ok) throw new BadRequestException(`Canal externo respondeu HTTP ${response.status}: ${text.slice(0, 500)}`);
    return data as T;
  }

  async tiktokOauthUrl(companyIdInput: string | null | undefined, userId: string) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const redirectUri = process.env.TIKTOK_REDIRECT_URI;
    if (!clientKey || !process.env.TIKTOK_CLIENT_SECRET || !redirectUri) {
      throw new ServiceUnavailableException("Configure TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET e TIKTOK_REDIRECT_URI.");
    }
    const state = randomBytes(32).toString("hex");
    await this.prisma.integrationOAuthState.create({
      data: {
        companyId,
        userId,
        provider: IntegrationProvider.TIKTOK,
        state,
        expiresAt: new Date(Date.now() + 10 * 60_000),
      },
    });
    const params = new URLSearchParams({
      client_key: clientKey,
      response_type: "code",
      scope: "user.info.basic,user.info.stats,video.list",
      redirect_uri: redirectUri,
      state,
    });
    return { url: `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`, expiresInSeconds: 600 };
  }

  async completeTiktokOauth(code: string, state: string) {
    const pending = await this.prisma.integrationOAuthState.findUnique({ where: { state } });
    if (!pending || pending.provider !== IntegrationProvider.TIKTOK || pending.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException("Estado OAuth do TikTok inválido ou expirado.");
    }
    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
    const redirectUri = process.env.TIKTOK_REDIRECT_URI;
    if (!clientKey || !clientSecret || !redirectUri) throw new ServiceUnavailableException("TikTok não configurado.");

    const body = new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    });
    const token = await this.external<{
      access_token: string;
      refresh_token?: string;
      open_id?: string;
      expires_in?: number;
      scope?: string;
    }>("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const profile = await this.external<{
      data?: { user?: { open_id?: string; display_name?: string; username?: string; follower_count?: number; video_count?: number; likes_count?: number } };
    }>("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,username,follower_count,video_count,likes_count", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const user = profile.data?.user;
    const externalAccountId = user?.open_id || token.open_id;
    if (!externalAccountId) throw new BadRequestException("TikTok não retornou open_id da conta autorizada.");

    const existing = await this.prisma.integrationAccount.findFirst({
      where: { companyId: pending.companyId, provider: IntegrationProvider.TIKTOK, externalAccountId },
    });
    const common = {
      status: IntegrationStatus.CONNECTED,
      displayName: user?.display_name || user?.username || "TikTok",
      username: user?.username,
      accessTokenCiphertext: this.encrypt(token.access_token),
      refreshTokenCiphertext: token.refresh_token ? this.encrypt(token.refresh_token) : null,
      scopes: token.scope ? token.scope.split(",").map((scope) => scope.trim()).filter(Boolean) : ["user.info.basic", "user.info.stats", "video.list"],
      tokenExpiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null,
      metadata: this.json({ platform: "tiktok" }),
      errorMessage: null,
    };
    if (existing) {
      await this.prisma.integrationAccount.update({ where: { id: existing.id }, data: common });
    } else {
      await this.prisma.integrationAccount.create({
        data: { companyId: pending.companyId, provider: IntegrationProvider.TIKTOK, externalAccountId, ...common },
      });
    }
    await this.prisma.integrationOAuthState.delete({ where: { id: pending.id } });
    await this.prisma.auditLog.create({
      data: { userId: pending.userId, companyId: pending.companyId, action: "integration.tiktok.connected", metadata: this.json({ externalAccountId }) },
    });
    return { connected: true, displayName: common.displayName };
  }

  private async writeMetric(companyId: string, metric: MetricKey, value: number, source: IntegrationProvider, metadata?: Prisma.InputJsonValue) {
    await this.prisma.metricSnapshot.create({ data: { companyId, metric, value, source, metadata } });
    if (Object.values(GoalMetric).includes(metric as unknown as GoalMetric)) {
      await this.prisma.goal.updateMany({
        where: { companyId, metric: metric as unknown as GoalMetric, status: GoalStatus.ACTIVE },
        data: { currentValue: value },
      });
    }
  }

  async syncTiktok(companyIdInput: string | null | undefined, userId: string) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    const accounts = await this.prisma.integrationAccount.findMany({
      where: { companyId, provider: IntegrationProvider.TIKTOK, status: IntegrationStatus.CONNECTED },
    });
    if (!accounts.length) throw new BadRequestException("Nenhuma conta TikTok conectada.");
    const results: Array<{ id: string; ok: boolean; error?: string }> = [];
    for (const account of accounts) {
      if (!account.accessTokenCiphertext) continue;
      try {
        const accessToken = this.decrypt(account.accessTokenCiphertext);
        const profile = await this.external<{
          data?: { user?: { follower_count?: number; video_count?: number; likes_count?: number } };
        }>("https://open.tiktokapis.com/v2/user/info/?fields=follower_count,video_count,likes_count", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const user = profile.data?.user;
        if (typeof user?.follower_count === "number") await this.writeMetric(companyId, MetricKey.FOLLOWERS, user.follower_count, IntegrationProvider.TIKTOK);
        if (typeof user?.video_count === "number") await this.writeMetric(companyId, MetricKey.CONTENT_PUBLISHED, user.video_count, IntegrationProvider.TIKTOK);
        const videos = await this.external<{
          data?: { videos?: Array<{ view_count?: number; like_count?: number; comment_count?: number; share_count?: number }> };
        }>("https://open.tiktokapis.com/v2/video/list/?fields=id,view_count,like_count,comment_count,share_count", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ max_count: 20 }),
        });
        const items = videos.data?.videos ?? [];
        const views = items.reduce((sum, item) => sum + (item.view_count || 0), 0);
        const engagements = items.reduce((sum, item) => sum + (item.like_count || 0) + (item.comment_count || 0) + (item.share_count || 0), 0);
        await this.writeMetric(companyId, MetricKey.VIEWS, views, IntegrationProvider.TIKTOK, this.json({ sample: "latest_20_videos", count: items.length }));
        await this.writeMetric(companyId, MetricKey.ENGAGEMENTS, engagements, IntegrationProvider.TIKTOK, this.json({ sample: "latest_20_videos", count: items.length }));
        await this.prisma.integrationAccount.update({ where: { id: account.id }, data: { lastSyncedAt: new Date(), errorMessage: null } });
        results.push({ id: account.id, ok: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Falha desconhecida";
        await this.prisma.integrationAccount.update({ where: { id: account.id }, data: { errorMessage: message } });
        results.push({ id: account.id, ok: false, error: message });
      }
    }
    await this.prisma.auditLog.create({
      data: { userId, companyId, action: "integration.tiktok.synced", metadata: this.json({ accounts: results.length }) },
    });
    return { results };
  }

  async connectTelegram(companyIdInput: string | null | undefined, userId: string) {
    const companyId = this.companyIdOrThrow(companyIdInput);
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) throw new ServiceUnavailableException("TELEGRAM_BOT_TOKEN não configurado.");
    const me = await this.external<{ ok: boolean; result?: { id: number; username?: string; first_name?: string } }>(
      `https://api.telegram.org/bot${botToken}/getMe`,
    );
    if (!me.ok || !me.result) throw new BadRequestException("Telegram não validou o bot.");
    const externalAccountId = String(me.result.id);
    const existing = await this.prisma.integrationAccount.findFirst({
      where: { companyId, provider: IntegrationProvider.TELEGRAM, externalAccountId },
    });
    const common = {
      status: IntegrationStatus.CONNECTED,
      displayName: me.result.first_name || me.result.username || "Telegram Bot",
      username: me.result.username,
      accessTokenCiphertext: this.encrypt(botToken),
      scopes: ["bot_api"],
      metadata: this.json({ botId: externalAccountId, botUsername: me.result.username || null }),
      errorMessage: null,
    };
    const account = existing
      ? await this.prisma.integrationAccount.update({ where: { id: existing.id }, data: common })
      : await this.prisma.integrationAccount.create({
          data: { companyId, provider: IntegrationProvider.TELEGRAM, externalAccountId, ...common },
        });

    const publicBase = process.env.PUBLIC_API_BASE_URL?.replace(/\/$/, "");
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    let webhookConfigured = false;
    if (publicBase?.startsWith("https://") && secret) {
      const result = await this.external<{ ok: boolean }>(`https://api.telegram.org/bot${botToken}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: `${publicBase}/channels/telegram/webhook/${account.id}`,
          secret_token: secret,
          allowed_updates: ["message"],
        }),
      });
      webhookConfigured = result.ok;
    }
    await this.prisma.auditLog.create({
      data: { userId, companyId, action: "integration.telegram.connected", metadata: this.json({ integrationId: account.id, webhookConfigured }) },
    });
    return { id: account.id, displayName: account.displayName, webhookConfigured };
  }

  private verifyTelegramSecret(received?: string) {
    const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!expected || !received) throw new ForbiddenException("Secret do webhook Telegram ausente.");
    const left = Buffer.from(received);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !timingSafeEqual(left, right)) throw new ForbiddenException("Secret do webhook Telegram inválido.");
  }

  async receiveTelegramWebhook(integrationId: string, secret: string | undefined, payload: any) {
    this.verifyTelegramSecret(secret);
    const integration = await this.prisma.integrationAccount.findFirst({
      where: { id: integrationId, provider: IntegrationProvider.TELEGRAM, status: IntegrationStatus.CONNECTED },
    });
    if (!integration) throw new BadRequestException("Integração Telegram não encontrada.");
    const message = payload?.message;
    const chatId = message?.chat?.id != null ? String(message.chat.id) : "";
    if (!chatId) return { ok: true, ignored: true };
    const name = [message?.from?.first_name, message?.from?.last_name].filter(Boolean).join(" ") || message?.from?.username;
    let lead = await this.prisma.lead.findFirst({
      where: { companyId: integration.companyId, source: LeadSource.TELEGRAM, externalId: chatId },
    });
    let isNew = false;
    if (!lead) {
      lead = await this.prisma.lead.create({
        data: { companyId: integration.companyId, source: LeadSource.TELEGRAM, externalId: chatId, name: name || undefined, metadata: this.json({ username: message?.from?.username || null }) },
      });
      isNew = true;
    }
    const cutoff = new Date(Date.now() - 24 * 60 * 60_000);
    const conversation = await this.prisma.conversation.findFirst({
      where: { companyId: integration.companyId, leadId: lead.id, source: LeadSource.TELEGRAM, lastMessageAt: { gte: cutoff } },
      orderBy: { lastMessageAt: "desc" },
    });
    if (conversation) {
      await this.prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date(), messageCount: { increment: 1 } } });
    } else {
      await this.prisma.conversation.create({ data: { companyId: integration.companyId, leadId: lead.id, source: LeadSource.TELEGRAM, externalId: String(message?.message_id || ""), messageCount: 1 } });
    }
    if (isNew) {
      const leadCount = await this.prisma.lead.count({ where: { companyId: integration.companyId } });
      await this.writeMetric(integration.companyId, MetricKey.LEADS, leadCount, IntegrationProvider.TELEGRAM, this.json({ source: "telegram_webhook" }));
    }
    return { ok: true, leadId: lead.id, isNew };
  }
}
