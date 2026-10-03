import { Type } from "class-transformer";
import { IsEnum, IsISO8601, IsInt, IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator";
import { CampaignChannel, CampaignMode, CampaignObjective, CampaignStatus } from "@prisma/client";

export class CreateCampaignDto {
  @IsString()
  @MinLength(3)
  name!: string;

  @IsOptional()
  @IsEnum(CampaignMode)
  mode?: CampaignMode;

  @IsOptional()
  @IsEnum(CampaignChannel)
  channel?: CampaignChannel;

  @IsEnum(CampaignObjective)
  objective!: CampaignObjective;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budgetTotal?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  dailyBudget?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  plannedReels?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  plannedPosts?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  plannedStories?: number;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  name?: string;

  @IsOptional()
  @IsEnum(CampaignMode)
  mode?: CampaignMode;

  @IsOptional()
  @IsEnum(CampaignChannel)
  channel?: CampaignChannel;

  @IsOptional()
  @IsEnum(CampaignObjective)
  objective?: CampaignObjective;

  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budgetTotal?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  dailyBudget?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  plannedReels?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  plannedPosts?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  plannedStories?: number;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
