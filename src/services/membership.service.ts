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
        totalPending: number;
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

import { Model } from 'mongoose';
import { WORKSPACE_MEMBER_MODEL_TOKEN, IWorkspaceMember } from '../core/models/workspace-member.model';

@injectable()
export class MembershipService {
    constructor(
        @inject(MEMBERSHIP_REPOSITORY_TOKEN) private readonly membershipRepo: MembershipRepository,
        @inject(TRANSACTION_REPOSITORY_TOKEN) private readonly transactionRepo: TransactionRepository,
        @inject(USER_REPOSITORY_TOKEN) private readonly userRepo: UserRepository,
        @inject(WORKSPACE_MEMBER_MODEL_TOKEN) private readonly workspaceMemberModel: Model<IWorkspaceMember>
    ) { }

    /**
     * Lista todas as memberships para admin (paginado)
     */
    async getAdminList(workspaceId: string, page: number = 1, limit: number = 20, filter?: string, search?: string): Promise<AdminMembershipListResponse> {
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
            case 'all': default:
                statusFilter = undefined;
        }

        const { memberships, total } = await this.membershipRepo.findByWorkspace(workspaceId, statusFilter, search, page, limit);

        const allMemberships = await this.membershipRepo.findByWorkspace(workspaceId, undefined, undefined, 1, 1000); // Limit 1000 para stats aproximados
        const summary = {
            totalActive: allMemberships.memberships.filter((m: any) => m.status === MembershipStatus.ACTIVE).length,
            totalSuspended: allMemberships.memberships.filter((m: any) => m.status === MembershipStatus.SUSPENDED).length,
            totalPending: allMemberships.memberships.filter((m: any) => m.status === MembershipStatus.PENDING).length,
            mrr: allMemberships.memberships
                .filter((m: any) => m.status === MembershipStatus.ACTIVE)
                .reduce((sum: number, m: any) => sum + (m.planValue || 0), 0)
        };

        const membershipIds = memberships.map(m => m._id.toString());
        const lastPaymentsMap = await this.transactionRepo.findLastPaymentsForMemberships(membershipIds);

        const mappedMemberships: AdminMembershipListItem[] = memberships.map(m => ({
            id: m._id.toString(),
            user: {
                id: (m.userId as any)._id.toString(),
                name: (m.userId as any).name,
                phoneE164: (m.userId as any).phoneE164
            },
            status: m.status,
            planValue: m.planValue / 100, // converter para reais
            billingDay: 10,
            nextDueDate: m.nextDueDate,
            lastPaymentDate: lastPaymentsMap.get(m._id.toString()),
            startDate: m.startDate
        }));

        return {
            memberships: mappedMemberships,
            summary,
            pagination: {
                page,
                limit,
                total
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

        const paidAmountCents = Math.round(input.amount * 100);

        const membershipTransactions = await this.transactionRepo.findByMembershipId(membershipId);

        const pendingTransaction = membershipTransactions.find((t: any) => t.status === TransactionStatus.PENDING);

        let transaction;
        let shouldActivate = false;

        if (pendingTransaction) {
            const pendingAmount = pendingTransaction.amount;

            if (paidAmountCents >= pendingAmount) {
                transaction = await this.transactionRepo.updateTransaction(pendingTransaction._id.toString(), {
                    status: TransactionStatus.COMPLETED,
                    paidAt: new Date(),
                    method: input.method,
                    description: input.description || pendingTransaction.description || `Pagamento manual de mensalidade - ${input.method}`
                });
                shouldActivate = true;
            } else {
                // Pagamento Parcial (< dívida)
                // 1. Criar transação separada para o valor PAGO (Receita que entrou)
                transaction = await this.transactionRepo.createTransaction({
                    workspaceId: membership.workspaceId.toString(),
                    userId: membership.userId.toString(),
                    membershipId: membership._id.toString(),
                    type: TransactionType.INCOME,
                    category: TransactionCategory.MEMBERSHIP,
                    status: TransactionStatus.COMPLETED, // Dinheiro entrou
                    amount: paidAmountCents,
                    dueDate: new Date(),
                    paidAt: new Date(),
                    description: (input.description || `Pagamento parcial - ${input.method}`) + ` (Abatido da dívida)`,
                    method: input.method
                });

                const remainingAmount = pendingAmount - paidAmountCents;
                await this.transactionRepo.updateTransaction(pendingTransaction._id.toString(), {
                    amount: remainingAmount,
                    description: (pendingTransaction.description || 'Mensalidade') + ' (Restante após parcial)'
                });

                shouldActivate = false;
            }
        } else {
            const planValue = membership.planValue;

            transaction = await this.transactionRepo.createTransaction({
                workspaceId: membership.workspaceId.toString(),
                userId: membership.userId.toString(),
                membershipId: membership._id.toString(),
                type: TransactionType.INCOME,
                category: TransactionCategory.MEMBERSHIP,
                status: TransactionStatus.COMPLETED,
                amount: paidAmountCents,
                dueDate: new Date(),
                paidAt: new Date(),
                description: input.description || `Pagamento manual de mensalidade - ${input.method}`,
                method: input.method
            });

            if (paidAmountCents >= planValue) {
                shouldActivate = true;
            } else {
                if (membership.status !== MembershipStatus.ACTIVE) {
                    const remaining = planValue - paidAmountCents;
                    if (remaining > 0) {
                        await this.transactionRepo.createTransaction({
                            workspaceId: membership.workspaceId.toString(),
                            userId: membership.userId.toString(),
                            membershipId: membership._id.toString(),
                            type: TransactionType.INCOME,
                            category: TransactionCategory.MEMBERSHIP,
                            status: TransactionStatus.PENDING,
                            amount: remaining,
                            dueDate: new Date(),
                            description: `Restante da mensalidade (Parcial pago)`
                        });
                    }
                    shouldActivate = false;
                } else {
                    shouldActivate = true;
                }
            }
        }

        if (shouldActivate && (membership.status === MembershipStatus.SUSPENDED || membership.status === MembershipStatus.PENDING || membership.status === MembershipStatus.INACTIVE || membership.status === MembershipStatus.CANCELED_SCHEDULED)) {
            await this.membershipRepo.reactivateMembership(membershipId);
        }

        const nextDueDate = MembershipRepository.calculateNextDueDate();

        await this.membershipRepo.updateNextDueDate(membershipId, nextDueDate);

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

        if (reason) {
            const timestamp = new Date().toLocaleString('pt-BR');
            const newNote = `[${timestamp}] Suspenso: ${reason}`;
            const updatedNotes = membership.notes
                ? `${membership.notes}\n${newNote}`
                : newNote;

            await this.membershipRepo.updateMembership(membershipId, {
                notes: updatedNotes
            });
        }

        return updated;
    }

    async findById(id: string): Promise<IMembership | null> {
        return this.membershipRepo.findById(id);
    }

    /**
     * Cancelar membership
     */
    async cancelMembership(membershipId: string, immediate: boolean = false, requesterId?: string, requesterRole?: string): Promise<IMembership> {
        const membership = await this.membershipRepo.findById(membershipId);

        if (!membership) {
            throw new ApiError(404, 'Membership não encontrado');
        }

        if (requesterId) {
            const isGlobalAdmin = requesterRole === 'admin';
            const isOwner = membership.userId.toString() === requesterId;

            if (!isGlobalAdmin && !isOwner) {
                const member = await this.workspaceMemberModel.findOne({
                    workspaceId: membership.workspaceId,
                    userId: requesterId,
                    status: 'ACTIVE'
                });

                const isWorkspaceAdmin = member?.roles?.some(r => ['admin', 'owner'].includes(r.toLowerCase()));

                if (!isWorkspaceAdmin) {
                    throw new ApiError(403, 'Você não tem permissão para cancelar esta assinatura');
                }
            }
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
        const existing = await this.membershipRepo.findByUserId(input.userId, input.workspaceId);

        if (existing && existing.status !== MembershipStatus.INACTIVE) {
            throw new ApiError(400, 'Usuário já possui uma assinatura ativa');
        }

        const user = await this.userRepo.findById(input.userId);

        const membership = await this.membershipRepo.createMembership(input);

        if (input.planValue > 0) {
            await this.transactionRepo.createTransaction({
                workspaceId: input.workspaceId,
                userId: input.userId,
                membershipId: membership._id.toString(),
                type: TransactionType.INCOME,
                category: TransactionCategory.MEMBERSHIP,
                status: TransactionStatus.PENDING,
                amount: input.planValue,
                dueDate: new Date(), // Pay immediately
                paidAt: undefined,
                description: `Mensalidade Inicial de ${user?.name ?? input.userId}`,
                method: undefined
            });
        }

        return membership;
    }

    /**
     * Buscar membership do usuário logado
     */
    async getMyMembership(userId: string, workspaceId: string): Promise<any | null> {
        const membership = await this.membershipRepo.findByUserId(userId, workspaceId);
        if (!membership) return null;

        return {
            ...membership.toObject(),
            planValue: membership.planValue / 100, // Converte para Reais
            planValueCents: membership.planValue // Mantém original em centavos
        };
    }
    /**
     * Processa cobrança mensal para todas as assinaturas ativas
     * Gera transações PENDING para o mês atual se não existirem
     */
    async processMonthlyBilling(workspaceId: string): Promise<{ processed: number, created: number, errors: number, details: any[] }> {
        const activeMemberships = await this.membershipRepo.findActiveMemberships(workspaceId);

        const results = {
            processed: 0,
            created: 0,
            errors: 0,
            details: [] as any[]
        };

        for (const membership of activeMemberships) {
            try {
                results.processed++;
                const membershipId = membership._id.toString();
                const nextDueDate = new Date(membership.nextDueDate);

                const transactions = await this.transactionRepo.findByMembershipId(membershipId);

                const alreadyBilled = transactions.some((t: any) => {
                    const tDate = new Date(t.dueDate);
                    return tDate.getMonth() === nextDueDate.getMonth() &&
                        tDate.getFullYear() === nextDueDate.getFullYear() &&
                        t.type === TransactionType.INCOME &&
                        (t.category === TransactionCategory.MEMBERSHIP) &&
                        t.status === TransactionStatus.COMPLETED;
                });

                if (alreadyBilled) {
                    results.details.push({
                        membershipId,
                        user: membership.userId?.name,
                        status: 'SKIPPED',
                        reason: 'Já faturado para este mês'
                    });
                    continue;
                }

                await this.transactionRepo.createTransaction({
                    workspaceId,
                    userId: membership.userId?._id?.toString() || membership.userId?.toString(),
                    membershipId,
                    type: TransactionType.INCOME,
                    category: TransactionCategory.MEMBERSHIP,
                    status: TransactionStatus.PENDING,
                    amount: membership.planValue, // Centavos
                    dueDate: membership.nextDueDate,
                    description: `Mensalidade ${membership.nextDueDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`,
                    method: undefined
                });

                results.created++;
                results.details.push({
                    membershipId,
                    user: membership.userId?.name,
                    status: 'CREATED',
                    amount: membership.planValue
                });

            } catch (error: any) {
                console.error(`Erro ao processar membership ${membership._id}:`, error);
                results.errors++;
                results.details.push({
                    membershipId: membership._id.toString(),
                    status: 'ERROR',
                    error: error.message
                });
            }
        }

        return results;
    }
}

export const MEMBERSHIP_SERVICE_TOKEN = Symbol('MembershipService');
