import { injectable, singleton, inject } from "tsyringe";
import { Model, Types } from "mongoose";
import {
    IMembership,
    MembershipModel,
    MEMBERSHIP_MODEL_TOKEN,
    MembershipStatus
} from "../models/membership.model";

export interface CreateMembershipInput {
    workspaceId: string;
    userId: string;
    planValue: number; // Em centavos
    startDate: Date;
    nextDueDate: Date;
    status?: MembershipStatus;
    notes?: string;
}

export interface UpdateMembershipInput {
    status?: MembershipStatus;
    planValue?: number;
    nextDueDate?: Date;
    endDate?: Date;
    notes?: string;
}

@singleton()
@injectable()
export class MembershipRepository {
    constructor(
        @inject(MEMBERSHIP_MODEL_TOKEN) private readonly model: Model<IMembership> = MembershipModel
    ) { }

    /**
     * Cria uma nova assinatura
     */
    async createMembership(input: CreateMembershipInput): Promise<IMembership> {
        const membership = await this.model.create({
            workspaceId: new Types.ObjectId(input.workspaceId),
            userId: new Types.ObjectId(input.userId),
            planValue: input.planValue,
            startDate: input.startDate,
            nextDueDate: input.nextDueDate,
            status: input.status || MembershipStatus.PENDING,
            notes: input.notes
        });

        return membership;
    }

    /**
     * Busca assinatura ativa de um usuário em um workspace
     * Retorna o objeto completo com status atualizado
     */
    async findByUserId(userId: string, workspaceId: string): Promise<IMembership | null> {
        const membership = await this.model.findOne({
            userId: new Types.ObjectId(userId),
            workspaceId: new Types.ObjectId(workspaceId)
        }).exec();

        return membership;
    }

    /**
     * Busca assinatura por ID
     */
    async findById(membershipId: string): Promise<IMembership | null> {
        return this.model.findById(membershipId).exec();
    }

    /**
     * Atualiza o status de uma assinatura
     */
    async updateStatus(
        membershipId: string,
        status: MembershipStatus
    ): Promise<IMembership | null> {
        const updateData: any = { status };

        // Atualizar campos adicionais baseado no status
        if (status === MembershipStatus.INACTIVE || status === MembershipStatus.CANCELED_SCHEDULED) {
            updateData.canceledAt = new Date();
        }

        if (status === MembershipStatus.SUSPENDED) {
            updateData.suspendedAt = new Date();
        }

        return this.model
            .findByIdAndUpdate(
                membershipId,
                { $set: updateData },
                { new: true }
            )
            .exec();
    }

    /**
     * Atualiza a próxima data de vencimento
     */
    async updateNextDueDate(
        membershipId: string,
        nextDueDate: Date
    ): Promise<IMembership | null> {
        return this.model
            .findByIdAndUpdate(
                membershipId,
                { $set: { nextDueDate } },
                { new: true }
            )
            .exec();
    }

    /**
     * Atualiza uma assinatura
     */
    async updateMembership(
        membershipId: string,
        input: UpdateMembershipInput
    ): Promise<IMembership | null> {
        return this.model
            .findByIdAndUpdate(
                membershipId,
                { $set: input },
                { new: true }
            )
            .exec();
    }

    /**
     * Busca todas as assinaturas ativas de um workspace
     */
    async findActiveMemberships(workspaceId: string): Promise<any[]> {
        return this.model
            .find({
                workspaceId: new Types.ObjectId(workspaceId),
                status: MembershipStatus.ACTIVE
            })
            .populate("userId", "name phoneE164")
            .sort({ nextDueDate: 1 })
            .lean()
            .exec();
    }

    /**
     * Busca assinaturas próximas do vencimento
     * @param workspaceId ID do workspace
     * @param daysAhead Número de dias à frente para buscar vencimentos
     */
    async findExpiringSoon(workspaceId: string, daysAhead: number = 7): Promise<any[]> {
        const now = new Date();
        const futureDate = new Date();
        futureDate.setDate(now.getDate() + daysAhead);

        return this.model
            .find({
                workspaceId: new Types.ObjectId(workspaceId),
                status: MembershipStatus.ACTIVE,
                nextDueDate: {
                    $gte: now,
                    $lte: futureDate
                }
            })
            .populate("userId", "name phoneE164")
            .sort({ nextDueDate: 1 })
            .lean()
            .exec();
    }

    /**
     * Busca todas as assinaturas de um workspace (com filtros opcionais)
     */
    /**
     * Busca todas as assinaturas de um workspace (com filtros e busca)
     */
    async findByWorkspace(
        workspaceId: string,
        status?: MembershipStatus,
        search?: string,
        page: number = 1,
        limit: number = 20
    ): Promise<{ memberships: any[]; total: number }> {
        const pipeline: any[] = [
            { $match: { workspaceId: new Types.ObjectId(workspaceId) } }
        ];

        // Filtro de Status
        if (status) {
            pipeline.push({ $match: { status } });
        }

        // Lookup Usuário
        pipeline.push({
            $lookup: {
                from: "users",
                localField: "userId",
                foreignField: "_id",
                as: "user"
            }
        });
        pipeline.push({ $unwind: "$user" });

        // Busca por Nome ou Telefone
        if (search) {
            const regex = new RegExp(search, 'i');
            pipeline.push({
                $match: {
                    $or: [
                        { "user.name": regex },
                        { "user.phoneE164": regex }
                    ]
                }
            });
        }

        pipeline.push({ $sort: { createdAt: -1 } });

        const result = await this.model.aggregate([
            ...pipeline,
            {
                $facet: {
                    memberships: [
                        { $skip: (page - 1) * limit },
                        { $limit: limit },
                        {
                            $project: {
                                _id: 1,
                                status: 1,
                                planValue: 1,
                                billingDay: { $literal: 10 }, // TODO
                                nextDueDate: 1,
                                lastPaymentDate: 1, // TODO
                                startDate: 1,
                                user: {
                                    _id: 1,
                                    name: 1,
                                    phoneE164: 1
                                }
                            }
                        }
                    ],
                    totalCount: [
                        { $count: "count" }
                    ]
                }
            }
        ]);

        const memberships = result[0].memberships.map((m: any) => ({
            ...m,
            userId: m.user
        }));
        const total = result[0].totalCount[0]?.count || 0;

        return { memberships, total };
    }

    /**
     * Busca assinaturas vencidas (para processamento de cobrança)
     */
    async findOverdueMemberships(workspaceId?: string): Promise<any[]> {
        const query: any = {
            status: MembershipStatus.ACTIVE,
            nextDueDate: { $lt: new Date() }
        };

        if (workspaceId) {
            query.workspaceId = new Types.ObjectId(workspaceId);
        }

        return this.model
            .find(query)
            .populate("userId", "name phoneE164")
            .sort({ nextDueDate: 1 })
            .lean()
            .exec();
    }

    /**
     * Calcula a próxima data de vencimento (sempre dia 10)
     */
    static calculateNextDueDate(currentDate: Date = new Date()): Date {
        const nextDue = new Date(currentDate);

        nextDue.setDate(1);
        nextDue.setMonth(nextDue.getMonth() + 1);
        nextDue.setDate(10);

        nextDue.setHours(12, 0, 0, 0);

        return nextDue;
    }

    /**
     * Suspende uma assinatura
     */
    async suspendMembership(membershipId: string): Promise<IMembership | null> {
        return this.updateStatus(membershipId, MembershipStatus.SUSPENDED);
    }

    /**
     * Reativa uma assinatura suspensa
     */
    async reactivateMembership(membershipId: string): Promise<IMembership | null> {
        return this.model
            .findByIdAndUpdate(
                membershipId,
                {
                    $set: {
                        status: MembershipStatus.ACTIVE,
                        suspendedAt: undefined,
                    }
                },
                { new: true }
            )
            .exec();
    }

    /**
     * Cancela uma assinatura
     */
    async cancelMembership(
        membershipId: string,
        immediate: boolean = false
    ): Promise<IMembership | null> {
        const status = immediate ? MembershipStatus.INACTIVE : MembershipStatus.CANCELED_SCHEDULED;

        return this.model
            .findByIdAndUpdate(
                membershipId,
                {
                    $set: {
                        status,
                        canceledAt: new Date(),
                        ...(immediate && { endDate: new Date() })
                    }
                },
                { new: true }
            )
            .exec();
    }
}

export const MEMBERSHIP_REPOSITORY_TOKEN = "MEMBERSHIP_REPOSITORY_TOKEN";
