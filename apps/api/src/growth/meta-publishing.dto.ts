import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MinLength } from "class-validator";

export enum MetaMediaKind {
  IMAGE = "IMAGE",
  VIDEO = "VIDEO",
}

export class PublishMetaContentDto {
  @IsString()
  @MinLength(8)
  mediaUrl!: string;

  @IsOptional()
  @IsUUID()
  integrationId?: string;

  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsString()
  altText?: string;

  @IsOptional()
  @IsEnum(MetaMediaKind)
  mediaKind?: MetaMediaKind;

  @IsOptional()
  @IsBoolean()
  shareToFeed?: boolean;
}
