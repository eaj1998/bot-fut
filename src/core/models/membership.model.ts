import { Schema, model, Types, Model, Document } from "mongoose";

export enum MembershipStatus {
    PENDING = "PENDING",
    ACTIVE = "ACTIVE",
    SUSPENDED = "SUSPENDED",
    CANCELED_SCHEDULED = "CANCELED_SCHEDULED",
    INACTIVE = "INACTIVE"
}

export interface IMembership extends Document {
    _id: Types.ObjectId;
    workspaceId: Types.ObjectId;
    userId: Types.ObjectId;
    status: MembershipStatus;
    planValue: number; // Valor em centavos
    startDate: Date;
    endDate?: Date; // Data de término (se cancelado)
    nextDueDate: Date; // Próximo vencimento (sempre dia 10)
    canceledAt?: Date;
    suspendedAt?: Date;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}

const MembershipSchema = new Schema({
    workspaceId: {
        type: Types.ObjectId,
        ref: "Workspace",
        required: true,
        index: true
    },
    userId: {
        type: Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    status: {
        type: String,
        enum: Object.values(MembershipStatus),
        default: MembershipStatus.PENDING,
        index: true
    },
    planValue: {
        type: Number,
        required: true
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date
    },
    nextDueDate: {
        type: Date,
        required: true,
        index: true
    },
    canceledAt: {
        type: Date
    },
    suspendedAt: {
        type: Date
    },
    notes: {
        type: String
    }
}, {
    timestamps: true
});

// Índices compostos para queries comuns
MembershipSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });
MembershipSchema.index({ workspaceId: 1, status: 1 });
MembershipSchema.index({ status: 1, nextDueDate: 1 });

export const MembershipModel: Model<IMembership> = model<IMembership>("Membership", MembershipSchema);
export const MEMBERSHIP_MODEL_TOKEN = "MEMBERSHIP_MODEL_TOKEN";
