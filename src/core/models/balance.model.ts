import { Schema, model, Types } from "mongoose";

const BalanceSchema = new Schema({
    workspaceId: { type: Types.ObjectId, ref: "Workspace", index: true, required: true },
    userId: { type: Types.ObjectId, ref: "User", index: true, required: true },
    balanceCents: { type: Number, default: 0 }, // + = deve | - = adiantado
    lastUpdatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

BalanceSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });

export const BalanceModel = model("Balance", BalanceSchema);
