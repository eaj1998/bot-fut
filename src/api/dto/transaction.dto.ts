import { TransactionType, TransactionCategory, TransactionStatus } from "../../core/models/transaction.model";

export interface CreateTransactionDto {
    workspaceId: string;
    userId?: string;
    gameId?: string;
    membershipId?: string;
    type: TransactionType;
    category: TransactionCategory;
    amount: number; // Em reais (será convertido para centavos)
    dueDate: string; // ISO date string
    description?: string;
    method?: "pix" | "dinheiro" | "transf" | "ajuste";
}

export interface UpdateTransactionDto {
    status?: TransactionStatus;
    paidAt?: string; // ISO date string
    description?: string;
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

export interface ListTransactionsDto {
    workspaceId?: string;
    userId?: string;
    gameId?: string;
    membershipId?: string;
    type?: TransactionType;
    category?: TransactionCategory;
    status?: TransactionStatus;
    dateFrom?: string; // ISO date string
    dateTo?: string; // ISO date string
    page?: number;
    limit?: number;
    sortBy?: 'amount' | 'dueDate' | 'createdAt' | 'paidAt';
    sortOrder?: 'asc' | 'desc';
}

export interface PaginatedTransactionsResponseDto {
    transactions: TransactionResponseDto[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
    summary: {
        totalIncome: number;
        totalExpense: number;
        balance: number;
        pendingCount: number;
        completedCount: number;
    };
}

export interface TransactionBalanceDto {
    income: number; // Em reais
    expense: number; // Em reais
    balance: number; // Em reais
}

export interface TransactionStatsDto {
    totalPending: number;
    totalPendingAmount: number;
    totalCompleted: number;
    totalCompletedAmount: number;
    totalCancelled: number;
    totalCancelledAmount: number;
    thisMonth: number;
    thisMonthAmount: number;
}
