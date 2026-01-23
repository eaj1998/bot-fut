import { MembershipStatus } from "../../core/models/membership.model";

export interface CreateMembershipDto {
    workspaceId: string;
    userId: string;
    planValue: number; // Em reais (será convertido para centavos)
    startDate?: string; // ISO date string (default: hoje)
    notes?: string;
}

export interface UpdateMembershipDto {
    status?: MembershipStatus;
    planValue?: number; // Em reais
    nextDueDate?: string; // ISO date string
    notes?: string;
}

export interface MembershipResponseDto {
    id: string;
    workspaceId: string;
    userId: string;
    userName?: string;
    userPhone?: string;
    status: MembershipStatus;
    planValue: number; // Em reais
    planValueCents: number; // Em centavos
    startDate: string;
    endDate?: string;
    nextDueDate: string;
    canceledAt?: string;
    suspendedAt?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
    // Campos calculados
    isOverdue?: boolean;
    daysUntilDue?: number;
}

export interface ListMembershipsDto {
    workspaceId?: string;
    userId?: string;
    status?: MembershipStatus | 'all';
    expiringSoon?: boolean; // Vencendo nos próximos 7 dias
    overdue?: boolean; // Vencidos
    page?: number;
    limit?: number;
    sortBy?: 'nextDueDate' | 'createdAt' | 'planValue' | 'userName';
    sortOrder?: 'asc' | 'desc';
}

export interface PaginatedMembershipsResponseDto {
    memberships: MembershipResponseDto[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
    summary: {
        activeCount: number;
        pendingCount: number;
        suspendedCount: number;
        inactiveCount: number;
        totalMonthlyRevenue: number; // Receita mensal total (soma dos planValue ativos)
        expiringSoonCount: number; // Vencendo nos próximos 7 dias
        overdueCount: number; // Vencidos
    };
}

export interface MembershipStatsDto {
    totalActive: number;
    totalPending: number;
    totalSuspended: number;
    totalInactive: number;
    totalCanceled: number;
    monthlyRevenue: number; // Receita mensal esperada (soma dos planValue ativos)
    expiringSoon: number; // Nos próximos 7 dias
    overdue: number;
}

export interface SuspendMembershipDto {
    notes?: string;
}

export interface CancelMembershipDto {
    immediate?: boolean; // Se true, cancela imediatamente. Se false, agenda cancelamento
    notes?: string;
}

export interface ReactivateMembershipDto {
    notes?: string;
}
