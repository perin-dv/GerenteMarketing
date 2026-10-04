import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from "class-validator";
import {
  AutopilotMode,
  CampaignChannel,
  ContentStatus,
  ContentType,
  ExperimentStatus,
  IntegrationProvider,
  LeadSource,
  LeadStage,
  MetricKey,
  RecommendationStatus,
} from "@prisma/client";

export class ConnectWhatsappDto {
  @IsString()
  @MinLength(3)
  phoneNumberId!: string;

  @IsString()
  @MinLength(3)
  wabaId!: string;

  @IsString()
  @MinLength(20)
  accessToken!: string;

  @IsOptional()
  @IsString()
  displayName?: string;
}

export class CreateMetricDto {
  @IsEnum(MetricKey)
  metric!: MetricKey;

  @IsOptional()
  @IsEnum(IntegrationProvider)
  source?: IntegrationProvider;

  @Type(() => Number)
  @IsNumber()
  value!: number;

  @IsOptional()
  @IsString()
  externalObjectId?: string;
}

export class CreateContentDto {
  @IsString()
  @MinLength(3)
  title!: string;

  @IsEnum(ContentType)
  type!: ContentType;

  @IsEnum(CampaignChannel)
  channel!: CampaignChannel;

  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @IsOptional()
  @IsString()
  hook?: string;

  @IsOptional()
  @IsString()
  script?: string;

  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsString()
  cta?: string;
}

export class GenerateContentPlanDto {
  @IsUUID()
  campaignId!: string;
}

export class UpdateContentDto {
  @IsOptional()
  @IsEnum(ContentStatus)
  status?: ContentStatus;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  hook?: string;

  @IsOptional()
  @IsString()
  script?: string;

  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsString()
  cta?: string;
}

export class UpdateRecommendationDto {
  @IsEnum(RecommendationStatus)
  status!: RecommendationStatus;
}

export class CreateExperimentDto {
  @IsString()
  @MinLength(3)
  name!: string;

  @IsString()
  @MinLength(5)
  hypothesis!: string;

  @IsEnum(MetricKey)
  metric!: MetricKey;

  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @IsArray()
  @ArrayMinSize(2)
  @IsString({ each: true })
  variants!: string[];
}

export class UpdateExperimentDto {
  @IsOptional()
  @IsEnum(ExperimentStatus)
  status?: ExperimentStatus;

  @IsOptional()
  @IsUUID()
  variantId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sampleSize?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  metricValue?: number;
}

export class UpdateAutopilotDto {
  @IsOptional()
  @IsEnum(AutopilotMode)
  mode?: AutopilotMode;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  killSwitch?: boolean;

  @IsOptional()
  @IsBoolean()
  allowPublishing?: boolean;

  @IsOptional()
  @IsBoolean()
  allowReplies?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  maxActionsPerDay?: number;
}

export class CreateLeadDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsEnum(LeadSource)
  source!: LeadSource;

  @IsOptional()
  @IsString()
  campaignTag?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateLeadDto {
  @IsOptional()
  @IsEnum(LeadStage)
  stage?: LeadStage;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
