import { IsString, IsOptional, Length, Matches } from 'class-validator';

export class RequestOtpDto {
  @IsString()
  @Matches(/^[0-9]{10,15}$/, {
    message: 'Phone number must contain only digits (10-15 characters)',
  })
  phone!: string;
}

export class VerifyOtpDto {
  @IsString()
  @Matches(/^[0-9]{10,15}$/, {
    message: 'Phone number must contain only digits (10-15 characters)',
  })
  phone!: string;

  @IsString()
  @Length(6, 6, { message: 'OTP code must be exactly 6 digits' })
  @Matches(/^[0-9]{6}$/, { message: 'OTP code must contain only digits' })
  code!: string;

  @IsString()
  @IsOptional()
  name?: string;
}

export class AuthResponseDto {
  accessToken!: string;
  refreshToken!: string;
  user!: {
    id: string;
    name: string;
    phone: string;
    role: 'admin' | 'user';
    createdAt: Date;
    status: 'active' | 'inactive';
    workspaces?: {
      id: string;
      name: string;
      role: string;
    }[];
  };
}

export class RefreshTokenDto {
  @IsString()
  refreshToken!: string;
}
