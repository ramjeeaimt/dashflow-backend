import { IsNotEmpty, IsString, IsDateString, IsEnum, IsOptional } from 'class-validator';

export class CreateLeaveDto {
  @IsNotEmpty()
  @IsString()
  employeeId: string;

  @IsNotEmpty()
  @IsDateString()
  startDate: string;

  @IsNotEmpty()
  @IsDateString()
  endDate: string;

  @IsString()
  @IsEnum(['PENDING', 'APPROVED', 'REJECTED', 'pending', 'approved', 'rejected'])
  status: string;

  @IsString()
  @IsOptional()
  adminComment?: string;

  @IsNotEmpty()
  @IsString()
  reason: string;

  @IsNotEmpty()
  @IsString()
  type: string;
}

export class UpdateLeaveStatusDto {
  @IsNotEmpty()
  @IsEnum(['PENDING', 'APPROVED', 'REJECTED', 'pending', 'approved', 'rejected'])
  status: string;

  @IsString()
  @IsOptional()
  adminComment?: string;
}
