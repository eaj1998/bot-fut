import { IsString, IsNumber, IsEnum, IsOptional, IsDateString, IsArray } from 'class-validator';

export enum BBQStatus {
    OPEN = 'open',
    CLOSED = 'closed',
    FINISHED = 'finished',
    CANCELLED = 'cancelled',
}

export class CreateBBQDto {
    @IsString()
    chatId!: string;

    @IsString()
    workspaceId!: string;

    @IsDateString()
    @IsOptional()
    date?: string;

    @IsString()
    @IsOptional()
    description?: string;
}

export class UpdateBBQDto {
    @IsDateString()
    @IsOptional()
    date?: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsOptional()
    financials?: {
        meatCost?: number;
        cookCost?: number;
        ticketPrice?: number;
    };

    @IsEnum(BBQStatus)
    @IsOptional()
    status?: BBQStatus;
}

export class UpdateBBQStatusDto {
    @IsEnum(BBQStatus)
    status!: BBQStatus;
}

export class BBQParticipantDto {
    userId!: string;
    userName!: string;
    invitedBy!: string | null;
    invitedByName?: string | null;
    isPaid!: boolean;
    isGuest!: boolean;
    isFree!: boolean;
    debtId?: string;
    transactionId?: string;
}

export class BBQResponseDto {
    id!: string;
    chatId!: string;
    workspaceId!: string;
    description?: string;
    status!: BBQStatus;
    date!: string;
    createdAt!: string;
    closedAt?: string;
    finishedAt?: string;
    participants!: BBQParticipantDto[];
    financials!: {
        meatCost: number;
        cookCost: number;
        ticketPrice: number;
    };
    participantCount!: number;
}

export class BBQListResponseDto {
    bbqs!: BBQResponseDto[];
    total!: number;
    page!: number;
    totalPages!: number;
    limit!: number;
}

export class BBQStatsDto {
    total!: number;
    open!: number;
    closed!: number;
    finished!: number;
    cancelled!: number;
}

export class BBQFilterDto {
    @IsEnum(BBQStatus)
    @IsOptional()
    status?: BBQStatus;

    @IsString()
    @IsOptional()
    chatId?: string;

    @IsString()
    @IsOptional()
    workspaceId?: string;

    @IsDateString()
    @IsOptional()
    dateFrom?: string;

    @IsDateString()
    @IsOptional()
    dateTo?: string;

    @IsNumber()
    @IsOptional()
    page?: number;

    @IsNumber()
    @IsOptional()
    limit?: number;
}
