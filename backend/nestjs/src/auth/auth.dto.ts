import { IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

export class RequestOtpDto {
  @Matches(/^\+[1-9]\d{7,14}$/)
  phone!: string;
}

export class VerifyOtpDto {
  @IsUUID('4')
  challengeId!: string;
  @Matches(/^\d{6}$/)
  code!: string;
}

export class RefreshDto {
  @IsString()
  @MinLength(40)
  @MaxLength(100)
  refreshToken!: string;
}
