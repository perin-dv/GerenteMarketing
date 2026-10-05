import { Type } from "class-transformer";
import { IsBoolean, IsEmail, IsEnum, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min, MinLength } from "class-validator";
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

export class ImportAcquisitionProspectDto {
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  website?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sourceRef?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  category?: string;
}
