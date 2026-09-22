import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, IsISO8601, IsNumber, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class ListQueryDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 100;
  @Type(() => Number) @IsInt() @Min(0) @Max(1000000) offset = 0;
}

export class AdminCustomerQueryDto extends ListQueryDto {
  @IsOptional() @IsIn(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']) status?: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  @IsOptional() @IsIn(['ar', 'en']) locale?: 'ar' | 'en';
  @IsOptional() @IsString() @Length(1, 120) query?: string;
}

export class AdminUserQueryDto extends ListQueryDto {
  @IsOptional() @IsIn(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']) status?: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  @IsOptional() @IsIn(['CUSTOMER', 'COMPANY_MANAGER', 'TEAM_LEADER_CLEANER', 'HOME_CLEAN_ADMIN', 'DISPATCHER']) role?: 'CUSTOMER' | 'COMPANY_MANAGER' | 'TEAM_LEADER_CLEANER' | 'HOME_CLEAN_ADMIN' | 'DISPATCHER';
  @IsOptional() @IsString() @Length(1, 120) query?: string;
}

export class AdminCompanyQueryDto extends ListQueryDto {
  @IsOptional() @IsIn(['PENDING', 'ACTIVE', 'SUSPENDED', 'INACTIVE']) status?: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  @IsOptional() @IsString() @Length(1, 120) query?: string;
}

export class AdminTeamQueryDto extends ListQueryDto {
  @IsOptional() @IsUUID('4') companyId?: string;
  @IsOptional() @IsIn(['AVAILABLE', 'BUSY', 'OFFLINE', 'PAUSED']) status?: 'AVAILABLE' | 'BUSY' | 'OFFLINE' | 'PAUSED';
  @IsOptional() @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value) @IsBoolean() active?: boolean;
  @IsOptional() @IsString() @Length(1, 120) query?: string;
}

export class ProfileDto {
  @ValidateIf((_o, v) => v !== undefined) @IsString() @Length(1, 120) name?: string;
  @ValidateIf((_o, v) => v !== undefined) @IsIn(['ar', 'en']) locale?: string;
}
export class AddressDto {
  @IsString() @Length(1, 80) label!: string;
  @IsString() @Length(1, 2000) addressText!: string;
  @IsOptional() @IsNumber() @Min(-90) @Max(90) latitude?: number;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) longitude?: number;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}
export class PropertyDto {
  @IsIn(['APARTMENT', 'HOUSE', 'VILLA', 'OFFICE']) type!: string;
  @Matches(/^\d{1,8}(\.\d{1,2})?$/) size!: string;
  @IsInt() @Min(0) @Max(1000) rooms!: number;
  @IsInt() @Min(0) @Max(1000) bathrooms!: number;
}
export class ServiceDto {
  @Matches(/^[A-Z][A-Z0-9_]{1,59}$/) code!: string;
  @IsString() @Length(1, 120) name!: string;
  @IsString() @Length(1, 120) nameAr!: string;
  @IsString() @MaxLength(4000) description!: string;
  @Matches(/^\d{1,10}(\.\d{1,2})?$/) basePrice!: string;
  @IsInt() @Min(1) @Max(1440) durationMinutes!: number;
  @IsBoolean() active!: boolean;
}
export class CompanyDto {
  @Matches(/^[A-Z0-9-]{2,40}$/) internalCode!: string;
  @IsString() @Length(1, 160) name!: string;
  @IsIn(['PENDING', 'ACTIVE', 'SUSPENDED', 'INACTIVE']) status!: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  @Matches(/^(0(\.\d{1,4})?|1(\.0{1,4})?)$/) commissionRate!: string;
}
export class TeamDto {
  @IsUUID('4') companyId!: string;
  @Matches(/^[A-Z0-9-]{2,40}$/) internalCode!: string;
  @IsString() @Length(1, 120) name!: string;
  @IsInt() @Min(1) @Max(100) capacity!: number;
}
export class AvailabilityDto {
  @IsISO8601({ strict: true }) @Matches(/T.*(Z|[+-]\d{2}:\d{2})$/) startsAt!: string;
  @IsISO8601({ strict: true }) @Matches(/T.*(Z|[+-]\d{2}:\d{2})$/) endsAt!: string;
  @IsBoolean() available!: boolean;
}
export class TeamUpdateDto {
  @IsString() @Length(1, 120) name!: string;
  @IsInt() @Min(1) @Max(100) capacity!: number;
  @IsBoolean() active!: boolean;
}
export class CompanyProfileDto {
  @IsString() @Length(1, 160) name!: string;
}
export class CapabilitiesDto {
  @IsArray() @ArrayMaxSize(100) @ArrayUnique() @IsUUID('4', { each: true }) serviceIds!: string[];
}
export class TeamStatusDto {
  @IsIn(['AVAILABLE', 'BUSY', 'OFFLINE', 'PAUSED']) status!: 'AVAILABLE' | 'BUSY' | 'OFFLINE' | 'PAUSED';
}
export class TeamLocationDto {
  @IsNumber() @Min(-90) @Max(90) latitude!: number;
  @IsNumber() @Min(-180) @Max(180) longitude!: number;
  @IsISO8601({ strict: true }) @Matches(/T.*(Z|[+-]\d{2}:\d{2})$/) reportedAt!: string;
}

export class ProvisionUserDto {
  @Matches(/^\+[1-9]\d{7,14}$/) phone!: string;
  @IsString() @Length(1, 120) name!: string;
  @IsIn(['CUSTOMER', 'COMPANY_MANAGER', 'TEAM_LEADER_CLEANER', 'HOME_CLEAN_ADMIN', 'DISPATCHER']) role!: 'CUSTOMER' | 'COMPANY_MANAGER' | 'TEAM_LEADER_CLEANER' | 'HOME_CLEAN_ADMIN' | 'DISPATCHER';
  @ValidateIf((_o, v) => v !== undefined) @IsUUID('4') companyId?: string;
  @ValidateIf((_o, v) => v !== undefined) @IsUUID('4') teamId?: string;
}
export class UserStatusDto {
  @IsIn(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']) status!: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
}
export class ServiceExtraDto {
  @Matches(/^[A-Z][A-Z0-9_]{1,59}$/) code!: string;
  @IsString() @Length(1, 120) name!: string;
  @IsString() @Length(1, 120) nameAr!: string;
  @Matches(/^\d{1,10}(\.\d{1,2})?$/) price!: string;
  @IsBoolean() active!: boolean;
}
export class ServiceAreaDto {
  @IsString() @Length(1, 120) name!: string;
  @IsNumber() @Min(-90) @Max(90) latitude!: number;
  @IsNumber() @Min(-180) @Max(180) longitude!: number;
  @Matches(/^\d{1,5}(\.\d{1,3})?$/) radiusKm!: string;
  @IsBoolean() active!: boolean;
}
