import { Type } from "class-transformer";
import { IsEnum, IsISO8601, IsNumber, IsOptional, IsString, IsUUID, Min, MinLength } from "class-validator";
import { GoalMetric, GoalStatus } from "@prisma/client";

export class CreateGoalDto {
  @IsString()
  @MinLength(3)
  name!: string;

  @IsEnum(GoalMetric)
  metric!: GoalMetric;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  targetValue!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  currentValue?: number;

  @IsISO8601()
  targetDate!: string;

  @IsOptional()
  @IsUUID()
  campaignId?: string;
}

export class UpdateGoalDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  name?: string;

  @IsOptional()
  @IsEnum(GoalMetric)
  metric?: GoalMetric;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  targetValue?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  currentValue?: number;

  @IsOptional()
  @IsISO8601()
  targetDate?: string;

  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @IsOptional()
  @IsEnum(GoalStatus)
  status?: GoalStatus;
}
