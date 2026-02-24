import { MembershipStatus } from "../../core/models/membership.model";

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
