import { Schema, model, Model, Types } from 'mongoose';

export interface IBBQParticipant {
    userId: string;
    userName: string;
    invitedBy: string | null;
    isPaid: boolean;
    isGuest: boolean;
    debtId?: string;
}

export interface IBBQ {
    _id: Types.ObjectId;
    chatId: string;
    workspaceId: string;
    status: 'open' | 'closed' | 'finished' | 'cancelled';
    date: Date;
    createdAt: Date;
    closedAt?: Date;
    finishedAt?: Date;
    participants: IBBQParticipant[];
    valuePerPerson: number | null;
}

const BBQSchema = new Schema<IBBQ>({
    chatId: { type: String, required: true },
    workspaceId: { type: String, required: true },
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
        debtId: { type: String }
    }],
    valuePerPerson: { type: Number, default: null }
});

BBQSchema.index({ chatId: 1, createdAt: 1 });

export const BBQModel: Model<IBBQ> = model<IBBQ>("BBQ", BBQSchema);
export const BBQ_MODEL_TOKEN = "BBQ_MODEL_TOKEN";
