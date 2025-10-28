import { Schema, model, Types } from "mongoose";

const LedgerSchema = new Schema({
    workspaceId: { type: Types.ObjectId, ref: "Workspace", index: true, required: true },
    gameId: { type: Types.ObjectId, ref: "Game" },
    userId: { type: Types.ObjectId, ref: "User" },
    type: { type: String, enum: ["debit", "credit"], required: true }, // debit=cobrança | credit=pagamento
    method: { type: String, enum: ["pix", "dinheiro", "transf", "ajuste"], default: "pix" },
    amountCents: { type: Number, required: true },
    note: String,
    status: { type: String, enum: ["pendente", "confirmado", "estornado"], default: "confirmado" },
    confirmedAt: Date
}, { timestamps: true });

LedgerSchema.index({ workspaceId: 1, userId: 1, status: 1 });

export const LedgerModel = model("Ledger", LedgerSchema);
