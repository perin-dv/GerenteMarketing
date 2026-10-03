import { Type } from "class-transformer";
import { IsEnum, IsISO8601, IsNumber, IsOptional, IsString, Min, MinLength } from "class-validator";
import { CampaignObjective, CampaignStatus } from "@prisma/client";

export class CreateCampaignDto {
  @IsString()
  @MinLength(3)
  name!: string;

  @IsEnum(CampaignObjective)
  objective!: CampaignObjective;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budgetTotal!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  dailyBudget?: number;

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
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
