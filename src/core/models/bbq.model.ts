import { Schema, model, Model, Types } from 'mongoose';

export interface IBBQParticipant {
    userId: string;
    userName: string;
    invitedBy: string | null;
    isPaid: boolean;
    isGuest: boolean;
    isFree: boolean;
    debtId?: string;
    transactionId?: string;
}

export interface IBBQ {
    _id: Types.ObjectId;
    chatId: string;
    workspaceId: string;
    description?: string;
    status: 'open' | 'closed' | 'finished' | 'cancelled';
    date: Date;
    createdAt: Date;
    closedAt?: Date;
    finishedAt?: Date;
    participants: IBBQParticipant[];
    financials: {
        meatCost: number;
        cookCost: number;
        ticketPrice: number;
    };
}

const BBQSchema = new Schema<IBBQ>({
    chatId: { type: String, required: true },
    workspaceId: { type: String, required: true },
    description: { type: String, default: '' },
    status: { type: String, enum: ['open', 'closed', 'finished', 'cancelled'], default: 'open' },
    date: {
        type: Date, required: true, default: () => {
            const now = new Date();
            return new Date(now.getFullYear(), now.getMonth(), now.getDate());
        }
    },
    createdAt: { type: Date, default: Date.now },
    closedAt: { type: Date },
    finishedAt: { type: Date },
    participants: [{
        userId: { type: String, required: true },
        userName: { type: String, required: true },
        invitedBy: { type: String, default: null },
        isPaid: { type: Boolean, default: false },
        isGuest: { type: Boolean, default: false },
        isFree: { type: Boolean, default: false },
        debtId: { type: String },
        transactionId: { type: String }
    }],
    financials: {
        meatCost: { type: Number, default: 0 },
        cookCost: { type: Number, default: 0 },
        ticketPrice: { type: Number, default: 0 }
    }
});

BBQSchema.index({ chatId: 1, createdAt: 1 });

export const BBQModel: Model<IBBQ> = model<IBBQ>("BBQ", BBQSchema);
export const BBQ_MODEL_TOKEN = "BBQ_MODEL_TOKEN";
