import { IsString, IsNumber, IsEnum, IsOptional, IsDateString, IsMongoId } from 'class-validator';
import { TransactionType, TransactionCategory, TransactionStatus } from "../../core/models/transaction.model";

export class CreateTransactionDto {
    @IsMongoId()
    @IsOptional()
    workspaceId?: string; // we will let req.workspaceId override if not provided but keeping it optional

    @IsMongoId()
    @IsOptional()
    userId?: string;

    @IsMongoId()
    @IsOptional()
    gameId?: string;

    @IsMongoId()
    @IsOptional()
    membershipId?: string;

    @IsEnum(TransactionType)
    type!: TransactionType;

    @IsEnum(TransactionCategory)
    category!: TransactionCategory;

    @IsNumber()
    amount!: number; // Em reais (será convertido para centavos)

    @IsDateString()
    @IsOptional()
    dueDate?: string; // ISO date string

    @IsString()
    @IsOptional()
    description?: string;

    @IsString()
    @IsOptional()
    method?: "pix" | "dinheiro" | "transf" | "ajuste";

    @IsEnum(TransactionStatus)
    @IsOptional()
    status?: TransactionStatus;
}

export class UpdateTransactionDto {
    @IsEnum(TransactionStatus)
    @IsOptional()
    status?: TransactionStatus;

    @IsDateString()
    @IsOptional()
    paidAt?: string; // ISO date string

    @IsString()
    @IsOptional()
    description?: string;

    @IsString()
    @IsOptional()
    method?: "pix" | "dinheiro" | "transf" | "ajuste";
}

export interface TransactionResponseDto {
    id: string;
    workspaceId: string;
    user?: { _id: string, name: string };
    gameId?: string;
    gameName?: string;
    membershipId?: string;
    type: TransactionType;
    category: TransactionCategory;
    status: TransactionStatus;
    amount: number; // Em reais
    amountCents: number; // Em centavos
    dueDate: string;
    paidAt?: string;
    description?: string;
    method?: string;
    organizzeId?: number;
    createdAt: string;
    updatedAt: string;
}
