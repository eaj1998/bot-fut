import { injectable, singleton, inject } from "tsyringe";
import { Model, Types } from "mongoose";
import {
    ITransaction,
    TransactionModel,
    TRANSACTION_MODEL_TOKEN,
    TransactionType,
    TransactionCategory,
    TransactionStatus
} from "../models/transaction.model";

interface CreateTransactionInput {
    workspaceId: string;
    userId?: string;
    gameId?: string;
    membershipId?: string;
    type: TransactionType;
    category: TransactionCategory;
    status?: TransactionStatus;
    amount: number; // Em centavos
    dueDate: Date;
    paidAt?: Date;
    description?: string;
    method?: "pix" | "dinheiro" | "transf" | "ajuste";
    organizzeId?: number;
}

interface UpdateTransactionInput {
    status?: TransactionStatus;
    paidAt?: Date;
    description?: string;
    method?: "pix" | "dinheiro" | "transf" | "ajuste";
    amount?: number;
}

interface FindTransactionsFilters {
    type?: TransactionType;
    category?: TransactionCategory;
    status?: TransactionStatus;
    dateFrom?: Date;
    dateTo?: Date;
    search?: string;
}

@singleton()
@injectable()
export class TransactionRepository {
    constructor(
        @inject(TRANSACTION_MODEL_TOKEN) private readonly model: Model<ITransaction> = TransactionModel
    ) { }

    /**
     * Cria uma nova transação
     */
    async createTransaction(input: CreateTransactionInput): Promise<ITransaction> {
        const transaction = await this.model.create({
            workspaceId: new Types.ObjectId(input.workspaceId),
            userId: input.userId ? new Types.ObjectId(input.userId) : undefined,
            gameId: input.gameId ? new Types.ObjectId(input.gameId) : undefined,
            membershipId: input.membershipId ? new Types.ObjectId(input.membershipId) : undefined,
            type: input.type,
            category: input.category,
            status: input.status || TransactionStatus.PENDING,
            amount: input.amount,
            dueDate: input.dueDate,
            paidAt: input.paidAt,
            description: input.description,
            method: input.method,
            organizzeId: input.organizzeId
        });

        return transaction;
    }

    /**
     * Busca transações por usuário
     */
    async findByUserId(
        userId: string,
        workspaceId?: string,
        filters?: FindTransactionsFilters
    ): Promise<any[]> {
        const query: any = { userId: new Types.ObjectId(userId) };

        if (workspaceId) {
            query.workspaceId = new Types.ObjectId(workspaceId);
        }

        if (filters?.type) {
            query.type = filters.type;
        }

        if (filters?.category) {
            query.category = filters.category;
        }

        if (filters?.status) {
            query.status = filters.status;
        }

        if (filters?.dateFrom || filters?.dateTo) {
            query.dueDate = {};
            if (filters.dateFrom) {
                query.dueDate.$gte = filters.dateFrom;
            }
            if (filters.dateTo) {
                query.dueDate.$lte = filters.dateTo;
            }
        }

        return this.model
            .find(query)
            .sort({ dueDate: -1 })
            .lean()
            .exec();
    }

    /**
     * Busca transações por jogo (para calcular balanço)
     */
    async findByGameId(gameId: string): Promise<any[]> {
        return this.model
            .find({ gameId: new Types.ObjectId(gameId) })
            .sort({ createdAt: -1 })
            .lean()
            .exec();
    }

    /**
     * Busca transações por membership
     */
    async findByMembershipId(membershipId: string): Promise<any[]> {
        return this.model
            .find({ membershipId: new Types.ObjectId(membershipId) })
            .sort({ dueDate: -1 })
            .lean()
            .exec();
    }

    /**
     * Busca transações pendentes
     */
    async findPendingTransactions(
        workspaceId: string,
        filters?: FindTransactionsFilters
    ): Promise<any[]> {
        const query: any = {
            workspaceId: new Types.ObjectId(workspaceId),
            status: TransactionStatus.PENDING
        };

        if (filters?.type) {
            query.type = filters.type;
        }

        if (filters?.category) {
            query.category = filters.category;
        }

        if (filters?.dateFrom || filters?.dateTo) {
            query.dueDate = {};
            if (filters.dateFrom) {
                query.dueDate.$gte = filters.dateFrom;
            }
            if (filters.dateTo) {
                query.dueDate.$lte = filters.dateTo;
            }
        }

        return this.model
            .find(query)
            .populate('userId', 'name phoneE164')
            .sort({ dueDate: 1 })
            .lean()
            .exec();
    }

    /**
     * Atualiza o status de uma transação
     */
    async updateStatus(
        transactionId: string,
        status: TransactionStatus,
        paidAt?: Date
    ): Promise<ITransaction | null> {
        const updateData: any = { status };

        if (status === TransactionStatus.COMPLETED && !paidAt) {
            updateData.paidAt = new Date();
        } else if (paidAt) {
            updateData.paidAt = paidAt;
        }

        return this.model
            .findByIdAndUpdate(
                transactionId,
                { $set: updateData },
                { new: true }
            )
            .exec();
    }

    /**
     * Atualiza uma transação
     */
    async updateTransaction(
        transactionId: string,
        input: UpdateTransactionInput
    ): Promise<ITransaction | null> {
        return this.model
            .findByIdAndUpdate(
                transactionId,
                { $set: input },
                { new: true }
            )
            .exec();
    }

    /**
     * Busca transação por ID
     */
    async findById(transactionId: string): Promise<ITransaction | null> {
        return this.model.findById(transactionId).exec();
    }

    /**
     * Busca transação por ID e Workspace
     */
    async findOneByIdAndWorkspace(transactionId: string, workspaceId: string): Promise<ITransaction | null> {
        return this.model.findOne({ _id: transactionId, workspaceId: new Types.ObjectId(workspaceId) }).exec();
    }

    /**
     * Calcula o total de transações por workspace
     */
    async calculateWorkspaceBalance(
        workspaceId: string,
        filters?: FindTransactionsFilters
    ): Promise<{ income: number; expense: number; balance: number }> {
        const query: any = {
            workspaceId: new Types.ObjectId(workspaceId),
            status: TransactionStatus.COMPLETED
        };

        if (filters?.dateFrom || filters?.dateTo) {
            query.paidAt = {};
            if (filters.dateFrom) {
                query.paidAt.$gte = filters.dateFrom;
            }
            if (filters.dateTo) {
                query.paidAt.$lte = filters.dateTo;
            }
        }

        const [result] = await this.model.aggregate([
            { $match: query },
            {
                $group: {
                    _id: null,
                    income: {
                        $sum: {
                            $cond: [
                                { $eq: ["$type", TransactionType.INCOME] },
                                "$amount",
                                0
                            ]
                        }
                    },
                    expense: {
                        $sum: {
                            $cond: [
                                { $eq: ["$type", TransactionType.EXPENSE] },
                                "$amount",
                                0
                            ]
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    income: 1,
                    expense: 1,
                    balance: { $subtract: ["$income", "$expense"] }
                }
            }
        ]);

        return result || { income: 0, expense: 0, balance: 0 };
    }

    /**
     * Busca todas as transações de um workspace com paginação
     */
    async findAll(
        workspaceId: string,
        page: number = 1,
        limit: number = 20,
        filters?: FindTransactionsFilters
    ): Promise<{ transactions: ITransaction[]; total: number; pages: number }> {
        const query: any = { workspaceId: new Types.ObjectId(workspaceId) };

        if (filters?.type) {
            query.type = filters.type;
        }

        if (filters?.category) {
            query.category = filters.category;
        }

        if (filters?.status) {
            query.status = filters.status;
        }

        if (filters?.search) {
            query.description = { $regex: filters.search, $options: 'i' };
        }

        if (filters?.dateFrom || filters?.dateTo) {
            query.dueDate = {};
            if (filters.dateFrom) {
                query.dueDate.$gte = filters.dateFrom;
            }
            if (filters.dateTo) {
                query.dueDate.$lte = filters.dateTo;
            }
        }

        const skip = (page - 1) * limit;

        const [transactions, total] = await Promise.all([
            this.model
                .find(query)
                .sort({ dueDate: -1, createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('userId', 'name phone')
                .lean()
                .exec(),
            this.model.countDocuments(query)
        ]);

        return {
            transactions: transactions as unknown as ITransaction[],
            total,
            pages: Math.ceil(total / limit)
        };
    }

    /**
     * Agrega dados para gráficos por dia
     */
    async getAggregatedChartData(
        workspaceId: string,
        startDate: Date,
        endDate: Date
    ): Promise<any[]> {
        return this.model.aggregate([
            {
                $match: {
                    workspaceId: new Types.ObjectId(workspaceId),
                    status: TransactionStatus.COMPLETED,
                    updatedAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
                    income: {
                        $sum: {
                            $cond: [{ $eq: ["$type", TransactionType.INCOME] }, "$amount", 0]
                        }
                    },
                    expense: {
                        $sum: {
                            $cond: [{ $eq: ["$type", TransactionType.EXPENSE] }, "$amount", 0]
                        }
                    }
                }
            },
            {
                $project: {
                    date: "$_id",
                    income: { $divide: ["$income", 100] }, // Conver to Reais
                    expense: { $divide: ["$expense", 100] }, // Convert to Reais
                    _id: 0
                }
            },
            { $sort: { date: 1 } }
        ]);
    }

    /**
     * Calcula balanço de um jogo específico
     */
    async calculateGameBalance(gameId: string): Promise<{ income: number; expense: number; balance: number }> {
        const [result] = await this.model.aggregate([
            {
                $match: {
                    gameId: new Types.ObjectId(gameId),
                    status: TransactionStatus.COMPLETED
                }
            },
            {
                $group: {
                    _id: null,
                    income: {
                        $sum: {
                            $cond: [
                                { $eq: ["$type", TransactionType.INCOME] },
                                "$amount",
                                0
                            ]
                        }
                    },
                    expense: {
                        $sum: {
                            $cond: [
                                { $eq: ["$type", TransactionType.EXPENSE] },
                                "$amount",
                                0
                            ]
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    income: 1,
                    expense: 1,
                    balance: { $subtract: ["$income", "$expense"] }
                }
            }
        ]);

        return result || { income: 0, expense: 0, balance: 0 };
    }

    /**
     * Busca genérica (utilitário para flexibilidade)
     */
    async find(query: any): Promise<ITransaction[]> {
        return this.model.find(query).exec();
    }

    /**
     * Marca transação como paga (Wrapper para updateTransaction)
     */
    async markAsPaid(
        transactionId: string,
        paidAt: Date,
        method: "pix" | "dinheiro" | "transf" | "ajuste"
    ): Promise<ITransaction | null> {
        return this.updateTransaction(transactionId, {
            status: TransactionStatus.COMPLETED,
            paidAt,
            method
        });
    }

    /**
     * Busca a data do último pagamento para uma lista de memberships
     * Retorna um Map<membershipId, lastPaymentDate>
     */
    async findLastPaymentsForMemberships(membershipIds: string[]): Promise<Map<string, Date>> {
        const result = await this.model.aggregate([
            {
                $match: {
                    membershipId: { $in: membershipIds.map(id => new Types.ObjectId(id)) },
                    status: TransactionStatus.COMPLETED
                }
            },
            {
                $group: {
                    _id: "$membershipId",
                    lastPayment: { $max: "$paidAt" }
                }
            }
        ]);

        const map = new Map<string, Date>();
        result.forEach(item => {
            if (item._id && item.lastPayment) {
                map.set(item._id.toString(), item.lastPayment);
            }
        });
        return map;
    }

    /**
     * Obtém estatísticas de débitos (usuários com débito e valor total)
     */
    async getDebtStats(workspaceId?: string): Promise<{ count: number; totalAmount: number }> {
        const matchStage: any = {
            type: TransactionType.INCOME,
            status: TransactionStatus.PENDING
        };

        if (workspaceId) {
            matchStage.workspaceId = new Types.ObjectId(workspaceId);
        }

        const result = await this.model.aggregate([
            {
                $match: matchStage
            },
            {
                $group: {
                    _id: "$userId",
                    totalDebt: { $sum: "$amount" }
                }
            },
            {
                $match: {
                    totalDebt: { $gt: 0 }
                }
            },
            {
                $group: {
                    _id: null,
                    count: { $sum: 1 },
                    totalAmount: { $sum: "$totalDebt" }
                }
            }
        ]);

        return {
            count: result[0]?.count || 0,
            totalAmount: result[0]?.totalAmount || 0
        };
    }
}

export const TRANSACTION_REPOSITORY_TOKEN = "TRANSACTION_REPOSITORY_TOKEN";
