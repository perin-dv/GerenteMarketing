import { Controller, Get, Param, Req, UseGuards } from "@nestjs/common";
import { AuthGuard, type AuthenticatedRequest } from "../auth/auth.guard";
import { WhatsappConversationService } from "./whatsapp-conversation.service";

@Controller("leads")
@UseGuards(AuthGuard)
export class WhatsappConversationController {
  constructor(private readonly conversations: WhatsappConversationService) {}

  @Get(":id/messages")
  list(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
  ) {
    return this.conversations.listLeadMessages(request.user?.companyId, id);
  }
}
