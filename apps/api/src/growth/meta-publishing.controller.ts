import { Body, Controller, Param, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard, type AuthenticatedRequest } from "../auth/auth.guard";
import { PublishMetaContentDto } from "./meta-publishing.dto";
import { MetaPublishingService } from "./meta-publishing.service";

@Controller("content")
@UseGuards(AuthGuard)
export class MetaPublishingController {
  constructor(private readonly publisher: MetaPublishingService) {}

  @Post(":id/publish/meta")
  publish(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() dto: PublishMetaContentDto,
  ) {
    return this.publisher.publish(request.user?.companyId, request.user!.sub, id, dto);
  }
}
