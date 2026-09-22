import { IsIn, IsString, Length, MaxLength } from 'class-validator';

export class DeviceTokenDto {
  @IsString() @Length(20, 4096) token!: string;
  @IsIn(['ios', 'android', 'web']) platform!: 'ios' | 'android' | 'web';
}

export class NotificationReadDto {
  @IsString() @MaxLength(200) reason = 'USER_READ';
}
