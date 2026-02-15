import { Schema, model, Types, Model, Document } from "mongoose";

export enum TransactionType {
    INCOME = "INCOME",
    EXPENSE = "EXPENSE"
}

export enum TransactionCategory {
    MEMBERSHIP = "MEMBERSHIP",
    GAME_FEE = "GAME_FEE",
    FIELD_RENTAL = "FIELD_RENTAL",
    REFEREE = "REFEREE",
    OTHER = "OTHER",
    EQUIPMENT = "EQUIPMENT",
    BBQ_REVENUE = "BBQ_REVENUE",
    BBQ_COST = "BBQ_COST"
}

export enum TransactionStatus {
    PENDING = "PENDING",
    COMPLETED = "COMPLETED",
    CANCELLED = "CANCELLED",
    OVERDUE = "OVERDUE"
}

export interface ITransaction extends Document {
    _id: Types.ObjectId;
    workspaceId: Types.ObjectId;
    userId?: Types.ObjectId;
    gameId?: Types.ObjectId;
    membershipId?: Types.ObjectId;
    type: TransactionType;
    category: TransactionCategory;
    status: TransactionStatus;
    amount: number; // Valor em centavos
    dueDate: Date; // Data de vencimento
    paidAt?: Date; // Data do pagamento efetivo
    description?: string;
    method?: "pix" | "dinheiro" | "transf" | "ajuste";
    organizzeId?: number;
    legacyLedgerId?: Types.ObjectId; // Para rastrear origem da migração
    createdAt: Date;
    updatedAt: Date;
}

const TransactionSchema = new Schema({
    workspaceId: {
        type: Types.ObjectId,
        ref: "Workspace",
        required: true,
        index: true
    },
    userId: {
        type: Types.ObjectId,
        ref: "User",
        index: true
    },
    gameId: {
        type: Types.ObjectId,
        ref: "Game"
    },
    membershipId: {
        type: Types.ObjectId,
        ref: "Membership"
    },
    type: {
        type: String,
        enum: Object.values(TransactionType),
        required: true,
        index: true
    },
    category: {
        type: String,
        enum: Object.values(TransactionCategory),
        required: true,
        index: true
    },
    status: {
        type: String,
        enum: Object.values(TransactionStatus),
        default: TransactionStatus.PENDING,
        index: true
    },
    amount: {
        type: Number,
        required: true
    },
    dueDate: {
        type: Date,
        required: true,
        index: true
    },
    paidAt: {
        type: Date
    },
    description: {
        type: String
    },
    method: {
        type: String,
        enum: ["pix", "dinheiro", "transf", "ajuste"]
    },
    organizzeId: {
        type: Number
    },
    legacyLedgerId: {
        type: Types.ObjectId,
        index: true // Para idempotência na migração
    }
}, {
    timestamps: true
});

// Índices compostos para queries comuns
TransactionSchema.index({ workspaceId: 1, status: 1 });
TransactionSchema.index({ workspaceId: 1, userId: 1, status: 1 });
TransactionSchema.index({ workspaceId: 1, type: 1, status: 1 });
TransactionSchema.index({ gameId: 1, status: 1 });
TransactionSchema.index({ membershipId: 1 });

export const TransactionModel: Model<ITransaction> = model<ITransaction>("Transaction", TransactionSchema);
export const TRANSACTION_MODEL_TOKEN = "TRANSACTION_MODEL_TOKEN";
