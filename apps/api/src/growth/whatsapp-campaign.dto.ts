import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

export class WhatsappMarketingConsentDto {
  @IsBoolean()
  optIn!: boolean;
}

export class CreateWhatsappCampaignDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(512)
  topic!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(512)
  templateName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(32)
  languageCode!: string;

  @IsISO8601()
  scheduledAt!: string;

  @IsOptional()
  @IsUUID()
  integrationId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsUUID("4", { each: true })
  leadIds!: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  bodyParameters?: string[];

  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @IsOptional()
  @IsIn(["IMAGE", "VIDEO"])
  mediaKind?: "IMAGE" | "VIDEO";

  @Type(() => Boolean)
  @IsBoolean()
  confirmOptIn!: boolean;
}
