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

export interface CreateTransactionInput {
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

export interface UpdateTransactionInput {
    status?: TransactionStatus;
    paidAt?: Date;
    description?: string;
    method?: "pix" | "dinheiro" | "transf" | "ajuste";
}

export interface FindTransactionsFilters {
    type?: TransactionType;
    category?: TransactionCategory;
    status?: TransactionStatus;
    dateFrom?: Date;
    dateTo?: Date;
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
}

export const TRANSACTION_REPOSITORY_TOKEN = "TRANSACTION_REPOSITORY_TOKEN";
