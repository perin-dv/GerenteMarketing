import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { CampaignObjective } from "@prisma/client";

export class AutoCampaignMediaDto {
  @IsUrl({ protocols: ["https"], require_protocol: true })
  publicUrl!: string;

  @IsIn(["IMAGE", "VIDEO"])
  mediaKind!: "IMAGE" | "VIDEO";

  @IsString()
  @MinLength(32)
  fingerprint!: string;

  @IsOptional()
  @IsString()
  originalName?: string;
}

export class CreateAutoCampaignDto {
  @IsString()
  @MinLength(3)
  topic!: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  campaignName?: string;

  @IsOptional()
  @IsEnum(CampaignObjective)
  objective?: CampaignObjective;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  days?: number;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsString()
  cta?: string;

  @IsOptional()
  @IsString()
  integrationId?: string;

  @IsOptional()
  @IsBoolean()
  autoPublish?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AutoCampaignMediaDto)
  media!: AutoCampaignMediaDto[];
}
