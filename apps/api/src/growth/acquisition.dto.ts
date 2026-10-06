import { Type } from "class-transformer";
import { IsBoolean, IsEmail, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";
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
  @IsString()
  @MaxLength(500)
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


export class PrepareAcquisitionOutreachDto {
  @IsString()
  @MinLength(3)
  @MaxLength(180)
  offer!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class UpdateAcquisitionOutreachDto {
  @IsString()
  @IsIn(["CONTACTED", "REPLIED", "FOLLOW_UP_DUE", "WON", "NOT_INTERESTED"])
  status!: "CONTACTED" | "REPLIED" | "FOLLOW_UP_DUE" | "WON" | "NOT_INTERESTED";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  followUpDays?: number;
}
