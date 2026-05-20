import {
  IsString,
  IsEmail,
  IsOptional,
  IsDateString,
  IsArray,
} from 'class-validator';

export class CreateEmployeeDto {
  @IsString()
  @IsOptional()
  userId?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  password?: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  companyId?: string;

  @IsString()
  @IsOptional()
  departmentId?: string;

  @IsString()
  role: string;

  @IsDateString()
  hireDate: string;

  @IsString()
  @IsOptional()
  salary?: string;

  @IsString()
  @IsOptional()
  manager?: string;

  @IsString()
  @IsOptional()
  branch?: string;

  @IsString()
  @IsOptional()
  employmentType?: string;

  @IsString()
  @IsOptional()
  employeeType?: string;

  @IsOptional()
  workFromHome?: boolean;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  emergencyContact?: string;

  @IsString()
  @IsOptional()
  emergencyPhone?: string;

  @IsArray()
  @IsOptional()
  skills?: string[];



  @IsString()
  @IsOptional()
  avatar?: string;

  @IsArray()
  @IsOptional()
  documents?: any[];

  @IsString()
  @IsOptional()
  startTime?: string;

  @IsString()
  @IsOptional()
  endTime?: string;
}



export class UpdateEmployeeDto {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  departmentId?: string;

  @IsString()
  @IsOptional()
  role?: string;

  @IsDateString()
  @IsOptional()
  hireDate?: string;

  @IsString()
  @IsOptional()
  salary?: string;

  @IsString()
  @IsOptional()
  manager?: string;

  @IsString()
  @IsOptional()
  branch?: string;

  @IsString()
  @IsOptional()
  employmentType?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  emergencyContact?: string;


  @IsString()
  @IsOptional()
  emergencyPhone?: string;

  @IsArray()
  @IsOptional()
  skills?: string[];



  @IsString()
  @IsOptional()
  avatar?: string;

  @IsArray()
  @IsOptional()
  documents?: any[];

  @IsString()
  @IsOptional()
  startTime?: string;

  @IsString()
  @IsOptional()
  endTime?: string;

  @IsArray()
  @IsOptional()
  roleIds?: string[];

  @IsArray()
  @IsOptional()
  permissionIds?: string[];
}

