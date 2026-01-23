import { injectable, inject } from 'tsyringe';
import { MembershipRepository, MEMBERSHIP_REPOSITORY_TOKEN, CreateMembershipInput, UpdateMembershipInput } from '../core/repositories/membership.repository';
import { TransactionRepository, TRANSACTION_REPOSITORY_TOKEN } from '../core/repositories/transaction.repository';
import { USER_REPOSITORY_TOKEN, UserRepository } from '../core/repositories/user.repository';
import { IMembership, MembershipStatus } from '../core/models/membership.model';
import { TransactionType, TransactionCategory, TransactionStatus } from '../core/models/transaction.model';
import { ApiError } from '../api/middleware/error.middleware';

interface AdminMembershipListItem {
    id: string;
    user: {
        id: string;
        name: string;
        phoneE164: string;
    };
    status: MembershipStatus;
    planValue: number;
    billingDay: number;
    nextDueDate: Date;
    lastPaymentDate?: Date;
    startDate: Date;
}

interface AdminMembershipListResponse {
    memberships: AdminMembershipListItem[];
    summary: {
        totalActive: number;
        totalSuspended: number;
        mrr: number; // Monthly Recurring Revenue in cents
    };
    pagination: {
        page: number;
        limit: number;
        total: number;
    };
}

interface ManualPaymentInput {
    amount: number; // em reais
    method: 'pix' | 'dinheiro' | 'transf' | 'ajuste';
    description?: string;
}

@injectable()
export class MembershipService {
    constructor(
        @inject(MEMBERSHIP_REPOSITORY_TOKEN) private readonly membershipRepo: MembershipRepository,
        @inject(TRANSACTION_REPOSITORY_TOKEN) private readonly transactionRepo: TransactionRepository,
        @inject(USER_REPOSITORY_TOKEN) private readonly userRepo: UserRepository
    ) { }

    /**
     * Lista todas as memberships para admin (paginado)
     */
    async getAdminList(workspaceId: string, page: number = 1, limit: number = 20, filter?: string): Promise<AdminMembershipListResponse> {
        // Determinar status filter
        let statusFilter: MembershipStatus | undefined;

        switch (filter) {
            case 'active':
                statusFilter = MembershipStatus.ACTIVE;
                break;
            case 'overdue':
                statusFilter = MembershipStatus.SUSPENDED;
                break;
            case 'cancelled':
                statusFilter = MembershipStatus.INACTIVE;
                break;
            case 'all':
            default:
                statusFilter = undefined;
        }

        // Buscar memberships
        const memberships = await this.membershipRepo.findByWorkspace(workspaceId, statusFilter);

        // Calcular summary
        const summary = {
            totalActive: memberships.filter(m => m.status === MembershipStatus.ACTIVE).length,
            totalSuspended: memberships.filter(m => m.status === MembershipStatus.SUSPENDED).length,
            mrr: memberships
                .filter(m => m.status === MembershipStatus.ACTIVE)
                .reduce((sum, m) => sum + m.planValue, 0)
        };

        // Mapear para response format
        const mappedMemberships: AdminMembershipListItem[] = memberships.map(m => ({
            id: m._id.toString(),
            user: {
                id: (m.userId as any)._id.toString(),
                name: (m.userId as any).name,
                phoneE164: (m.userId as any).phoneE164
            },
            status: m.status,
            planValue: m.planValue / 100, // converter para reais
            billingDay: 10, // TODO: adicionar ao model
            nextDueDate: m.nextDueDate,
            lastPaymentDate: undefined, // TODO: buscar da última transaction
            startDate: m.startDate
        }));

        // Aplicar paginação
        const start = (page - 1) * limit;
        const end = start + limit;
        const paginatedMemberships = mappedMemberships.slice(start, end);

        return {
            memberships: paginatedMemberships,
            summary,
            pagination: {
                page,
                limit,
                total: mappedMemberships.length
            }
        };
    }

    /**
     * Atualizar membership (admin)
     */
    async updateMembership(membershipId: string, data: { planValue?: number; billingDay?: number }): Promise<IMembership> {
        const membership = await this.membershipRepo.findById(membershipId);

        if (!membership) {
            throw new ApiError(404, 'Membership não encontrado');
        }

        const updateData: UpdateMembershipInput = {};

        if (data.planValue !== undefined) {
            updateData.planValue = Math.round(data.planValue * 100); // converter para centavos
        }

        const updated = await this.membershipRepo.updateMembership(membershipId, updateData);

        if (!updated) {
            throw new ApiError(500, 'Erro ao atualizar membership');
        }

        return updated;
    }

    /**
     * Registrar pagamento manual (crítico para admins)
     * Cria Transaction COMPLETED e reativa membership
     */
    async registerManualPayment(membershipId: string, input: ManualPaymentInput): Promise<{ membership: IMembership; transaction: any }> {
        const membership = await this.membershipRepo.findById(membershipId);

        if (!membership) {
            throw new ApiError(404, 'Membership não encontrado');
        }

        // Criar Transaction tipo INCOME, categoria MEMBERSHIP, status COMPLETED
        const amountCents = Math.round(input.amount * 100);

        const transaction = await this.transactionRepo.createTransaction({
            workspaceId: membership.workspaceId.toString(),
            userId: membership.userId.toString(),
            membershipId: membership._id.toString(),
            type: TransactionType.INCOME,
            category: TransactionCategory.MEMBERSHIP,
            status: TransactionStatus.COMPLETED,
            amount: amountCents,
            dueDate: new Date(),
            paidAt: new Date(),
            description: input.description || `Pagamento manual de mensalidade - ${input.method}`,
            method: input.method
        });

        // Reativar membership se estava SUSPENDED
        if (membership.status === MembershipStatus.SUSPENDED || membership.status === MembershipStatus.PENDING) {
            await this.membershipRepo.reactivateMembership(membershipId);

            // Calcular próxima data de vencimento
            const nextDueDate = MembershipRepository.calculateNextDueDate();
            await this.membershipRepo.updateNextDueDate(membershipId, nextDueDate);
        }

        const updatedMembership = await this.membershipRepo.findById(membershipId);

        return {
            membership: updatedMembership!,
            transaction
        };
    }

    /**
     * Suspender membership manualmente
     */
    async suspendMembership(membershipId: string, reason: string): Promise<IMembership> {
        const membership = await this.membershipRepo.findById(membershipId);

        if (!membership) {
            throw new ApiError(404, 'Membership não encontrado');
        }

        const updated = await this.membershipRepo.suspendMembership(membershipId);

        if (!updated) {
            throw new ApiError(500, 'Erro ao suspender membership');
        }

        // TODO: Registrar motivo em notes ou criar log
        if (reason) {
            await this.membershipRepo.updateMembership(membershipId, {
                notes: `Suspenso: ${reason}`
            });
        }

        return updated;
    }

    /**
     * Cancelar membership
     */
    async cancelMembership(membershipId: string, immediate: boolean = false): Promise<IMembership> {
        const membership = await this.membershipRepo.findById(membershipId);

        if (!membership) {
            throw new ApiError(404, 'Membership não encontrado');
        }

        const updated = await this.membershipRepo.cancelMembership(membershipId, immediate);

        if (!updated) {
            throw new ApiError(500, 'Erro ao cancelar membership');
        }

        return updated;
    }

    /**
     * Criar membership (admin ou user)
     */
    async createMembership(input: CreateMembershipInput): Promise<IMembership> {
        // Verificar se já existe membership ativo para este usuário/workspace
        const existing = await this.membershipRepo.findByUserId(input.userId, input.workspaceId);

        if (existing && existing.status !== MembershipStatus.INACTIVE) {
            throw new ApiError(400, 'Usuário já possui uma assinatura ativa');
        }

        return this.membershipRepo.createMembership(input);
    }

    /**
     * Buscar membership do usuário logado
     */
    async getMyMembership(userId: string, workspaceId: string): Promise<IMembership | null> {
        return this.membershipRepo.findByUserId(userId, workspaceId);
    }
}

export const MEMBERSHIP_SERVICE_TOKEN = Symbol('MembershipService');
