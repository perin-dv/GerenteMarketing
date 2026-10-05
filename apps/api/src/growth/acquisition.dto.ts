import { Type } from "class-transformer";
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min, MinLength } from "class-validator";
import { CampaignObjective } from "@prisma/client";

export class CreateAcquisitionPlanDto {
  @IsString()
  @MinLength(3)
  offer!: string;

  @IsString()
  @MinLength(3)
  audience!: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsEnum(CampaignObjective)
  objective?: CampaignObjective;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(7)
  @Max(30)
  days?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(14)
  videosPerWeek?: number;

  @IsOptional()
  @IsBoolean()
  includeTikTok?: boolean;

  @IsOptional()
  @IsBoolean()
  includeInstagram?: boolean;

  @IsOptional()
  @IsString()
  cta?: string;
}
