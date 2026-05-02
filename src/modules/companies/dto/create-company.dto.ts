import {
  IsString,
  IsEmail,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCompanyDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  website?: string;

  @IsString()
  @IsOptional()
  industry?: string;

  @IsString()
  @IsOptional()
  size?: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  openingTime?: string;

  @IsString()
  @IsOptional()
  closingTime?: string;

  // ── Attendance Policy ──────────────────────────────────────────────
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  @Type(() => Number)
  lateThresholdMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(240)
  @Type(() => Number)
  earlyCheckInBuffer?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(480)
  @Type(() => Number)
  checkInCutoffMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  halfDayMinHours?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  halfDayPayPercent?: number;

  @IsOptional()
  @IsBoolean()
  enableLateEmailAlert?: boolean;

  // ── Reward System ──────────────────────────────────────────────────
  @IsOptional()
  @IsBoolean()
  enableRewardSystem?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  rewardPointsPerDay?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  rewardPointsLateDeduction?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  rewardRedemptionThreshold?: number;

  @IsOptional()
  @IsString()
  rewardDescription?: string;
}
